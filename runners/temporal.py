from .media import localize, get_video_info, fresh_output_path, path_to_view_url
from .media_torch import _device, _from_tensor, _OUT_TB

FRAME_BLEND_OPS = ('average', 'min', 'max', 'sum', 'product')
SHUTTER_TYPES = ('centered', 'start', 'end', 'custom')


def _windowed_process(view_url: str, back: int, fwd: int, emit_fn,
                      progress=None) -> str:
    import av
    import torch

    src = localize(view_url)
    info = get_video_info(view_url)
    out = fresh_output_path('.mp4')
    device = _device()
    total_est = max(1, int(info['duration'] * info['fps']))

    buf = []
    first = 0
    emitted = 0
    enc = None
    held = []

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        in_a = inp.streams.audio[0] if inp.streams.audio else None
        out_a = outp.add_stream_from_template(in_a) if in_a is not None else None

        def _encode(tensor, t):
            nonlocal enc
            if enc is None:
                rate = info['fps'] or 24
                enc = outp.add_stream('libx264', rate=round(rate))
                enc.width = tensor.shape[1] - (tensor.shape[1] % 2)
                enc.height = tensor.shape[0] - (tensor.shape[0] % 2)
                enc.pix_fmt = 'yuv420p'
                enc.codec_context.time_base = _OUT_TB
            nf = _from_tensor(tensor[:enc.height, :enc.width, :3])
            nf = nf.reformat(format='yuv420p')
            nf.pts = int(round(t / _OUT_TB))
            nf.time_base = _OUT_TB
            for pkt in enc.encode(nf):
                while held:
                    outp.mux(held.pop(0))
                outp.mux(pkt)

        def _tensor_at(idx):
            i = min(max(idx, first), first + len(buf) - 1)
            stored = buf[i - first][1]
            return stored.to(device).float() / 255.0

        def _emit_center(center):
            nonlocal first, emitted
            t = buf[center - first][0]
            result = emit_fn(_tensor_at, center, first,
                             first + len(buf) - 1, device)
            _encode(result, t)
            emitted += 1
            if progress is not None and emitted % 15 == 0:
                progress(min(emitted, total_est), total_est, "rendering")
            while first < center - back + 1 and len(buf) > 1:
                buf.pop(0)
                first += 1

        n = 0
        for packet in inp.demux():
            if packet.dts is None:
                continue
            if packet.stream is in_v:
                for frame in packet.decode():
                    t = (float(frame.pts * frame.time_base)
                         if frame.pts is not None else n / (info['fps'] or 24))
                    arr = frame.to_ndarray(format='rgb24')
                    buf.append((t, torch.from_numpy(arr)))
                    if n - fwd >= 0:
                        _emit_center(n - fwd)
                    n += 1
            elif out_a is not None and packet.stream is in_a:
                packet.stream = out_a
                if enc is None:
                    held.append(packet)
                else:
                    while held:
                        outp.mux(held.pop(0))
                    outp.mux(packet)
        for center in range(max(0, n - fwd), n):
            _emit_center(center)
        if enc is not None:
            for pkt in enc.encode():
                outp.mux(pkt)

    return path_to_view_url(out)


def frame_blend_video(view_url: str, *, frame_min: int = -5,
                      frame_max: int = 0, interval: int = 1,
                      operation: str = 'average', decay: float = 0.0,
                      output_count: bool = False, progress=None) -> str:
    import torch

    if operation not in FRAME_BLEND_OPS:
        raise RuntimeError(f"frame blend: unknown operation {operation!r}")
    lo = int(frame_min)
    hi = int(frame_max)
    if lo > hi:
        lo, hi = hi, lo
    step = max(1, int(interval))
    dec = max(0.0, min(1.0, float(decay)))
    dec = 1.0 - (1.0 - dec) ** step
    n_frames = max(1, (hi - lo + 1) // step)
    offsets = sorted(hi - k * step for k in range(n_frames))
    back = max(0, -offsets[0])
    fwd = max(0, offsets[-1])

    def emit_fn(tensor_at, center, lo_idx, hi_idx, device):
        first_f = tensor_at(center + offsets[0])
        if operation == 'min':
            acc = torch.full_like(first_f, float('inf'))
        elif operation == 'max':
            acc = torch.full_like(first_f, float('-inf'))
        elif operation == 'product':
            acc = torch.ones_like(first_f)
        else:
            acc = torch.zeros_like(first_f)
        weight = 0.0
        count = 0
        for off in offsets:
            f = tensor_at(center + off)
            if dec > 0:
                acc = acc * (1.0 - dec)
                weight *= (1.0 - dec)
            if operation == 'min':
                acc = torch.minimum(acc, f)
            elif operation == 'max':
                acc = torch.maximum(acc, f)
            elif operation == 'product':
                acc = acc * f
            else:
                acc = acc + f
            weight += 1.0
            count += 1
        if operation == 'average':
            acc = acc / max(weight, 1e-6)
        if output_count:
            v = count / max(1, len(offsets))
            return torch.full_like(acc, v)
        return acc.clamp(0, 1)

    return _windowed_process(view_url, back, fwd, emit_fn, progress=progress)


def time_blur_video(view_url: str, *, shutter: float = 0.5,
                    shutter_type: str = 'centered',
                    shutter_offset: float = 0.0, divisions: int = 10,
                    progress=None) -> str:
    if shutter_type not in SHUTTER_TYPES:
        raise RuntimeError(f"time blur: unknown shutter type {shutter_type!r}")
    div = max(1, min(64, int(divisions)))
    s = max(0.0, float(shutter))
    if shutter_type == 'start':
        r0 = 0.0
    elif shutter_type == 'end':
        r0 = -s
    elif shutter_type == 'custom':
        r0 = float(shutter_offset)
    else:
        r0 = -s / 2.0
    sample_offsets = [r0 + i * (s / div) for i in range(div)]
    back = max(0, int(-min(sample_offsets) + 1)) if sample_offsets else 0
    fwd = max(0, int(max(sample_offsets) + 1)) if sample_offsets else 0

    def emit_fn(tensor_at, center, lo_idx, hi_idx, device):
        acc = None
        for off in sample_offsets:
            f = tensor_at(center + int(round(off)))
            acc = f if acc is None else acc + f
        return (acc / len(sample_offsets)).clamp(0, 1)

    return _windowed_process(view_url, back, fwd, emit_fn, progress=progress)


__all__ = ['frame_blend_video', 'time_blur_video', 'FRAME_BLEND_OPS',
           'SHUTTER_TYPES']
