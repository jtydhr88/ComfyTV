import math
from fractions import Fraction

import numpy as np

from .media import fresh_output_path, path_to_view_url

_OUT_TB = Fraction(1, 90000)

PATTERN_KINDS = ['ramp', 'radial', 'rectangle', 'noise']
RAMP_INTERPS = ['linear', 'smooth', 'ease_in', 'ease_out']


def _hex_rgb(s):
    s = (s or '#000000').lstrip('#')
    return np.array([int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4)],
                    dtype=np.float32)


def _shape_t(t, interp):
    if interp == 'smooth':
        return t * t * (3 - 2 * t)
    if interp == 'ease_in':
        return t * t * (2 - t)
    if interp == 'ease_out':
        return t * (1 + t * (1 - t))
    return t


def _value_noise(w, h, scale, octaves, seed, phase):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), dtype=np.float32)
    amp = 1.0
    total = 0.0
    for o in range(max(1, octaves)):
        cells = max(2, int(scale / (2 ** o)))
        gw, gh = w // cells + 3, h // cells + 3
        g0 = rng.random((gh, gw)).astype(np.float32)
        g1 = rng.random((gh, gw)).astype(np.float32)
        f = phase - math.floor(phase)
        grid = g0 * (1 - f) + g1 * f if o == 0 else g0
        ys = np.linspace(0, gh - 3, h)
        xs = np.linspace(0, gw - 3, w)
        yi = ys.astype(int)
        xi = xs.astype(int)
        fy = (ys - yi)[:, None]
        fx = (xs - xi)[None, :]
        fy = fy * fy * (3 - 2 * fy)
        fx = fx * fx * (3 - 2 * fx)
        v00 = grid[yi][:, xi]
        v01 = grid[yi][:, xi + 1]
        v10 = grid[yi + 1][:, xi]
        v11 = grid[yi + 1][:, xi + 1]
        layer = (v00 * (1 - fx) * (1 - fy) + v01 * fx * (1 - fy)
                 + v10 * (1 - fx) * fy + v11 * fx * fy)
        out += layer * amp
        total += amp
        amp *= 0.5
    return out / max(1e-6, total)


def generate_pattern_video(kind: str, *, width: int = 1280, height: int = 720,
                           fps: int = 24, duration: float = 5.0,
                           color0: str = '#000000', color1: str = '#FFFFFF',
                           p0=(0.0, 0.5), p1=(1.0, 0.5),
                           interp: str = 'linear', softness: float = 0.0,
                           noise_scale: int = 64, noise_octaves: int = 4,
                           noise_speed: float = 1.0, seed: int = 7,
                           progress=None) -> str:
    import av

    if kind not in PATTERN_KINDS:
        raise RuntimeError(f"pattern: unknown kind {kind!r}")
    w = max(16, int(width)) & ~1
    h = max(16, int(height)) & ~1
    fps = max(1, min(120, int(fps)))
    n = max(1, int(float(duration) * fps))
    c0 = _hex_rgb(color0)
    c1 = _hex_rgb(color1)
    ax, ay = float(p0[0]) * w, float(p0[1]) * h
    bx, by = float(p1[0]) * w, float(p1[1]) * h

    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)

    static = None
    if kind == 'ramp':
        dx, dy = bx - ax, by - ay
        d2 = max(1e-6, dx * dx + dy * dy)
        tmap = np.clip(((xs - ax) * dx + (ys - ay) * dy) / d2, 0, 1)
        static = _shape_t(tmap, interp)
    elif kind == 'radial':
        r = max(1e-6, math.hypot(bx - ax, by - ay))
        tmap = np.clip(np.hypot(xs - ax, ys - ay) / r, 0, 1)
        static = _shape_t(tmap, interp)
    elif kind == 'rectangle':
        x0, x1_ = sorted((ax, bx))
        y0, y1_ = sorted((ay, by))
        s = max(0.5, float(softness) * min(w, h) * 0.25 + 0.5)
        inside_x = np.clip(np.minimum(xs - x0, x1_ - xs) / s, 0, 1)
        inside_y = np.clip(np.minimum(ys - y0, y1_ - ys) / s, 0, 1)
        static = 1.0 - inside_x * inside_y

    out = fresh_output_path('.mp4')
    with av.open(str(out), 'w') as outp:
        enc = outp.add_stream('libx264', rate=fps)
        enc.width, enc.height = w, h
        enc.pix_fmt = 'yuv420p'
        enc.codec_context.time_base = _OUT_TB
        cached = None
        for i in range(n):
            t = i / fps
            if kind == 'noise':
                tmap = _value_noise(w, h, int(noise_scale),
                                    int(noise_octaves), int(seed),
                                    t * float(noise_speed))
            else:
                tmap = static
            if kind != 'noise' and cached is not None:
                rgb = cached
            else:
                mix = tmap[..., None]
                rgb = np.ascontiguousarray(
                    ((c0 * (1 - mix) + c1 * mix) * 255).astype(np.uint8))
                if kind != 'noise':
                    cached = rgb
            frame = av.VideoFrame.from_ndarray(rgb, format='rgb24')
            frame = frame.reformat(format='yuv420p')
            frame.pts = int(round(t / _OUT_TB))
            frame.time_base = _OUT_TB
            for pkt in enc.encode(frame):
                outp.mux(pkt)
            if progress is not None and i % 30 == 0:
                progress(i, n, "generating")
        for pkt in enc.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


__all__ = ['generate_pattern_video', 'PATTERN_KINDS', 'RAMP_INTERPS']
