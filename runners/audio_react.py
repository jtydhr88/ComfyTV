import json
import math

import numpy as np

from .media import localize, get_video_info, fresh_output_path, path_to_view_url
from .media_filter import require_filters, make_progress

BANDS = {
    'bass': (20.0, 160.0),
    'mid': (160.0, 2000.0),
    'high': (2000.0, 8000.0),
    'full': (20.0, 16000.0),
}

_SR = 22050


def _decode_mono(url):
    import av

    src = localize(url)
    chunks = []
    with av.open(str(src)) as c:
        if not c.streams.audio:
            raise RuntimeError("audio reactive: input has no audio stream")
        stream = c.streams.audio[0]
        resampler = av.AudioResampler(format='fltp', layout='mono', rate=_SR)
        for frame in c.decode(stream):
            for rf in resampler.resample(frame):
                chunks.append(rf.to_ndarray()[0])
        for rf in resampler.resample(None):
            chunks.append(rf.to_ndarray()[0])
    if not chunks:
        raise RuntimeError("audio reactive: no audio frames decoded")
    return np.concatenate(chunks).astype(np.float32)


def band_envelope(url, *, band='bass', freq_lo=0.0, freq_hi=0.0,
                  attack: float = 0.02, release: float = 0.25):
    import torch

    samples = _decode_mono(url)
    n_fft = 2048
    hop = 512
    wave = torch.from_numpy(samples)
    spec = torch.stft(wave, n_fft=n_fft, hop_length=hop,
                      window=torch.hann_window(n_fft),
                      return_complex=True).abs()
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / _SR)
    lo, hi = BANDS.get(band, BANDS['bass'])
    if band == 'custom':
        lo = max(10.0, float(freq_lo))
        hi = max(lo + 10.0, float(freq_hi))
    sel = (freqs >= lo) & (freqs <= hi)
    if not sel.any():
        sel = freqs >= 0
    energy = spec[torch.from_numpy(sel)].pow(2).mean(dim=0).sqrt().numpy()

    ref = float(np.percentile(energy, 95))
    if ref <= 1e-9:
        return np.zeros_like(energy), hop / _SR
    norm = np.clip(energy / ref, 0.0, 1.0)

    dt = hop / _SR
    ka = 1.0 - math.exp(-dt / max(1e-4, float(attack)))
    kr = 1.0 - math.exp(-dt / max(1e-4, float(release)))
    env = np.zeros_like(norm)
    e = 0.0
    for i, x in enumerate(norm):
        k = ka if x > e else kr
        e = e + (x - e) * k
        env[i] = e
    return env, dt


def audio_reactive_keyframes(url, *, band='bass', freq_lo=0.0, freq_hi=0.0,
                             attack: float = 0.02, release: float = 0.25,
                             rate: float = 10.0, min_value: float = 0.0,
                             max_value: float = 1.0, gain: float = 1.0,
                             field: str = 'v', progress=None) -> str:
    env, dt = band_envelope(url, band=band, freq_lo=freq_lo, freq_hi=freq_hi,
                            attack=attack, release=release)
    rate = max(1.0, min(60.0, float(rate)))
    total = len(env) * dt
    n_keys = max(2, int(total * rate) + 1)
    keys = []
    fname = (field or 'v').strip() or 'v'
    for i in range(n_keys):
        t = i / rate
        idx = min(len(env) - 1, int(t / dt))
        v = float(np.clip(env[idx] * float(gain), 0.0, 1.0))
        val = float(min_value) + v * (float(max_value) - float(min_value))
        keys.append({'t': round(t, 4), fname: round(val, 5),
                     'interp': 'linear'})
    return json.dumps(keys)


def meter_overlay_video(view_url: str, *, meter_w: int = 400,
                        meter_h: int = 20, corner: str = 'bottom-left',
                        margin: int = 16, progress=None) -> str:
    import av

    require_filters('showvolume', 'overlay', 'scale', 'format')
    info = get_video_info(view_url)
    if not info.get('has_audio'):
        raise RuntimeError("audio meter: the video has no audio track")
    src = localize(view_url)
    out = fresh_output_path('.mp4')
    fps = info['fps'] or 24
    w = info['width'] - (info['width'] % 2)
    h = info['height'] - (info['height'] % 2)
    mw = max(80, min(w, int(meter_w)))
    mh = max(8, min(120, int(meter_h)))

    pos = {
        'top-left': (margin, margin),
        'top-right': (f'W-w-{margin}', margin),
        'bottom-left': (margin, f'H-h-{margin}'),
        'bottom-right': (f'W-w-{margin}', f'H-h-{margin}'),
    }.get(corner, (margin, f'H-h-{margin}'))

    with av.open(str(src)) as inp, av.open(str(out), 'w') as outp:
        in_v = inp.streams.video[0]
        in_a = inp.streams.audio[0]
        enc = outp.add_stream('libx264', rate=round(fps))
        enc.width, enc.height = w, h
        enc.pix_fmt = 'yuv420p'
        out_a = outp.add_stream_from_template(in_a)

        graph = av.filter.Graph()
        vin = graph.add_buffer(template=in_v)
        ain = graph.add_abuffer(template=in_a)
        vol = graph.add('showvolume',
                        f'rate={round(fps)}:w={mw}:h={mh}:f=0.6:t=0:v=0')
        fmt = graph.add('format', 'rgba')
        ov = graph.add('overlay', f'x={pos[0]}:y={pos[1]}:eval=frame')
        ofmt = graph.add('format', 'yuv420p')
        sink = graph.add('buffersink')
        vin.link_to(ov, 0, 0)
        ain.link_to(vol, 0, 0)
        vol.link_to(fmt, 0, 0)
        fmt.link_to(ov, 0, 1)
        ov.link_to(ofmt, 0, 0)
        ofmt.link_to(sink, 0, 0)
        graph.configure()

        n = 0
        total_est = max(1, int(info['duration'] * fps))
        report = make_progress(progress, total_est, "meter")

        def _drain():
            nonlocal n
            while True:
                try:
                    f = sink.pull()
                except (av.error.BlockingIOError, av.error.EOFError, EOFError):
                    return
                except av.FFmpegError as e:
                    if getattr(e, 'errno', None) in (11, 35):
                        return
                    raise
                for pkt in enc.encode(f):
                    outp.mux(pkt)
                n += 1
                report(n)

        for packet in inp.demux():
            if packet.dts is None:
                continue
            if packet.stream is in_v:
                for frame in packet.decode():
                    vin.push(frame)
                    _drain()
            elif packet.stream is in_a:
                for frame in packet.decode():
                    ain.push(frame)
                    _drain()
                packet.stream = out_a
                outp.mux(packet)
        try:
            vin.push(None)
            ain.push(None)
        except Exception:
            pass
        _drain()
        for pkt in enc.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


__all__ = ['audio_reactive_keyframes', 'band_envelope', 'meter_overlay_video',
           'BANDS']
