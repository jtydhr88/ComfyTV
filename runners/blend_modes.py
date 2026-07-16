
import torch


def _multiply(A, B, a, b):
    return torch.where((A < 0) & (B < 0), A, A * B)


def _screen(A, B, a, b):
    return torch.where((A <= 1) | (B <= 1), A + B - A * B, torch.maximum(A, B))


def _hard_light(A, B, a, b):
    return torch.where(2 * A < 1, _multiply(2 * A, B, a, b),
                       _screen(2 * A - 1, B, a, b))


def _soft_light(A, B, a, b):
    low = B - (1 - 2 * A) * B * (1 - B)
    mid = B + (2 * A - 1) * (((16 * B - 12) * B + 4) * B - B)
    high = B + (2 * A - 1) * (torch.sqrt(B.clamp(min=0)) - B)
    return torch.where(2 * A <= 1, low, torch.where(4 * B <= 1, mid, high))


def _color_dodge(A, B, a, b):
    safe = (1 - A).clamp(min=1e-12)
    return torch.where(A >= 1, A, torch.minimum(torch.ones_like(A), B / safe))


def _color_burn(A, B, a, b):
    safe = A.clamp(min=1e-12)
    return torch.where(A <= 0, A,
                       1 - torch.minimum(torch.ones_like(A), (1 - B) / safe))


def _pin_light(A, B, a, b):
    return torch.where(A >= 0.5, torch.maximum(B, (A - 0.5) * 2),
                       torch.minimum(B, A * 2))


def _reflect(A, B, a, b):
    safe = (1 - B).clamp(min=1e-12)
    return torch.where(B >= 1, torch.ones_like(A),
                       torch.minimum(torch.ones_like(A), A * A / safe))


def _freeze(A, B, a, b):
    safe = B.clamp(min=1e-12)
    val = (1 - torch.sqrt((1 - A).clamp(min=0)) / safe).clamp(min=0)
    return torch.where(B <= 0, torch.zeros_like(A), val)


def _divide(A, B, a, b):
    return torch.where(B <= 0, torch.zeros_like(A), A / B.clamp(min=1e-12))


def _geometric(A, B, a, b):
    s = A + B
    return torch.where(s == 0, torch.zeros_like(A), 2 * A * B / torch.where(s == 0, torch.ones_like(s), s))


def _conjoint_over(A, B, a, b):
    safe_b = b.clamp(min=1e-12)
    return torch.where(a > b, A,
                       torch.where(b <= 0, A + B, A + B * (1 - a / safe_b)))


def _disjoint_over(A, B, a, b):
    safe_b = b.clamp(min=1e-12)
    return torch.where(a >= 1, A,
                       torch.where(a + b < 1, A + B,
                                   torch.where(b <= 0, A + B * (1 - a),
                                               A + B * (1 - a) / safe_b)))


_SEPARABLE = {
    'atop':          lambda A, B, a, b: A * b + B * (1 - a),
    'average':       lambda A, B, a, b: (A + B) / 2,
    'color-burn':    _color_burn,
    'color-dodge':   _color_dodge,
    'conjoint-over': _conjoint_over,
    'copy':          lambda A, B, a, b: A,
    'difference':    lambda A, B, a, b: (A - B).abs(),
    'disjoint-over': _disjoint_over,
    'divide':        _divide,
    'exclusion':     lambda A, B, a, b: A + B - 2 * A * B,
    'freeze':        _freeze,
    'from':          lambda A, B, a, b: B - A,
    'geometric':     _geometric,
    'grain-extract': lambda A, B, a, b: B - A + 0.5,
    'grain-merge':   lambda A, B, a, b: B + A - 0.5,
    'hard-light':    _hard_light,
    'hypot':         lambda A, B, a, b: torch.sqrt(A * A + B * B),
    'in':            lambda A, B, a, b: A * b,
    'mask':          lambda A, B, a, b: B * a,
    'matte':         lambda A, B, a, b: A * a + B * (1 - a),
    'max':           lambda A, B, a, b: torch.maximum(A, B),
    'min':           lambda A, B, a, b: torch.minimum(A, B),
    'minus':         lambda A, B, a, b: A - B,
    'multiply':      _multiply,
    'out':           lambda A, B, a, b: A * (1 - b),
    'over':          lambda A, B, a, b: A + B * (1 - a),
    'overlay':       lambda A, B, a, b: _hard_light(B, A, b, a),
    'pinlight':      _pin_light,
    'plus':          lambda A, B, a, b: A + B,
    'reflect':       _reflect,
    'screen':        _screen,
    'soft-light':    _soft_light,
    'stencil':       lambda A, B, a, b: B * (1 - a),
    'under':         lambda A, B, a, b: A * (1 - b) + B,
    'xor':           lambda A, B, a, b: A * (1 - b) + B * (1 - a),
}

