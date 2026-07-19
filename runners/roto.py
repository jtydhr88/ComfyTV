
from fractions import Fraction

import numpy as np

from .media import localize, fresh_output_path, path_to_view_url, get_video_info
from .media_filter import make_progress

_OUT_TB = Fraction(1, 90000)


def bezier_eval(p0, p1, p2, p3, t):
    p0p1 = p0 + (p1 - p0) * t
    p1p2 = p1 + (p2 - p1) * t
    p2p3 = p2 + (p3 - p2) * t
    p0p1_p1p2 = p0p1 + (p1p2 - p0p1) * t
    p1p2_p2p3 = p1p2 + (p2p3 - p1p2) * t
    return p0p1_p1p2 + (p1p2_p2p3 - p0p1_p1p2) * t


def _segment_points(p0, p1, p2, p3):
    length = (abs(p1[0] - p0[0]) + abs(p1[1] - p0[1])
              + abs(p2[0] - p1[0]) + abs(p2[1] - p1[1])
              + abs(p3[0] - p2[0]) + abs(p3[1] - p2[1]))
    n = max(int(length * 0.25), 2)
    ts = np.linspace(0.0, 1.0, n, endpoint=False)
    xs = bezier_eval(p0[0], p1[0], p2[0], p3[0], ts)
    ys = bezier_eval(p0[1], p1[1], p2[1], p3[1], ts)
    return list(zip(xs.tolist(), ys.tolist()))


def polygonize(points) -> list:
    poly = []
    n = len(points)
    for i in range(n):
        cur = points[i]
        nxt = points[(i + 1) % n]
        p0 = (float(cur['x']), float(cur['y']))
        p1 = (float(cur.get('rx', cur['x'])), float(cur.get('ry', cur['y'])))
        p2 = (float(nxt.get('lx', nxt['x'])), float(nxt.get('ly', nxt['y'])))
        p3 = (float(nxt['x']), float(nxt['y']))
        poly.extend(_segment_points(p0, p1, p2, p3))
    return poly


def _interp_points(a, b, f):
    out = []
    for pa, pb in zip(a, b):
        out.append({k: float(pa.get(k, 0)) * (1 - f) + float(pb.get(k, 0)) * f
                    for k in ('x', 'y', 'lx', 'ly', 'rx', 'ry')})
    return out


def shape_at(shape_keys, t):
    keys = sorted(shape_keys, key=lambda k: k.get('t', 0.0))
    if not keys:
        return []
    if t <= keys[0].get('t', 0.0) or len(keys) == 1:
        return keys[0]['points']
    if t >= keys[-1].get('t', 0.0):
        return keys[-1]['points']
    for i in range(len(keys) - 1):
        t0, t1 = keys[i].get('t', 0.0), keys[i + 1].get('t', 0.0)
        if t0 <= t <= t1:
            if len(keys[i]['points']) != len(keys[i + 1]['points']):
                return keys[i]['points']
            f = (t - t0) / max(t1 - t0, 1e-9)
            return _interp_points(keys[i]['points'], keys[i + 1]['points'], f)
    return keys[-1]['points']


_SS = 4


def rasterize_mask(points, w, h, feather_px=0.0, invert=False) -> np.ndarray:
    from PIL import Image, ImageDraw

    poly = polygonize(points)
    if len(poly) < 3:
        mask = np.zeros((h, w), dtype=np.float32)
        return 1.0 - mask if invert else mask

    img = Image.new('L', (w * _SS, h * _SS), 0)
    ImageDraw.Draw(img).polygon([(x * _SS, y * _SS) for x, y in poly], fill=255)
    mask = np.asarray(
        img.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255.0

    f = float(feather_px or 0.0)
    if f > 0.25:
        from scipy.ndimage import distance_transform_edt
        hard = mask > 0.5
        d_out = distance_transform_edt(~hard)
        d_in = distance_transform_edt(hard)
        signed = np.where(hard, d_in, -d_out)
        mask = np.clip(signed / f + 1.0, 0.0, 1.0).astype(np.float32)

    if invert:
        mask = 1.0 - mask
    return mask


def roto_mask_video(ref_url: str, shape_keys, *, feather_px=0.0,
                    invert=False, progress=None) -> str:
    import av

    info = get_video_info(ref_url)
    w = info['width'] - (info['width'] % 2)
    h = info['height'] - (info['height'] % 2)
    fps = info['fps'] or 24
    n_frames = max(1, int(round(info['duration'] * fps)))
    animated = len({k.get('t', 0.0) for k in shape_keys}) > 1
    report = make_progress(progress, n_frames, "rasterizing")
    out = fresh_output_path('.mp4')

    with av.open(str(out), 'w') as outp:
        enc = outp.add_stream('libx264', rate=round(fps))
        enc.width, enc.height = w, h
        enc.pix_fmt = 'yuv420p'
        enc.codec_context.time_base = _OUT_TB

        cached = None
        for i in range(n_frames):
            t = i / fps
            if cached is None or animated:
                pts_now = shape_at(shape_keys, t)
                m = rasterize_mask(pts_now, w, h,
                                   feather_px=feather_px, invert=invert)
                cached = np.ascontiguousarray(
                    np.repeat((m * 255).astype(np.uint8)[..., None], 3, axis=2))
            frame = av.VideoFrame.from_ndarray(cached, format='rgb24')
            frame = frame.reformat(format='yuv420p')
            frame.pts = int(round(t / _OUT_TB))
            frame.time_base = _OUT_TB
            for pkt in enc.encode(frame):
                outp.mux(pkt)
            report(i + 1)
        for pkt in enc.encode():
            outp.mux(pkt)

    return path_to_view_url(out)


__all__ = ['bezier_eval', 'polygonize', 'shape_at', 'rasterize_mask',
           'roto_mask_video']
