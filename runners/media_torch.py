
import math
from fractions import Fraction

import numpy as np

from .media import (
    localize, fresh_output_path, path_to_view_url, get_video_info,
)
from .keyframes import KeyframeCurve, resolve_param

_OUT_TB = Fraction(1, 90000)


def _device():
    import torch
    return 'cuda' if torch.cuda.is_available() else 'cpu'


def mat_translation(x, y):
    return np.array([[1., 0., x], [0., 1., y], [0., 0., 1.]])


def mat_rotation(rads):
    c, s = math.cos(rads), math.sin(rads)
    return np.array([[c, s, 0.], [-s, c, 0.], [0., 0., 1.]])


def mat_scale(sx, sy):
    return np.array([[sx, 0., 0.], [0., sy, 0.], [0., 0., 1.]])


def mat_skew_xy(skew_x, skew_y, skew_order_yx=False):
    return np.array([
        [1. if skew_order_yx else (1. + skew_x * skew_y), skew_x, 0.],
        [skew_y, (1. + skew_x * skew_y) if skew_order_yx else 1., 0.],
        [0., 0., 1.]])


def mat_transform_canonical(tx, ty, sx, sy, skew_x, skew_y, rads, cx, cy):
    return (mat_translation(cx, cy) @ mat_translation(tx, ty)
            @ mat_rotation(-rads) @ mat_skew_xy(skew_x, skew_y)
            @ mat_scale(sx, sy) @ mat_translation(-cx, -cy))


def homography_from_points(src_pts, dst_pts):
    A = []
    b = []
    for (x, y), (u, v) in zip(src_pts, dst_pts):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        b.append(v)
    h, *_ = np.linalg.lstsq(np.asarray(A, dtype=np.float64),
                            np.asarray(b, dtype=np.float64), rcond=None)
    return np.append(h, 1.0).reshape(3, 3)


def _warp_frame(t_frame, mat_inv, device, out_hw=None):
    import torch
    src_h, src_w = t_frame.shape[0], t_frame.shape[1]
    h, w = out_hw if out_hw is not None else (src_h, src_w)
    ys, xs = torch.meshgrid(
        torch.arange(h, dtype=torch.float32, device=device),
        torch.arange(w, dtype=torch.float32, device=device), indexing='ij')
    m = torch.as_tensor(mat_inv, dtype=torch.float32, device=device)
    sx = m[0, 0] * xs + m[0, 1] * ys + m[0, 2]
    sy = m[1, 0] * xs + m[1, 1] * ys + m[1, 2]
    sw = m[2, 0] * xs + m[2, 1] * ys + m[2, 2]
    sw = torch.where(sw.abs() < 1e-9, torch.full_like(sw, 1e-9), sw)
    sx = sx / sw
    sy = sy / sw
    gx = sx / max(src_w - 1, 1) * 2 - 1
    gy = sy / max(src_h - 1, 1) * 2 - 1
    grid = torch.stack([gx, gy], dim=-1).unsqueeze(0)
    inp = t_frame.permute(2, 0, 1).unsqueeze(0)
    out = torch.nn.functional.grid_sample(
        inp, grid, mode='bilinear', padding_mode='zeros', align_corners=True)
    return out.squeeze(0).permute(1, 2, 0)


def _to_tensor(frame, device, alpha=False):
    import torch
    fmt = 'rgba' if alpha else 'rgb24'
    arr = frame.to_ndarray(format=fmt)
    return torch.from_numpy(arr).to(device).float() / 255.0


DITHER_OUTPUT = True