_PD_ALPHA = {'atop', 'copy', 'in', 'mask', 'out', 'over',
             'stencil', 'under', 'xor', 'conjoint-over', 'disjoint-over'}


def _lum(c):
    return c[..., 0:1] * 0.3 + c[..., 1:2] * 0.59 + c[..., 2:3] * 0.11


def _clip_color(c, a):
    l = _lum(c)
    n = c.amin(dim=-1, keepdim=True)
    x = c.amax(dim=-1, keepdim=True)
    t_lo = (l - n).clamp(min=1e-12)
    below = torch.where(n < 0, l + (c - l) * l / t_lo, c)
    below = torch.where((n < 0) & (l - n < 1e-12), torch.zeros_like(c), below)
    t_hi = (x - l).clamp(min=1e-12)
    above = torch.where(x > a, l + (below - l) * (a - l) / t_hi, below)
    above = torch.where((x > a) & (x - l < 1e-12), a.expand_as(c), above)
    return above


def _set_lum(c, a, l):
    return _clip_color(c + (l - _lum(c)), a)


def _sat(c):
    return c.amax(dim=-1, keepdim=True) - c.amin(dim=-1, keepdim=True)


def _set_sat(c, s):
    vals, idx = torch.sort(c, dim=-1)
    mn, md, mx = vals[..., 0:1], vals[..., 1:2], vals[..., 2:3]
    t = (mx - mn)
    safe_t = t.clamp(min=1e-12)
    new_md = torch.where(t.abs() < 1e-12, torch.zeros_like(md),
                         (md - mn) * s / safe_t)
    new_mx = torch.where(t.abs() < 1e-12, torch.zeros_like(mx), s)
    new_mn = torch.zeros_like(mn)
    out_sorted = torch.cat([new_mn, new_md, new_mx], dim=-1)
    out = torch.zeros_like(c)
    return out.scatter(-1, idx, out_sorted)


def _hsl_blend(op, src, dest, sa, da):
    if op == 'hue':
        res = src * da
        res = _set_sat(res, _sat(dest) * sa)
        return _set_lum(res, sa * da, _lum(dest) * sa)
    if op == 'saturation':
        res = dest * sa
        res = _set_sat(res, _sat(src) * da)
        return _set_lum(res, sa * da, _lum(dest) * sa)
    if op == 'color':
        res = src * da
        return _set_lum(res, sa * da, _lum(dest) * sa)
    if op == 'luminosity':
        res = dest * sa
        return _set_lum(res, sa * da, _lum(src) * da)
    raise ValueError(op)


HSL_MODES = ('hue', 'saturation', 'color', 'luminosity')
MERGE_OPERATORS = sorted(list(_SEPARABLE.keys()) + list(HSL_MODES))


def merge(A: torch.Tensor, B: torch.Tensor, op: str) -> torch.Tensor:
    a = A[..., 3:4]
    b = B[..., 3:4]

    if op in HSL_MODES:
        src = A[..., :3] / a.clamp(min=1e-6)
        dest = B[..., :3] / b.clamp(min=1e-6)
        src = torch.where(a > 1e-6, src, torch.zeros_like(src))
        dest = torch.where(b > 1e-6, dest, torch.zeros_like(dest))
        R = _hsl_blend(op, src, dest, a, b)
        rgb = (1 - a) * B[..., :3] + (1 - b) * A[..., :3] + R
        alpha = a + b - a * b
        return torch.cat([rgb, alpha], dim=-1)

    fn = _SEPARABLE.get(op)
    if fn is None:
        raise ValueError(f"unknown merge operator {op!r}")
    rgb = fn(A[..., :3], B[..., :3], a, b)
    if op in _PD_ALPHA:
        alpha = fn(a, b, a, b)
    else:
        alpha = a + b - a * b
    return torch.cat([rgb, alpha], dim=-1)


__all__ = ['merge', 'MERGE_OPERATORS', 'HSL_MODES']
