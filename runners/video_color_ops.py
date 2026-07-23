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


HUE_LUT_DEFAULTS = (('sat', 1.0), ('lum', 1.0),
                    ('red', 1.0), ('green', 1.0), ('blue', 1.0),
                    ('r_sup', 1.0), ('g_sup', 1.0), ('b_sup', 1.0),
                    ('hue', 1.0),
                    ('sat_sat', 1.0), ('lum_lum', 1.0))


def build_hue_luts(curves, device='cpu'):
    return {name: _curve_lut(curves.get(name), default, device=device)
            for name, default in HUE_LUT_DEFAULTS}


def hue_correct_frame(img, luts, sat_thrsh=0.0, luminance_mix=0.0):
    import torch
    import kornia.color

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

    ss_lut = luts.get('sat_sat')
    if ss_lut is not None and (ss_lut - 1.0).abs().max() > 1e-6:
        ss_gain = _sample_lut(ss_lut, s).unsqueeze(-1)
        l_ss = (out[..., 0] * LUMA_R + out[..., 1] * LUMA_G
                + out[..., 2] * LUMA_B).unsqueeze(-1)
        out = l_ss + ss_gain * (out - l_ss)

    ll_lut = luts.get('lum_lum')
    if ll_lut is not None and (ll_lut - 1.0).abs().max() > 1e-6:
        l_cur = (out[..., 0] * LUMA_R + out[..., 1] * LUMA_G
                 + out[..., 2] * LUMA_B)
        out = out * _sample_lut(ll_lut, l_cur).unsqueeze(-1)

    mixv = max(0.0, min(1.0, float(luminance_mix)))
    if mixv > 0:
        lum_out = (out[..., 0] * LUMA_R + out[..., 1] * LUMA_G
                   + out[..., 2] * LUMA_B).clamp(min=1e-6)
        f = 1 + mixv * (lum_in / lum_out - 1)
        out = out * f.unsqueeze(-1)
    return out.clamp(0, 1)


def hue_correct_video(view_url: str, curves_raw: str, *,
                      sat_thrsh: float = 0.0, luminance_mix: float = 0.0,
                      progress=None) -> str:
    try:
        curves = json.loads(curves_raw) if (curves_raw or '').strip() else {}
    except (ValueError, TypeError):
        curves = {}
    if not isinstance(curves, dict) or not any(
            isinstance(v, list) and len(v) >= 2 for v in curves.values()):
        raise RuntimeError("hue correct: no curves set — bend one first")

    luts = {}

    def frame_fn(img, t):
        if not luts:
            luts.update(build_hue_luts(curves, device=img.device))
        return hue_correct_frame(img, luts, sat_thrsh=sat_thrsh,
                                 luminance_mix=luminance_mix)

    return torch_process_video(view_url, frame_fn, progress=progress)


def cdl_frame(img, slope, offset, power, saturation=1.0):
    import torch

    s = torch.tensor(slope, dtype=img.dtype, device=img.device)
    o = torch.tensor(offset, dtype=img.dtype, device=img.device)
    p = torch.tensor(power, dtype=img.dtype, device=img.device)
    out = (img * s + o).clamp(0.0, 1.0)
    out = out.pow(p)
    sat = float(saturation)
    if sat != 1.0:
        luma = (out[..., 0] * LUMA_R + out[..., 1] * LUMA_G
                + out[..., 2] * LUMA_B).unsqueeze(-1)
        out = luma + sat * (out - luma)
    return out.clamp(0, 1)


def histeq_frame(img, strength=1.0, clip_limit=0.0):
    import torch

    y = (img[..., 0] * LUMA_R + img[..., 1] * LUMA_G
         + img[..., 2] * LUMA_B).clamp(0, 1)
    hist = torch.histc(y, bins=256, min=0.0, max=1.0)
    if clip_limit > 0:
        cap = clip_limit * y.numel() / 256.0
        excess = (hist - cap).clamp(min=0).sum()
        hist = hist.clamp(max=cap) + excess / 256.0
    cdf = torch.cumsum(hist, dim=0)
    total = cdf[-1].clamp(min=1.0)
    cdf_min = cdf[cdf > 0][0] if (cdf > 0).any() else cdf[0]
    lut = ((cdf - cdf_min) / (total - cdf_min).clamp(min=1.0)).clamp(0, 1)
    idx = (y * 255.0).round().long().clamp(0, 255)
    y_eq = lut[idx]
    k = max(0.0, min(1.0, float(strength)))
    y_new = y * (1 - k) + y_eq * k
    gain = ((y_new + 1e-6) / (y + 1e-6)).clamp(0.0, 8.0).unsqueeze(-1)
    return (img * gain).clamp(0, 1)


__all__ = ['hue_correct_video', 'build_hue_luts', 'hue_correct_frame',
           'cdl_frame', 'histeq_frame']
