import json
import math

import numpy as np

from .media import get_video_info
from .media_torch import torch_process_video, _warp_frame, mat_transform_canonical
from .keyframes import KeyframeCurve

LUMA_R, LUMA_G, LUMA_B = 0.2126, 0.7152, 0.0722


def _curve_lut(points, default=1.0, size=256, device='cpu'):
    import torch
    if not points or len(points) < 2:
        return torch.full((size,), float(default), device=device)
    keys = [{'t': float(p[0]), 'v': float(p[1]), 'interp': 'smooth'}
            for p in sorted(points)]
    curve = KeyframeCurve(keys, extrapolate='constant')
    xs = np.linspace(0.0, 1.0, size)
    vals = np.array([curve.value(x) for x in xs], dtype=np.float32)
    return torch.from_numpy(vals).to(device)


def _sample_lut(lut, coord):
    import torch
    idx = (coord.clamp(0, 1) * (lut.shape[0] - 1))
    lo = idx.floor().long()
    hi = (lo + 1).clamp(max=lut.shape[0] - 1)
    f = idx - lo.float()
    return lut[lo] * (1 - f) + lut[hi] * f


def hue_correct_video(view_url: str, curves_raw: str, *,
                      sat_thrsh: float = 0.0, luminance_mix: float = 0.0,
                      progress=None) -> str:
    import torch
    import kornia.color

    try:
        curves = json.loads(curves_raw) if (curves_raw or '').strip() else {}
    except (ValueError, TypeError):
        curves = {}
    if not isinstance(curves, dict) or not any(
            isinstance(v, list) and len(v) >= 2 for v in curves.values()):
        raise RuntimeError("hue correct: no curves set — bend one first")

    luts = {}

    def frame_fn(img, t):
        device = img.device
        if not luts:
            for name, default in (('sat', 1.0), ('lum', 1.0),
                                  ('red', 1.0), ('green', 1.0), ('blue', 1.0),
                                  ('r_sup', 1.0), ('g_sup', 1.0), ('b_sup', 1.0),
                                  ('hue', 1.0)):
                luts[name] = _curve_lut(curves.get(name), default,
                                        device=device)
        rgb = img.permute(2, 0, 1).unsqueeze(0).clamp(0, 1)
        hsv = kornia.color.rgb_to_hsv(rgb)
        h0 = (hsv[0, 0] / (2 * math.pi)).clamp(0, 1)
        hx = h0 * 6 + 1
        hx = torch.where(hx > 6, hx - 6, hx) / 6.0
        s = hsv[0, 1]
        lum_in = (img[..., 0] * LUMA_R + img[..., 1] * LUMA_G
                  + img[..., 2] * LUMA_B)

        hue_shift = _sample_lut(luts['hue'], hx)
        if (hue_shift - 1.0).abs().max() > 1e-6:
            h1 = h0 + (hue_shift - 1.0) / 2.0
            h1 = h1 - h1.floor()
            hsv2 = hsv.clone()
            hsv2[0, 0] = h1 * 2 * math.pi
            rgb = kornia.color.hsv_to_rgb(hsv2)
        out = rgb[0].permute(1, 2, 0)

        r, g, b = out[..., 0], out[..., 1], out[..., 2]
        for ch, other1, other2, key in ((0, 1, 2, 'r_sup'),
                                        (1, 0, 2, 'g_sup'),
                                        (2, 0, 1, 'b_sup')):
            sup = _sample_lut(luts[key], hx)
            mn = torch.minimum(out[..., other1], out[..., other2])
            c = out[..., ch]
            out[..., ch] = torch.where(c > mn, mn + sup * (c - mn), c)

        lum_gain = _sample_lut(luts['lum'], hx)
        gains = [_sample_lut(luts[k], hx) * lum_gain
                 for k in ('red', 'green', 'blue')]
        thr = max(0.0, min(1.0, float(sat_thrsh)))
        for ch, gain in enumerate(gains):
            c = out[..., ch]
            if thr > 0:
                factor = torch.where(
                    s > thr, (thr + (s - thr) * gain) / s.clamp(min=1e-6),
                    torch.ones_like(gain))
                out[..., ch] = c * factor
            else:
                out[..., ch] = c * gain

        sat_gain = _sample_lut(luts['sat'], hx)
        l_sat = (out[..., 0] * LUMA_R + out[..., 1] * LUMA_G
                 + out[..., 2] * LUMA_B).unsqueeze(-1)
        out = l_sat * (1 - sat_gain.unsqueeze(-1)) + out * sat_gain.unsqueeze(-1)

        mixv = max(0.0, min(1.0, float(luminance_mix)))
        if mixv > 0:
            lum_out = (out[..., 0] * LUMA_R + out[..., 1] * LUMA_G
                       + out[..., 2] * LUMA_B).clamp(min=1e-6)
            f = 1 + mixv * (lum_in / lum_out - 1)
            out = out * f.unsqueeze(-1)
        return out.clamp(0, 1)

    return torch_process_video(view_url, frame_fn, progress=progress)