def dither_to_byte(t, starts=None):
    import torch
    v16 = (t.clamp(0, 1) * 65280.0).round().long()
    h, w = v16.shape[0], v16.shape[1]
    if starts is None:
        starts = torch.randint(0, w, (h,), device=v16.device)
    else:
        starts = starts.to(v16.device).long().clamp(0, w - 1)
    cum = v16.cumsum(dim=1)
    zeros = torch.zeros_like(cum[:, :1])
    cum_excl = torch.cat([zeros, cum[:, :-1]], dim=1)
    s = starts.view(h, 1, 1)
    xs = torch.arange(w, device=v16.device).view(1, w, 1)
    cum_start = torch.gather(
        cum_excl, 1, s.expand(h, 1, v16.shape[2]))
    fwd_carry = (0x80 + (cum_excl - cum_start)) % 256
    fwd = (fwd_carry + v16) >> 8
    rev_cum = cum_start - cum_excl - v16
    bwd_carry = (0x80 + rev_cum) % 256
    bwd = (bwd_carry + v16) >> 8
    out = torch.where(xs >= s, fwd, bwd)
    return out.clamp(0, 255).byte()


def _from_tensor(t, dither=None):
    import av
    if dither is None:
        dither = DITHER_OUTPUT
    if dither:
        rgb = dither_to_byte(t[..., :3]).cpu().numpy()
        if t.shape[2] == 4:
            a = (t[..., 3:4].clamp(0, 1) * 255.0).round().byte().cpu().numpy()
            arr = np.concatenate([rgb, a], axis=2)
            fmt = 'rgba'
        else:
            arr = rgb
            fmt = 'rgb24'
    else:
        arr = (t.clamp(0, 1) * 255.0).round().byte().cpu().numpy()
        fmt = 'rgba' if arr.shape[2] == 4 else 'rgb24'
    return av.VideoFrame.from_ndarray(np.ascontiguousarray(arr), format=fmt)


def torch_process_video(view_url: str, frame_fn, *, progress=None,
                        alpha_in=False, out_fps=None, out_alpha=False) -> str:
    import av

    src = localize(view_url)
    info = get_video_info(view_url)
    out = fresh_output_path('.webm' if out_alpha else '.mp4')
    device = _device()
    total_est = max(1, int(info['duration'] * info['fps']))
    from .media_filter import make_progress
    report_progress = make_progress(progress, total_est, "rendering")

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        in_a = inp.streams.audio[0] if (inp.streams.audio and not out_alpha) else None
        out_a = outp.add_stream_from_template(in_a) if in_a is not None else None

        enc = None
        n = 0
        held = []

        def _encode(tensor, t):
            nonlocal enc
            if enc is None:
                rate = out_fps or info['fps'] or 24
                if out_alpha:
                    enc = outp.add_stream('libvpx-vp9', rate=round(rate))
                    enc.pix_fmt = 'yuva420p'
                    enc.options = {'crf': '32', 'b': '0', 'row-mt': '1',
                                   'cpu-used': '4', 'auto-alt-ref': '0'}
                else:
                    enc = outp.add_stream('libx264', rate=round(rate))
                    enc.pix_fmt = 'yuv420p'
                enc.width = tensor.shape[1] - (tensor.shape[1] % 2)
                enc.height = tensor.shape[0] - (tensor.shape[0] % 2)
                enc.codec_context.time_base = _OUT_TB
            ch = 4 if out_alpha else 3
            nf = _from_tensor(tensor[:enc.height, :enc.width, :ch])
            nf = nf.reformat(format='yuva420p' if out_alpha else 'yuv420p')
            nf.pts = int(round(t / _OUT_TB))
            nf.time_base = _OUT_TB
            for pkt in enc.encode(nf):
                while held:
                    outp.mux(held.pop(0))
                outp.mux(pkt)

        for packet in inp.demux():
            if packet.dts is None:
                continue
            if packet.stream is in_v:
                for frame in packet.decode():
                    t = float(frame.pts * frame.time_base) if frame.pts is not None else 0.0
                    tensor = _to_tensor(frame, device, alpha=alpha_in)
                    result = frame_fn(tensor, t)
                    _encode(result, t)
                    n += 1
                    report_progress(n)
            elif out_a is not None and packet.stream is in_a:
                packet.stream = out_a
                if enc is None:
                    held.append(packet)
                else:
                    while held:
                        outp.mux(held.pop(0))
                    outp.mux(packet)
        if enc is not None:
            for pkt in enc.encode():
                outp.mux(pkt)

    return path_to_view_url(out)


