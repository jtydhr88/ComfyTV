import math
from fractions import Fraction

import numpy as np

from .media import fresh_output_path, path_to_view_url
from .media_filter import make_progress

_OUT_TB = Fraction(1, 90000)

PATTERN_KINDS = ['ramp', 'radial', 'rectangle', 'noise', 'perlin',
                 'turbulence', 'cellular', 'plasma', 'checkerboard',
                 'colorbars', 'colorwheel', 'count']
RAMP_INTERPS = ['linear', 'smooth', 'ease_in', 'ease_out']

_IRE_ROWS_X = [240, 446, 652, 858, 1062, 1268, 1474, 1680]


def _colorbars_rgb(w, h, intensity=75.0):
    out = np.zeros((h, w, 3), dtype=np.float32)
    xs = (np.arange(w) * 1920 // max(1, w))
    ys_img = np.arange(h)
    yhd = (h - 1 - ys_img) * 1080 // max(1, h)

    def paint(row_mask, bounds, colors):
        prev = 0
        for bx, col in zip(bounds + [1921], colors):
            cmask = row_mask[:, None] & ((xs >= prev) & (xs < bx))[None, :]
            for c in range(3):
                out[..., c][cmask] = col[c]
            prev = bx

    paint(yhd >= 450, _IRE_ROWS_X,
          [(40, 40, 40), (75, 75, 75), (75, 75, 0), (0, 75, 75),
           (0, 75, 0), (75, 0, 75), (75, 0, 0), (0, 0, 75),
           (40, 40, 40)])
    if intensity != 75.0:
        scale = intensity / 75.0
        row = (yhd >= 450)[:, None]
        for c in range(3):
            out[..., c] = np.where(row, out[..., c] * scale, out[..., c])
    paint((yhd >= 360) & (yhd < 450), [240, 446, 1680],
          [(0, 100, 100), (100, 100, 100), (75, 75, 75), (0, 0, 100)])
    paint((yhd >= 270) & (yhd < 360), [240, 446, 1474, 1680],
          [(100, 100, 0), (0, 0, 0), (0, 0, 0), (100, 100, 100),
           (100, 0, 0)])
    ramp_mask = ((yhd >= 270) & (yhd < 360))[:, None] & \
        ((xs >= 446) & (xs < 1474))[None, :]
    ramp_vals = 100.0 * (xs - 446) / float(1474 - 446)
    for c in range(3):
        out[..., c] = np.where(ramp_mask, ramp_vals[None, :], out[..., c])
    paint(yhd < 270, [240, 548, 960, 1130, 1198, 1268, 1336, 1406, 1474,
                      1680],
          [(15, 15, 15), (0, 0, 0), (100, 100, 100), (0, 0, 0), (-2, -2, -2),
           (0, 0, 0), (2, 2, 2), (0, 0, 0), (4, 4, 4), (0, 0, 0),
           (15, 15, 15)])
    out = np.maximum(out, 0.0)
    return np.clip(16.0 / 255.0 + (235.0 - 16.0) / 255.0 * out / 100.0, 0, 1)


def _colorwheel_rgb(w, h, *, gamma=0.45, rotate=0.0, center_sat=0.0,
                    edge_sat=1.0, center_val=1.0, edge_val=1.0):
    import colorsys
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w / 2.0, h / 2.0
    r = min(w, h) / 2.0
    dx = (xs - cx) / r
    dy = (ys - cy) / r
    d = np.sqrt(dx * dx + dy * dy)
    hue = np.arccos(np.clip(np.where(d > 0, dx / np.maximum(d, 1e-9), 1.0),
                            -1, 1)) / (2 * math.pi)
    hue = np.where(-dy > 0, 1.0 - hue, hue)
    hue = hue + rotate / 360.0
    hue = hue - np.floor(hue)
    sat = np.clip(center_sat + d * (edge_sat - center_sat), 0, 1)
    val = np.clip(center_val + d * (edge_val - center_val), 0, 1)
    hp = (hue * 6.0)
    i = np.floor(hp).astype(np.int32) % 6
    f = hp - np.floor(hp)
    p = val * (1 - sat)
    q = val * (1 - sat * f)
    tt = val * (1 - sat * (1 - f))
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    conds = [(i == 0, (val, tt, p)), (i == 1, (q, val, p)),
             (i == 2, (p, val, tt)), (i == 3, (p, q, val)),
             (i == 4, (tt, p, val)), (i == 5, (val, p, q))]
    for cond, (rr, gg, bb) in conds:
        rgb[..., 0] = np.where(cond, rr, rgb[..., 0])
        rgb[..., 1] = np.where(cond, gg, rgb[..., 1])
        rgb[..., 2] = np.where(cond, bb, rgb[..., 2])
    if gamma <= 0:
        rgb = (rgb >= 1.0).astype(np.float32)
    elif gamma != 1.0:
        rgb = np.power(np.clip(rgb, 0, 1), 1.0 / gamma)
    edge = np.clip(r * (1.0 - d) + 0.5, 0, 1)
    return rgb * edge[..., None]


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


def _count_frame(w, h, t, duration, fps, style, direction, c0, c1):
    from PIL import Image, ImageDraw, ImageFont
    from .text_overlay import _font_path

    bg = tuple(int(v * 255) for v in c0)
    fg = tuple(int(v * 255) for v in c1)
    img = Image.new('RGB', (w, h), bg)
    d = ImageDraw.Draw(img)
    cx, cy = w / 2.0, h / 2.0

    frac = t - math.floor(t)
    angle_deg = frac * 360.0
    rad = min(w, h) * 0.45
    d.pieslice([cx - rad, cy - rad, cx + rad, cy + rad],
               -90, -90 + angle_deg, fill=tuple(
                   int(v * 0.5 + b * 0.5) for v, b in zip(fg, bg)))
    lw = max(2, min(w, h) // 180)
    for rr in (rad, rad * 0.85):
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=fg, width=lw)
    d.line([0, cy, w, cy], fill=fg, width=lw)
    d.line([cx, 0, cx, h], fill=fg, width=lw)

    if style == 'frames':
        total = int(duration * fps)
        val = int(round(t * fps))
        num = total - val if direction == 'down' else val
        label = str(max(0, num))
    else:
        total = int(math.ceil(duration))
        val = int(t)
        num = total - val if direction == 'down' else val + 1
        label = str(max(0, num))
    path = _font_path('')
    fsize = int(min(w, h) * 0.5)
    fnt = ImageFont.truetype(path, size=fsize) if path \
        else ImageFont.load_default()
    box = d.textbbox((0, 0), label, font=fnt)
    d.text((cx - (box[2] - box[0]) / 2 - box[0],
            cy - (box[3] - box[1]) / 2 - box[1]),
           label, font=fnt, fill=fg)
    return np.asarray(img, dtype=np.uint8)


def ken_burns_video(image_url: str, *, width: int = 1280, height: int = 720,
                    fps: int = 24, duration: float = 5.0,
                    start_zoom: float = 1.0, end_zoom: float = 1.3,
                    start_x: float = 0.5, start_y: float = 0.5,
                    end_x: float = 0.5, end_y: float = 0.5,
                    interp: str = 'smooth', progress=None) -> str:
    import av
    import torch
    from PIL import Image
    from .media import localize

    w = max(16, int(width)) & ~1
    h = max(16, int(height)) & ~1
    fps = max(1, min(120, int(fps)))
    n = max(1, int(float(duration) * fps))

    src = Image.open(str(localize(image_url))).convert('RGB')
    arr = torch.from_numpy(
        np.asarray(src, dtype=np.float32) / 255.0).permute(2, 0, 1).unsqueeze(0)
    ih, iw = arr.shape[2], arr.shape[3]
    report = make_progress(progress, n, "ken burns")

    out = fresh_output_path('.mp4')
    with av.open(str(out), 'w') as outp:
        enc = outp.add_stream('libx264', rate=fps)
        enc.width, enc.height = w, h
        enc.pix_fmt = 'yuv420p'
        enc.codec_context.time_base = _OUT_TB
        from .media_filter import tag_bt709
        tag_bt709(enc.codec_context)
        for i in range(n):
            t = i / fps
            f = _shape_t(min(1.0, i / max(1, n - 1)), interp)
            zoom = max(1.0, start_zoom + (end_zoom - start_zoom) * f)
            cxn = start_x + (end_x - start_x) * f
            cyn = start_y + (end_y - start_y) * f
            half_w = 0.5 / zoom
            cxn = min(max(cxn, half_w), 1 - half_w)
            cyn = min(max(cyn, half_w), 1 - half_w)
            gy = torch.linspace(cyn - half_w, cyn + half_w, h) * 2 - 1
            gx = torch.linspace(cxn - half_w, cxn + half_w, w) * 2 - 1
            grid = torch.stack(
                torch.meshgrid(gy, gx, indexing='ij')[::-1], dim=-1
            ).unsqueeze(0)
            sampled = torch.nn.functional.grid_sample(
                arr, grid, mode='bilinear', padding_mode='border',
                align_corners=False)
            rgb = (sampled.squeeze(0).permute(1, 2, 0).clamp(0, 1)
                   * 255).byte().numpy()
            frame = av.VideoFrame.from_ndarray(
                np.ascontiguousarray(rgb), format='rgb24')
            frame = frame.reformat(format='yuv420p', dst_colorspace='ITU709')
            frame.pts = int(round(t / _OUT_TB))
            frame.time_base = _OUT_TB
            for pkt in enc.encode(frame):
                outp.mux(pkt)
            report(i + 1)
        for pkt in enc.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


def generate_pattern_video(kind: str, *, width: int = 1280, height: int = 720,
                           fps: int = 24, duration: float = 5.0,
                           color0: str = '#000000', color1: str = '#FFFFFF',
                           p0=(0.0, 0.5), p1=(1.0, 0.5),
                           interp: str = 'linear', softness: float = 0.0,
                           noise_scale: int = 64, noise_octaves: int = 4,
                           noise_speed: float = 1.0, seed: int = 7,
                           box_size: int = 64, bar_intensity: float = 75.0,
                           wheel_gamma: float = 0.45, wheel_rotate: float = 0.0,
                           count_style: str = 'seconds',
                           count_direction: str = 'down',
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
    static_rgb = None
    if kind == 'checkerboard':
        bs = max(2, int(box_size))
        idx = ((xs // bs).astype(np.int64) + (ys // bs).astype(np.int64)) % 2
        static = idx.astype(np.float32)
    elif kind == 'colorbars':
        static_rgb = _colorbars_rgb(w, h, float(bar_intensity))
    elif kind == 'colorwheel':
        static_rgb = _colorwheel_rgb(w, h, gamma=float(wheel_gamma),
                                     rotate=float(wheel_rotate))
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

    report = make_progress(progress, n, "generating")
    out = fresh_output_path('.mp4')
    with av.open(str(out), 'w') as outp:
        enc = outp.add_stream('libx264', rate=fps)
        enc.width, enc.height = w, h
        enc.pix_fmt = 'yuv420p'
        enc.codec_context.time_base = _OUT_TB
        from .media_filter import tag_bt709
        tag_bt709(enc.codec_context)
        cached = None
        perm = None
        for i in range(n):
            t = i / fps
            if kind == 'count':
                rgb = _count_frame(w, h, t, float(duration), fps,
                                   count_style, count_direction, c0, c1)
            elif kind == 'noise':
                tmap = _value_noise(w, h, int(noise_scale),
                                    int(noise_octaves), int(seed),
                                    t * float(noise_speed))
                mix = tmap[..., None]
                rgb = np.ascontiguousarray(
                    ((c0 * (1 - mix) + c1 * mix) * 255).astype(np.uint8))
            elif kind in ('perlin', 'turbulence'):
                from .procedural import fbm3, perm_table
                if perm is None:
                    perm = perm_table(int(seed))
                s = max(4.0, float(noise_scale))
                val = fbm3(xs / s, ys / s,
                           np.float64(t * float(noise_speed) * 0.5),
                           perm, octaves=int(noise_octaves),
                           turbulence=(kind == 'turbulence'))
                if kind == 'turbulence':
                    tmap = np.clip(val * 1.8, 0, 1)
                else:
                    tmap = np.clip(val * 0.75 + 0.5, 0, 1)
                mix = tmap[..., None]
                rgb = np.ascontiguousarray(
                    ((c0 * (1 - mix) + c1 * mix) * 255).astype(np.uint8))
            elif kind == 'cellular':
                from .procedural import cellular2
                s = max(4.0, float(noise_scale))
                tmap = cellular2(xs / s, ys / s,
                                 t * float(noise_speed) * 0.15, int(seed))
                mix = tmap[..., None]
                rgb = np.ascontiguousarray(
                    ((c0 * (1 - mix) + c1 * mix) * 255).astype(np.uint8))
            elif kind == 'plasma':
                from .procedural import plasma_field
                tmap = plasma_field(xs, ys, t * float(noise_speed),
                                    float(noise_scale))
                mix = tmap[..., None]
                rgb = np.ascontiguousarray(
                    ((c0 * (1 - mix) + c1 * mix) * 255).astype(np.uint8))
            elif cached is not None:
                rgb = cached
            elif static_rgb is not None:
                rgb = np.ascontiguousarray(
                    (static_rgb * 255).astype(np.uint8))
                cached = rgb
            else:
                mix = static[..., None]
                rgb = np.ascontiguousarray(
                    ((c0 * (1 - mix) + c1 * mix) * 255).astype(np.uint8))
                cached = rgb
            frame = av.VideoFrame.from_ndarray(rgb, format='rgb24')
            frame = frame.reformat(format='yuv420p', dst_colorspace='ITU709')
            frame.pts = int(round(t / _OUT_TB))
            frame.time_base = _OUT_TB
            for pkt in enc.encode(frame):
                outp.mux(pkt)
            report(i + 1)
        for pkt in enc.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


__all__ = ['generate_pattern_video', 'ken_burns_video', 'PATTERN_KINDS',
           'RAMP_INTERPS']