def _gauss(img, sigma):
    import torch
    r = max(1, int(sigma * 2.5))
    xs = torch.arange(-r, r + 1, dtype=torch.float32, device=img.device)
    k = torch.exp(-(xs ** 2) / (2 * sigma * sigma))
    k = k / k.sum()
    c = img.permute(2, 0, 1).unsqueeze(0)
    c = torch.nn.functional.conv2d(
        torch.nn.functional.pad(c, (r, r, 0, 0), mode='reflect'),
        k.view(1, 1, 1, -1).expand(c.shape[1], 1, 1, 2 * r + 1),
        groups=c.shape[1])
    c = torch.nn.functional.conv2d(
        torch.nn.functional.pad(c, (0, 0, r, r), mode='reflect'),
        k.view(1, 1, -1, 1).expand(c.shape[1], 1, 2 * r + 1, 1),
        groups=c.shape[1])
    return c.squeeze(0).permute(1, 2, 0)


def glow_video(view_url: str, *, threshold: float = 0.7, size: float = 4.0,
               bloom_ratio: float = 2.0, bloom_count: int = 5,
               gain: float = 1.0, mix: float = 1.0, progress=None) -> str:
    import torch

    thr = max(0.0, min(0.99, float(threshold)))
    count = max(1, min(8, int(bloom_count)))
    ratio = max(1.1, min(4.0, float(bloom_ratio)))
    base = max(0.5, min(50.0, float(size)))

    def frame_fn(img, t):
        luma = (img[..., 0] * LUMA_R + img[..., 1] * LUMA_G
                + img[..., 2] * LUMA_B)
        m = ((luma - thr) / max(1e-6, 1.0 - thr)).clamp(0, 1).unsqueeze(-1)
        src = img * m
        bloom = torch.zeros_like(img)
        for i in range(count):
            bloom = bloom + _gauss(src, base * (ratio ** i))
        out = (img + bloom * (float(gain) / count)).clamp(0, 1)
        mv = max(0.0, min(1.0, float(mix)))
        return img * (1 - mv) + out * mv

    return torch_process_video(view_url, frame_fn, progress=progress)


def god_rays_video(view_url: str, *, translate_x: float = 0.0,
                   translate_y: float = 0.0, scale: float = 1.4,
                   rotate_deg: float = 0.0, steps: int = 5,
                   decay: float = 0.3, max_mode: bool = False,
                   mix: float = 1.0, progress=None) -> str:
    import torch

    info = get_video_info(view_url)
    cx, cy = info['width'] / 2.0, info['height'] / 2.0
    n = 1 << max(1, min(7, int(steps)))
    col1 = 1.0
    col2 = max(0.001, min(1.0, float(decay)))
    weights = [col1 * (col2 / col1) ** (i / n) for i in range(n)]

    mats = []
    base_scale = max(0.2, float(scale))
    for i in range(n):
        f = i / n
        s = base_scale ** f
        m = mat_transform_canonical(
            float(translate_x) * f, -float(translate_y) * f, s, s, 0.0, 0.0,
            -math.radians(float(rotate_deg) * f), cx, cy)
        mats.append(np.linalg.inv(m))

    def frame_fn(img, t):
        acc = None
        for i in range(n):
            wf = _warp_frame(img, mats[i], img.device) * weights[i]
            if max_mode:
                acc = wf if acc is None else torch.maximum(acc, wf)
            else:
                acc = wf if acc is None else acc + wf
        rays = acc if max_mode else acc / n
        mv = max(0.0, min(1.0, float(mix)))
        return (img * (1 - mv) + rays.clamp(0, 1) * mv)

    return torch_process_video(view_url, frame_fn, progress=progress)


__all__ = ['hue_correct_video', 'glow_video', 'god_rays_video']
