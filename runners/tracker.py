
import json

import numpy as np

from .media import localize, get_video_info


def _gray(frame, device):
    import torch
    arr = frame.to_ndarray(format='rgb24').astype(np.float32) / 255.0
    t = torch.from_numpy(arr).to(device)
    return t[..., 0] * 0.299 + t[..., 1] * 0.587 + t[..., 2] * 0.114


def _patch(img, cx, cy, half):
    import torch
    device = img.device
    ys = torch.arange(-half, half + 1, dtype=torch.float32, device=device)
    xs = torch.arange(-half, half + 1, dtype=torch.float32, device=device)
    gy, gx = torch.meshgrid(ys + cy, xs + cx, indexing='ij')
    h, w = img.shape
    ngx = gx / max(w - 1, 1) * 2 - 1
    ngy = gy / max(h - 1, 1) * 2 - 1
    grid = torch.stack([ngx, ngy], dim=-1).unsqueeze(0)
    out = torch.nn.functional.grid_sample(
        img.unsqueeze(0).unsqueeze(0), grid, mode='bilinear',
        padding_mode='border', align_corners=True)
    return out[0, 0]


def _sad_search(img, template, cx, cy, radius, step=1):
    import torch
    best = None
    best_dxy = (0.0, 0.0)
    for dy in range(-radius, radius + 1, step):
        for dx in range(-radius, radius + 1, step):
            half = (template.shape[0] - 1) // 2
            cand = _patch(img, cx + dx, cy + dy, half)
            sad = (cand - template).abs().sum()
            if best is None or sad < best:
                best = sad
                best_dxy = (float(dx), float(dy))
    return best_dxy


def _klt_refine(img_prev, img_next, cx, cy, half, dx0=0.0, dy0=0.0,
                iterations=20):
    import torch
    tpl = _patch(img_prev, cx, cy, half)
    gx = torch.zeros_like(tpl)
    gy = torch.zeros_like(tpl)
    gx[:, 1:-1] = (tpl[:, 2:] - tpl[:, :-2]) / 2
    gy[1:-1, :] = (tpl[2:, :] - tpl[:-2, :]) / 2
    a11 = (gx * gx).sum()
    a12 = (gx * gy).sum()
    a22 = (gy * gy).sum()
    det = a11 * a22 - a12 * a12
    if float(det.abs()) < 1e-9:
        return dx0, dy0, False
    inv11, inv12, inv22 = a22 / det, -a12 / det, a11 / det

    dx, dy = float(dx0), float(dy0)
    for _ in range(iterations):
        cur = _patch(img_next, cx + dx, cy + dy, half)
        it = cur - tpl
        b1 = (gx * it).sum()
        b2 = (gy * it).sum()
        sx = float(inv11 * b1 + inv12 * b2)
        sy = float(inv12 * b1 + inv22 * b2)
        dx -= sx
        dy -= sy
        if abs(sx) < 0.01 and abs(sy) < 0.01:
            break
    return dx, dy, True


def _ncc(a, b) -> float:
    a0 = a - a.mean()
    b0 = b - b.mean()
    denom = float(((a0 * a0).sum() * (b0 * b0).sum()).sqrt())
    if denom < 1e-9:
        return 0.0
    return float((a0 * b0).sum()) / denom


MIN_CONFIDENCE = 0.15


def track_point(view_url: str, x: float, y: float, *,
                t_start: float = 0.0, t_end: float = -1.0,
                pattern_half: int = 12, search_radius: int = 24,
                levels: int = 3, progress=None) -> str:
    import av
    import torch

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    src = localize(view_url)
    info = get_video_info(view_url)
    if t_end is None or t_end < 0:
        t_end = info['duration']

    xs = [{'t': round(t_start, 3), 'v': float(x)}]
    ys = [{'t': round(t_start, 3), 'v': float(y)}]
    confidence = [{'t': round(t_start, 3), 'v': 1.0}]

    with av.open(str(src)) as inp:
        vstream = inp.streams.video[0]
        if vstream.time_base:
            try:
                inp.seek(int(t_start / float(vstream.time_base)),
                         stream=vstream, any_frame=False, backward=True)
            except Exception:
                pass
        prev_gray = None
        cx, cy = float(x), float(y)
        n = 0
        total_est = max(1, int((t_end - t_start) * info['fps']))
        for frame in inp.decode(vstream):
            t = float(frame.pts * frame.time_base) if frame.pts is not None else 0.0
            if t < t_start - 1e-4:
                continue
            if t > t_end + 1e-4:
                break
            g = _gray(frame, device)
            if prev_gray is not None:
                pyr_prev = [prev_gray]
                pyr_next = [g]
                for _ in range(levels - 1):
                    pyr_prev.append(torch.nn.functional.avg_pool2d(
                        pyr_prev[-1].unsqueeze(0).unsqueeze(0), 2)[0, 0])
                    pyr_next.append(torch.nn.functional.avg_pool2d(
                        pyr_next[-1].unsqueeze(0).unsqueeze(0), 2)[0, 0])

                scale = 2 ** (levels - 1)
                px, py = cx / scale, cy / scale
                half_c = max(3, pattern_half // scale)
                tpl = _patch(pyr_prev[-1], px, py, half_c)
                sdx, sdy = _sad_search(pyr_next[-1], tpl, px, py,
                                       max(2, search_radius // scale))
                dx, dy = sdx, sdy
                for lvl in range(levels - 1, -1, -1):
                    s = 2 ** lvl
                    lx, ly = cx / s, cy / s
                    rdx, rdy, ok = _klt_refine(
                        pyr_prev[lvl], pyr_next[lvl], lx, ly,
                        max(3, pattern_half // s), dx0=dx, dy0=dy)
                    if ok:
                        dx, dy = rdx, rdy
                    if lvl > 0:
                        dx *= 2
                        dy *= 2

                tpl_full = _patch(prev_gray, cx, cy, pattern_half)
                cand = _patch(g, cx + dx, cy + dy, pattern_half)
                conf = max(0.0, _ncc(tpl_full, cand))
                if conf >= MIN_CONFIDENCE:
                    cx += dx
                    cy += dy
                h, w = g.shape
                cx = float(min(max(cx, 0.0), w - 1))
                cy = float(min(max(cy, 0.0), h - 1))
                xs.append({'t': round(t, 3), 'v': round(cx, 2)})
                ys.append({'t': round(t, 3), 'v': round(cy, 2)})
                confidence.append({'t': round(t, 3), 'v': round(conf, 3)})
            prev_gray = g
            n += 1
            if progress is not None and n % 10 == 0:
                progress(min(n, total_est), total_est, "tracking")

    return json.dumps({'x': xs, 'y': ys, 'confidence': confidence,
                       'pattern_half': pattern_half, 'origin': [x, y]})


__all__ = ['track_point']