def shutter_samples(t, motion_blur, shutter, shutter_type, shutter_offset,
                    fps):
    nb = int(math.floor(float(motion_blur or 0) * 10 + 0.5))
    if nb < 1 or not shutter:
        return [t]
    span = float(shutter) / fps
    if shutter_type == 'start':
        t0, t1 = t, t + span
    elif shutter_type == 'end':
        t0, t1 = t - span, t
    elif shutter_type == 'custom':
        t0 = t + float(shutter_offset) / fps
        t1 = t0 + span
    else:
        t0, t1 = t - span / 2.0, t + span / 2.0
    step = span / nb
    out = []
    ts = t0
    while ts <= t1 + step * 1e-6:
        out.append(ts)
        ts += step
    return out


def transform_video(view_url: str, *, translate_x=0.0, translate_y=0.0,
                    scale=1.0, rotation_deg=0.0, skew_x=0.0,
                    keyframes=None, motion_blur=0.0, shutter=0.5,
                    shutter_type='centered', shutter_offset=0.0,
                    filter_mode='bilinear', progress=None) -> str:
    info = get_video_info(view_url)
    w, h = info['width'], info['height']
    cx, cy = w / 2.0, h / 2.0

    def curves_from(keys, field, default):
        if not keys:
            return KeyframeCurve.constant(default)
        return KeyframeCurve([
            {'t': k.get('t', 0.0), 'v': k.get(field, default),
             'interp': k.get('interp', 'smooth')} for k in keys])

    kx = curves_from(keyframes, 'x', translate_x)
    ky = curves_from(keyframes, 'y', translate_y)
    ks = curves_from(keyframes, 'scale', scale)
    kr = curves_from(keyframes, 'rotation', rotation_deg)

    def mat_at(t):
        m = mat_transform_canonical(
            kx.value(t), -ky.value(t), max(1e-6, ks.value(t)),
            max(1e-6, ks.value(t)), -skew_x, 0.0,
            -math.radians(kr.value(t)), cx, cy)
        return np.linalg.inv(m)

    fps = info['fps'] or 24

    def frame_fn(tensor, t):
        device = tensor.device
        times = shutter_samples(t, motion_blur, shutter, shutter_type,
                                shutter_offset, fps)
        if len(times) == 1:
            return _warp_frame(tensor, mat_at(times[0]), device)
        acc = None
        for ts in times:
            wf = _warp_frame(tensor, mat_at(ts), device)
            acc = wf if acc is None else acc + wf
        return acc / len(times)

    return torch_process_video(view_url, frame_fn, progress=progress)


def corner_pin_video(view_url: str, corners, keyframes=None,
                     progress=None) -> str:
    info = get_video_info(view_url)
    w, h = info['width'], info['height']
    src_pts = [(0, 0), (w, 0), (w, h), (0, h)]

    kf = sorted(keyframes or [], key=lambda k: k.get('t', 0.0))

    def corners_at(t):
        if not kf:
            return corners
        if t <= kf[0].get('t', 0.0):
            return kf[0]['corners']
        if t >= kf[-1].get('t', 0.0):
            return kf[-1]['corners']
        for i in range(len(kf) - 1):
            t0, t1 = kf[i].get('t', 0.0), kf[i + 1].get('t', 0.0)
            if t0 <= t <= t1:
                f = (t - t0) / max(t1 - t0, 1e-9)
                return [
                    [kf[i]['corners'][j][0] * (1 - f) + kf[i + 1]['corners'][j][0] * f,
                     kf[i]['corners'][j][1] * (1 - f) + kf[i + 1]['corners'][j][1] * f]
                    for j in range(4)]
        return corners

    def frame_fn(tensor, t):
        dst = corners_at(t)
        H = homography_from_points(src_pts, dst)
        return _warp_frame(tensor, np.linalg.inv(H), tensor.device)

    return torch_process_video(view_url, frame_fn, progress=progress)


