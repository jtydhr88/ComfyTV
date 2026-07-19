
import math

import numpy as np

from .media import localize, get_video_info
from .media_filter import make_progress
from .media_torch import torch_process_video, _warp_frame

CONTRAST_THRESHOLD = 0.25


def _luma(frame, device):
    import torch
    arr = frame.to_ndarray(format='rgb24').astype(np.float32)
    t = torch.from_numpy(arr).to(device)
    return t[..., 0] * 0.299 + t[..., 1] * 0.587 + t[..., 2] * 0.114


def _box_blur(img, k):
    import torch
    if k <= 1:
        return img
    pad = k // 2
    x = img.unsqueeze(0).unsqueeze(0)
    x = torch.nn.functional.avg_pool2d(
        torch.nn.functional.pad(x, (pad, pad, pad, pad), mode='replicate'),
        kernel_size=k, stride=1)
    return x[0, 0]


def _init_fields(w, h, step_size):
    min_dim = min(w, h)
    max_shift = max(16, min_dim // 7)
    field_size = max(16, min_dim // 10)
    rows = max(3, (h - max_shift * 2) // field_size - 1)
    cols = max(3, (w - max_shift * 2) // field_size - 1)
    border = field_size // 2 + max_shift + step_size
    fields = []
    if cols > 1 and rows > 1 and w > 2 * border and h > 2 * border:
        sx = (w - 2 * border) / (cols - 1)
        sy = (h - 2 * border) / (rows - 1)
        for j in range(rows):
            for i in range(cols):
                fields.append((border + i * sx, border + j * sy))
    return fields, field_size, max_shift


def _contrast(img, cx, cy, size):
    s2 = size // 2
    x0, y0 = int(cx - s2), int(cy - s2)
    patch = img[y0:y0 + size, x0:x0 + size]
    mx = float(patch.max())
    mn = float(patch.min())
    return (mx - mn) / (mx + mn + 0.1)


def _sad(prev, cur, cx, cy, size, dx, dy):
    s2 = size // 2
    x0, y0 = int(cx - s2), int(cy - s2)
    a = cur[y0:y0 + size, x0:x0 + size]
    b = prev[y0 + dy:y0 + dy + size, x0 + dx:x0 + dx + size]
    if b.shape != a.shape:
        return float('inf')
    return float((a - b).abs().sum())


def _match_field(prev, cur, cx, cy, size, max_shift, step):
    best = (0, 0)
    best_err = float('inf')
    for dy in range(-max_shift, max_shift + 1, step):
        for dx in range(-max_shift, max_shift + 1, step):
            e = _sad(prev, cur, cx, cy, size, dx, dy)
            if e < best_err:
                best_err = e
                best = (dx, dy)
    cur_step = step
    while cur_step > 1:
        cur_step //= 2
        r = step - cur_step
        bx, by = best
        for dy in range(by - r, by + r + 1, cur_step):
            for dx in range(bx - r, bx + r + 1, cur_step):
                if (dx, dy) == best:
                    continue
                e = _sad(prev, cur, cx, cy, size, dx, dy)
                if e < best_err:
                    best_err = e
                    best = (dx, dy)
    return best


def _cleanmean(values):
    if not values:
        return 0.0
    vs = sorted(values)
    cut = len(vs) // 5
    core = vs[cut:len(vs) - cut] or vs
    return sum(core) / len(core)


def _motions_to_transform(motions, w, h, field_size):
    if not motions:
        return 0.0, 0.0, 0.0
    center_x = sum(m[0] for m in motions) / len(motions)
    center_y = sum(m[1] for m in motions) / len(motions)
    tx = _cleanmean([m[2] for m in motions])
    ty = _cleanmean([m[3] for m in motions])

    alpha = 0.0
    if len(motions) >= 6:
        angles = []
        for fx, fy, vx, vy in motions:
            rx, ry = fx - center_x, fy - center_y
            if abs(rx) + abs(ry) < field_size * 2:
                angles.append(0.0)
                continue
            a1 = math.atan2(ry, rx)
            a2 = math.atan2(ry + (vy - ty), rx + (vx - tx))
            d = a2 - a1
            if d > math.pi:
                d -= 2 * math.pi
            elif d < -math.pi:
                d += 2 * math.pi
            angles.append(d)
        srt = sorted(angles)
        cut = len(srt) // 5
        if srt[len(srt) - cut - 1] - srt[cut] <= 1.0:
            alpha = -_cleanmean(angles)

    px = center_x - w / 2.0
    py = center_y - h / 2.0
    ca, sa = math.cos(alpha), math.sin(alpha)
    tx += (ca - 1) * px - sa * py
    ty += sa * px + (ca - 1) * py
    return tx, ty, alpha


def _gaussian_smooth(path, smoothing):
    if smoothing <= 0:
        return [list(p) for p in path]
    s = smoothing * 2 + 1
    mu = smoothing
    sigma2 = max(1e-6, (mu / 2.0) ** 2)
    kernel = [math.exp(-((i - mu) ** 2) / sigma2) for i in range(s)]
    out = []
    n = len(path)
    for i in range(n):
        acc = [0.0, 0.0, 0.0]
        wsum = 0.0
        for k in range(s):
            idx = i + k - mu
            if 0 <= idx < n:
                wgt = kernel[k]
                wsum += wgt
                for c in range(3):
                    acc[c] += path[idx][c] * wgt
        out.append([a / wsum for a in acc] if wsum > 0 else list(path[i]))
    return out


def _required_zoom(tx, ty, alpha, w, h):
    return 100.0 * (2.0 * max(abs(tx) / w, abs(ty) / h) + abs(math.sin(alpha)))


def _optimal_static_zoom(comps, w, h):
    if not comps:
        return 0.0
    xs = sorted(abs(c[0]) for c in comps)
    ys = sorted(abs(c[1]) for c in comps)
    cut = max(0, len(xs) // 100)
    mx = xs[len(xs) - 1 - cut]
    my = ys[len(ys) - 1 - cut]
    zoom = 100.0 * max(2.0 * mx / w, 2.0 * my / h)
    for c in comps:
        zoom = max(zoom, 100.0 * abs(math.sin(c[2])))
    return zoom


def _comp_matrix(tx, ty, alpha, zoom, cx, cy):
    z = 1.0 - zoom / 100.0
    zc = z * math.cos(-alpha)
    zs = z * math.sin(-alpha)
    return np.array([
        [zc, zs, -zc * cx - zs * cy + cx - tx],
        [-zs, zc, zs * cx - zc * cy + cy - ty],
        [0.0, 0.0, 1.0],
    ])


def stabilize_video(view_url: str, *, smoothing: int = 15,
                    accuracy: int = 15, step_size: int = 6,
                    opt_zoom: bool = True, extra_zoom: float = 0.0,
                    progress=None) -> str:
    import av
    import torch

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    src = localize(view_url)
    info = get_video_info(view_url)
    w, h = info['width'], info['height']
    fields, field_size, max_shift = _init_fields(w, h, step_size)
    if not fields:
        raise RuntimeError("stabilize: frame too small for measurement fields")
    max_fields = max(6, (min(15, max(1, int(accuracy))) * len(fields)) // 15)
    total_est = max(1, int(info['duration'] * info['fps']))
    report_analyze = make_progress(progress, total_est, "analyze 1/2")

    rel = [(0.0, 0.0, 0.0)]
    with av.open(str(src)) as inp:
        prev = None
        n = 0
        for frame in inp.decode(inp.streams.video[0]):
            g = _box_blur(_luma(frame, device), step_size)
            if prev is not None:
                ranked = sorted(
                    ((_contrast(g, fx, fy, field_size), fx, fy)
                     for fx, fy in fields),
                    reverse=True)[:max_fields]
                motions = []
                for c, fx, fy in ranked:
                    if c < CONTRAST_THRESHOLD:
                        continue
                    dx, dy = _match_field(prev, g, fx, fy, field_size,
                                          max_shift, step_size)
                    motions.append((fx, fy, float(dx), float(dy)))
                rel.append(_motions_to_transform(motions, w, h, field_size))
            prev = g
            n += 1
            report_analyze(n)

    absolute = []
    acc = [0.0, 0.0, 0.0]
    for r in rel:
        acc = [acc[0] + r[0], acc[1] + r[1], acc[2] + r[2]]
        absolute.append(list(acc))
    smoothed = _gaussian_smooth(absolute, max(0, int(smoothing)))
    comps = [(a[0] - s[0], a[1] - s[1], a[2] - s[2])
             for a, s in zip(absolute, smoothed)]

    zoom = float(extra_zoom or 0.0)
    if opt_zoom:
        zoom += _optimal_static_zoom(comps, w, h)
    zoom = min(40.0, zoom)

    cx, cy = w / 2.0, h / 2.0
    mats = [_comp_matrix(tx, ty, al, zoom, cx, cy) for tx, ty, al in comps]
    report_render = make_progress(progress, total_est, "render 2/2")
    idx = {'i': 0}

    def frame_fn(tensor, t):
        i = min(idx['i'], len(mats) - 1)
        idx['i'] += 1
        report_render(min(idx['i'], total_est))
        return _warp_frame(tensor, mats[i], tensor.device)

    return torch_process_video(view_url, frame_fn)


__all__ = ['stabilize_video']
