
import math

import numpy as np

from .media import get_video_info
from .media_torch import torch_process_video


def _stamp(mask: np.ndarray, cx: float, cy: float, radius: float,
           hardness: float):
    h, w = mask.shape
    r = max(1.0, radius)
    x0 = max(0, int(cx - r - 1))
    x1 = min(w, int(cx + r + 2))
    y0 = max(0, int(cy - r - 1))
    y1 = min(h, int(cy + r + 2))
    if x1 <= x0 or y1 <= y0:
        return
    ys, xs = np.mgrid[y0:y1, x0:x1]
    d = np.hypot(xs - cx, ys - cy) / r
    inner = max(0.0, min(0.99, hardness))
    a = np.clip((1.0 - d) / max(1e-6, 1.0 - inner), 0.0, 1.0)
    a[d <= inner] = 1.0
    np.maximum(mask[y0:y1, x0:x1], a.astype(np.float32),
               out=mask[y0:y1, x0:x1])


def rasterize_stroke(points, w, h, radius=20.0, hardness=0.5) -> np.ndarray:
    mask = np.zeros((h, w), dtype=np.float32)
    pts = [(float(p['x']), float(p['y']), float(p.get('p', 1.0)))
           for p in points or []]
    if not pts:
        return mask
    if len(pts) == 1:
        x, y, p = pts[0]
        _stamp(mask, x, y, radius * max(0.05, p), hardness)
        return mask
    for i in range(len(pts) - 1):
        x0, y0, p0 = pts[i]
        x1, y1, p1 = pts[i + 1]
        dist = math.hypot(x1 - x0, y1 - y0)
        spacing = max(1.0, radius * 0.25)
        n = max(1, int(dist / spacing))
        for k in range(n + 1):
            f = k / max(1, n)
            _stamp(mask,
                   x0 + (x1 - x0) * f, y0 + (y1 - y0) * f,
                   radius * max(0.05, p0 + (p1 - p0) * f), hardness)
    return mask


def _hex_rgb(s):
    s = (s or '#FF0000').lstrip('#')
    return tuple(int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def paint_video(view_url: str, strokes, *, t_start=0.0, t_end=-1.0,
                progress=None) -> str:
    import torch

    info = get_video_info(view_url)
    w, h = info['width'], info['height']
    prepared = []
    for s in strokes or []:
        pts = s.get('points') or []
        if not pts:
            continue
        mask_np = rasterize_stroke(
            pts, w, h,
            radius=min(300.0, max(1.0, float(s.get('radius') or 20))),
            hardness=float(s.get('hardness') or 0.5))
        prepared.append({
            'mode': str(s.get('mode') or 'clone'),
            'mask': mask_np,
            'dx': float(s.get('dx') or 0.0),
            'dy': float(s.get('dy') or 0.0),
            'sigma': min(50.0, max(0.5, float(s.get('sigma') or 8.0))),
            'color': _hex_rgb(s.get('color')),
        })
    if not prepared:
        raise RuntimeError("paint: no strokes")

    masks_t = {}

    def _mask_for(s, device):
        key = id(s)
        if key not in masks_t:
            masks_t[key] = torch.from_numpy(s['mask']).to(device).unsqueeze(-1)
        return masks_t[key]

    def _gauss_blur(img, sigma):
        r = max(1, int(sigma * 3))
        xs = torch.arange(-r, r + 1, dtype=torch.float32, device=img.device)
        k = torch.exp(-(xs ** 2) / (2 * sigma * sigma))
        k = (k / k.sum()).view(1, 1, 1, -1)
        c = img.permute(2, 0, 1).unsqueeze(0)
        pad = (r, r, 0, 0)
        c = torch.nn.functional.conv2d(
            torch.nn.functional.pad(c, pad, mode='reflect'),
            k.expand(c.shape[1], 1, 1, 2 * r + 1), groups=c.shape[1])
        pad = (0, 0, r, r)
        c = torch.nn.functional.conv2d(
            torch.nn.functional.pad(c, pad, mode='reflect'),
            k.view(1, 1, -1, 1).expand(c.shape[1], 1, 2 * r + 1, 1),
            groups=c.shape[1])
        return c.squeeze(0).permute(1, 2, 0)

    end = float(t_end) if (t_end is not None and float(t_end) > 0) else 1e12

    def frame_fn(img, t):
        if t < t_start or t > end:
            return img
        out = img
        for s in prepared:
            m = _mask_for(s, img.device)
            if s['mode'] == 'clone':
                src = torch.roll(out, shifts=(int(round(s['dy'])),
                                              int(round(s['dx']))),
                                 dims=(0, 1))
                out = src * m + out * (1 - m)
            elif s['mode'] == 'blur':
                out = _gauss_blur(out, s['sigma']) * m + out * (1 - m)
            elif s['mode'] == 'color':
                col = torch.tensor(s['color'], device=img.device,
                                   dtype=out.dtype).view(1, 1, 3)
                out = col * m + out * (1 - m)
        return out

    return torch_process_video(view_url, frame_fn, progress=progress)


__all__ = ['rasterize_stroke', 'paint_video']
