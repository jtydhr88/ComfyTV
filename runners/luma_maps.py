import math

import numpy as np

LUMA_MAP_KINDS = ['linear_x', 'linear_y', 'bilinear_x', 'bilinear_y',
                  'radial', 'square', 'diamond', 'clock', 'symmetric_clock',
                  'spiral', 'burst', 'curtain', 'blinds_h', 'blinds_v',
                  'checker', 'cloud']


def luma_map(kind: str, w: int, h: int, seed: int = 7) -> np.ndarray:
    if kind not in LUMA_MAP_KINDS:
        raise RuntimeError(f"luma map: unknown kind {kind!r}")
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = xs / max(1, w - 1)
    ny = ys / max(1, h - 1)
    cx = (nx - 0.5) * 2
    cy = (ny - 0.5) * 2
    r = np.hypot(cx, cy) / math.sqrt(2)
    ang = (np.arctan2(cx, -cy) / (2 * math.pi)) % 1.0

    if kind == 'linear_x':
        out = nx
    elif kind == 'linear_y':
        out = ny
    elif kind == 'bilinear_x':
        out = np.abs(cx)
    elif kind == 'bilinear_y':
        out = np.abs(cy)
    elif kind == 'radial':
        out = np.clip(np.hypot(cx, cy), 0, 1)
    elif kind == 'square':
        out = np.maximum(np.abs(cx), np.abs(cy))
    elif kind == 'diamond':
        out = np.clip((np.abs(cx) + np.abs(cy)) / 2 * 1.999, 0, 1)
    elif kind == 'clock':
        out = ang
    elif kind == 'symmetric_clock':
        out = np.minimum(ang, 1.0 - ang) * 2
    elif kind == 'spiral':
        out = (ang + np.clip(np.hypot(cx, cy), 0, 1) * 2.0) % 1.0
    elif kind == 'burst':
        ripple = 0.85 + 0.15 * np.sin(ang * 2 * math.pi * 8)
        out = np.clip(np.hypot(cx, cy) * ripple, 0, 1)
    elif kind == 'curtain':
        out = 1.0 - np.abs(cx)
    elif kind == 'blinds_h':
        out = (ny * 8) % 1.0
    elif kind == 'blinds_v':
        out = (nx * 8) % 1.0
    elif kind == 'checker':
        cells_x = (nx * 8).astype(np.int64)
        cells_y = (ny * 4.5).astype(np.int64)
        parity = ((cells_x + cells_y) % 2).astype(np.float32)
        sub = ((nx * 8) % 1.0) * 0.5
        out = parity * 0.5 + sub
    else:
        from .procedural import fbm3, perm_table
        perm = perm_table(int(seed))
        v = fbm3(xs / (min(w, h) / 3.0), ys / (min(w, h) / 3.0),
                 np.float64(0.0), perm, octaves=4)
        out = np.clip(v * 0.75 + 0.5, 0, 1)

    out = out.astype(np.float32)
    lo = float(out.min())
    hi = float(out.max())
    if hi - lo > 1e-6:
        out = (out - lo) / (hi - lo)
    return out


def luma_map_image_url(kind: str, w: int, h: int, seed: int = 7) -> str:
    from PIL import Image
    from .media import fresh_output_path, path_to_view_url

    arr = (luma_map(kind, int(w), int(h), seed) * 255).astype(np.uint8)
    out = fresh_output_path('.png')
    Image.fromarray(arr, mode='L').save(str(out))
    return path_to_view_url(out)


def shape_mask_alpha(m, threshold: float, softness: float, invert: bool):
    import torch

    thr = float(threshold)
    soft = max(1e-4, float(softness) * 0.5)
    lo = thr - soft
    x = ((m - lo) / (2 * soft)).clamp(0, 1)
    alpha = 1.0 - x * x * (3 - 2 * x)
    if invert:
        alpha = 1.0 - alpha
    return alpha if isinstance(alpha, torch.Tensor) else alpha


def build_shape_mask_fn(map_for, duration, *, threshold=0.5, softness=0.1,
                        invert=False, animate='static', output='stencil'):
    duration = max(1e-6, float(duration))

    def fn(img, t):
        m = map_for(img)
        thr = float(threshold)
        soft = float(softness)
        if animate != 'static':
            prog = min(1.0, max(0.0, float(t) / duration))
            if animate == 'sweep_out':
                prog = 1.0 - prog
            half = max(1e-4, soft * 0.5)
            thr = -half + (1.0 + 2 * half) * prog
        alpha = shape_mask_alpha(m, thr, soft, invert)
        if output == 'matte':
            return alpha.unsqueeze(-1).expand(
                img.shape[0], img.shape[1], 3).clone()
        return img * alpha.unsqueeze(-1)

    return fn


def shape_mask_video(view_url: str, map_url: str, *, threshold=0.5,
                     softness=0.1, invert=False, animate='static',
                     output='stencil', progress=None) -> str:
    import torch
    from PIL import Image
    from .media import localize, get_video_info
    from .media_torch import torch_process_video

    src = Image.open(str(localize(map_url))).convert('L')
    info = get_video_info(view_url)
    cache = {}

    def map_for(img):
        key = (img.shape[0], img.shape[1])
        if key not in cache:
            m = np.asarray(src.resize((key[1], key[0])),
                           dtype=np.float32) / 255.0
            cache[key] = torch.from_numpy(m).to(img.device)
        return cache[key]

    fn = build_shape_mask_fn(
        map_for, float(info.get('duration') or 0.0),
        threshold=threshold, softness=softness, invert=invert,
        animate=animate, output=output)
    return torch_process_video(view_url, fn, progress=progress)


__all__ = ['LUMA_MAP_KINDS', 'luma_map', 'luma_map_image_url',
           'shape_mask_alpha', 'build_shape_mask_fn', 'shape_mask_video']