def composite_videos(bg_url: str, fg_url: str, *, operator='over',
                     opacity=1.0, translate_x=0.0, translate_y=0.0,
                     scale=1.0, rotation_deg=0.0, keyframes=None,
                     mask_url=None, progress=None) -> str:
    import av
    import torch
    from .blend_modes import merge

    bg_info = get_video_info(bg_url)
    w, h = bg_info['width'], bg_info['height']
    cx, cy = w / 2.0, h / 2.0
    device = _device()

    def curves_from(field, default):
        if not keyframes:
            return KeyframeCurve.constant(default)
        return KeyframeCurve([
            {'t': k.get('t', 0.0), 'v': k.get(field, default),
             'interp': k.get('interp', 'smooth')} for k in keyframes])

    kx = curves_from('x', translate_x)
    ky = curves_from('y', translate_y)
    ks = curves_from('scale', scale)
    kr = curves_from('rotation', rotation_deg)
    ko = curves_from('opacity', opacity)

    fg_src = localize(fg_url)
    fg_container = av.open(str(fg_src))
    fg_stream = fg_container.streams.video[0]
    fg_has_alpha = 'a' in (fg_stream.codec_context.pix_fmt or '')
    if fg_has_alpha:
        try:
            fg_stream.codec_context.options = {}
            alt = av.CodecContext.create('libvpx-vp9', 'r')
            del alt
        except Exception:
            pass
    fg_iter = fg_container.decode(fg_stream)
    fg_frame = None
    fg_t = -1.0
    fg_done = False

    mask_iter = mask_container = None
    mask_frame = None
    mask_t = -1.0
    if mask_url:
        mask_container = av.open(str(localize(mask_url)))
        mask_iter = mask_container.decode(mask_container.streams.video[0])

    def _advance(t):
        nonlocal fg_frame, fg_t, fg_done, mask_frame, mask_t
        while not fg_done and fg_t < t - 1e-4:
            try:
                f = next(fg_iter)
                fg_t = float(f.pts * f.time_base) if f.pts is not None else fg_t + 1 / 24
                fg_frame = f
            except StopIteration:
                fg_done = True
        if mask_iter is not None:
            while mask_t < t - 1e-4:
                try:
                    f = next(mask_iter)
                    mask_t = float(f.pts * f.time_base) if f.pts is not None else mask_t + 1 / 24
                    mask_frame = f
                except StopIteration:
                    break

    def frame_fn(bg_tensor, t):
        _advance(t)
        if fg_frame is None:
            return bg_tensor
        fg = _to_tensor(fg_frame, device, alpha=fg_has_alpha)
        if fg.shape[2] == 3:
            fg = torch.cat([fg, torch.ones_like(fg[..., :1])], dim=-1)
        fg = torch.cat([fg[..., :3] * fg[..., 3:4], fg[..., 3:4]], dim=-1)

        fg_h, fg_w = fg.shape[0], fg.shape[1]
        s = max(1e-6, ks.value(t))
        m = (mat_translation(cx, cy)
             @ mat_translation(kx.value(t), -ky.value(t))
             @ mat_rotation(math.radians(kr.value(t)))
             @ mat_scale(s, s)
             @ mat_translation(-fg_w / 2.0, -fg_h / 2.0))
        warped = _warp_frame(fg, np.linalg.inv(m), device, out_hw=(h, w))

        bg = torch.cat([bg_tensor, torch.ones_like(bg_tensor[..., :1])], dim=-1)
        merged = merge(warped, bg, operator)
        eff = float(max(0.0, min(1.0, ko.value(t))))
        if mask_frame is not None:
            mk = _to_tensor(mask_frame, device)[..., :1]
            if mk.shape[0] != h or mk.shape[1] != w:
                mk = torch.nn.functional.interpolate(
                    mk.permute(2, 0, 1).unsqueeze(0), size=(h, w),
                    mode='bilinear', align_corners=False
                ).squeeze(0).permute(1, 2, 0)
            out = bg + (merged - bg) * (mk * eff)
        else:
            out = bg + (merged - bg) * eff
        return out[..., :3]

    try:
        return torch_process_video(bg_url, frame_fn, progress=progress)
    finally:
        fg_container.close()
        if mask_container is not None:
            mask_container.close()


__all__ = [
    'torch_process_video', 'transform_video', 'corner_pin_video',
    'composite_videos', 'mat_transform_canonical', 'homography_from_points',
]
