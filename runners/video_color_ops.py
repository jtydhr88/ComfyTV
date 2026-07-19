import json
import math

import numpy as np

from .media_torch import torch_process_video
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


__all__ = ['hue_correct_video']
