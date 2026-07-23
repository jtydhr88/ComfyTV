import math

import numpy as np

from .media import localize
from .media_torch import torch_process_video
from .temporal import _windowed_process

SLITSCAN_MODES = ('horizontal', 'vertical', 'map')
SLITSCAN_FILTERS = ('nearest', 'linear')
FEEDBACK_MODES = ('vertigo', 'echo', 'nervous')
NERVOUS_STYLES = ('shuffle', 'scratch')
STROBE_MODES = ('black', 'hold', 'white')

_MASK64 = (1 << 64) - 1
_MAX_WINDOW = 240


def _mix64(z):
    z = (z + 0x9E3779B97F4A7C15) & _MASK64
    z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & _MASK64
    z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & _MASK64
    return (z ^ (z >> 31)) & _MASK64


def _rint(seed, frame, k, lo, hi):
    if hi <= lo:
        return lo
    h = _mix64((int(seed) + 1) * 0x9E3779B97F4A7C15)
    h = _mix64(h ^ ((int(frame) + 1) * 0xBF58476D1CE4E5B9))
    h = _mix64(h ^ ((int(k) + 1) * 0x94D049BB133111EB))
    return lo + h % (hi - lo + 1)


def _load_gray_image(url):
    from PIL import Image

    path = localize(url)
    with Image.open(str(path)) as im:
        return np.asarray(im.convert('L'), dtype=np.float32) / 255.0


def slitscan_video(view_url: str, *, mode: str = 'horizontal',
                   gain: float = 24.0, offset: float = 0.0,
                   filter_mode: str = 'linear', invert: bool = False,
                   map_url: str = '', progress=None) -> str:
    import torch

    if mode not in SLITSCAN_MODES:
        raise RuntimeError(f"slitscan: unknown mode {mode!r}")
    if filter_mode not in SLITSCAN_FILTERS:
        raise RuntimeError(f"slitscan: unknown filter {filter_mode!r}")
    if mode == 'map' and not (map_url or '').strip():
        raise RuntimeError("slitscan: map mode needs a retime image")

    g = max(-float(_MAX_WINDOW), min(float(_MAX_WINDOW), float(gain)))
    off = max(-60.0, min(60.0, float(offset)))
    tmin = min(0.0, g) + off
    tmax = max(0.0, g) + off
    back = max(0, int(math.ceil(-tmin)) + 1)
    fwd = max(0, int(math.ceil(tmax)) + 1)
    if back + fwd > _MAX_WINDOW:
        raise RuntimeError(
            f"slitscan: window too large ({back + fwd} frames, "
            f"max {_MAX_WINDOW}) — reduce gain/offset")

    gray = _load_gray_image(map_url) if mode == 'map' else None
    map_cache = {}

    def retime_map(h, w, device):
        key = (h, w)
        if key not in map_cache:
            if mode == 'horizontal':
                ramp = torch.linspace(1.0, 0.0, h, device=device)
                m = ramp.unsqueeze(1).expand(h, w).contiguous()
            elif mode == 'vertical':
                ramp = torch.linspace(0.0, 1.0, w, device=device)
                m = ramp.unsqueeze(0).expand(h, w).contiguous()
            else:
                t = torch.from_numpy(gray).to(device)
                m = torch.nn.functional.interpolate(
                    t.unsqueeze(0).unsqueeze(0), size=(h, w),
                    mode='bilinear', align_corners=False)[0, 0]
            if invert:
                m = 1.0 - m
            map_cache[key] = m
        return map_cache[key]

    def emit_fn(tensor_at, center, lo_idx, hi_idx, device):
        base = tensor_at(center)
        h, w = base.shape[0], base.shape[1]
        rt = retime_map(h, w, base.device)
        st = center + rt * g + off
        frames = {}

        def at(f):
            if f not in frames:
                frames[f] = tensor_at(f)
            return frames[f]

        out = torch.zeros_like(base)
        if filter_mode == 'nearest':
            fi = torch.round(st).long().clamp(lo_idx, hi_idx)
            for f in range(int(fi.min()), int(fi.max()) + 1):
                m = (fi == f)
                if m.any():
                    out = out + at(f) * m.unsqueeze(-1)
        else:
            f0 = torch.floor(st).long()
            frac = (st - f0.float()).clamp(0.0, 1.0)
            f0 = f0.clamp(lo_idx, hi_idx)
            f1 = (f0 + 1).clamp(lo_idx, hi_idx)
            for f in range(int(f0.min()), int(f1.max()) + 1):
                wgt = (f0 == f).float() * (1.0 - frac) \
                    + (f1 == f).float() * frac
                if float(wgt.max()) > 0:
                    out = out + at(f) * wgt.unsqueeze(-1)
        return out.clamp(0, 1)

    return _windowed_process(view_url, back, fwd, emit_fn, progress=progress)


def _affine_warp(img, scale, angle, shift_x, shift_y):
    import torch

    h, w = img.shape[0], img.shape[1]
    ca = math.cos(angle) / max(1e-6, scale)
    sa = math.sin(angle) / max(1e-6, scale)
    aspect = w / max(1, h)
    theta = torch.tensor(
        [[ca, -sa / aspect, -2.0 * shift_x / max(1, w)],
         [sa * aspect, ca, -2.0 * shift_y / max(1, h)]],
        dtype=img.dtype, device=img.device).unsqueeze(0)
    src = img.permute(2, 0, 1).unsqueeze(0)
    grid = torch.nn.functional.affine_grid(theta, src.shape,
                                           align_corners=False)
    out = torch.nn.functional.grid_sample(
        src, grid, mode='bilinear', padding_mode='border',
        align_corners=False)
    return out.squeeze(0).permute(1, 2, 0)


def build_feedback_fn(params):
    mode = params.get('mode') or 'vertigo'
    if mode not in FEEDBACK_MODES:
        raise RuntimeError(f"feedback: unknown mode {mode!r}")
    seed = int(params.get('seed', 7))
    state = {}

    def st_for(img):
        key = (img.shape[0], img.shape[1], str(img.device))
        if key not in state:
            state[key] = {'frame': 0, 'feedback': None, 'planes': [],
                          'plane': 0, 'ring': [], 'timer': 0, 'stride': 1,
                          'readplane': 0, 'phase': 0.0}
        return state[key]

    def vertigo(img, s):
        pinc = max(0.0, min(1.0, float(params.get('phase_increment', 0.08))))
        zoom = max(-0.5, min(0.5, float(params.get('zoom', 0.06))))
        fb_mix = max(0.0, min(0.98, float(params.get('feedback_mix', 0.75))))
        if s['feedback'] is None:
            s['feedback'] = img.clone()
        phase = s['phase']
        dizz = math.sin(phase) * 10.0 + math.sin(phase * 1.9 + 5.0) * 5.0
        angle = dizz * 0.006
        wob_x = math.cos(phase * 5.0) * 2.0
        wob_y = math.sin(phase * 6.0) * 2.0
        warped = _affine_warp(s['feedback'], 1.0 + zoom, angle, wob_x, wob_y)
        out = (warped * fb_mix + img * (1.0 - fb_mix)).clamp(0, 1)
        s['feedback'] = out
        s['phase'] = phase + pinc
        return out

    def echo(img, s):
        n_planes = 32
        stride = 8
        if not s['planes']:
            q = (img * 0.25)
            s['planes'] = [q.clone() for _ in range(n_planes)]
        planes = s['planes']
        plane = s['plane']
        planes[plane] = img * 0.25
        cf = plane & (stride - 1)
        out = (planes[cf] + planes[cf + stride] + planes[cf + 2 * stride]
               + planes[cf + 3 * stride]).clamp(0, 1)
        planes[plane] = out * 0.25
        s['plane'] = (plane + 1) % n_planes
        return out

    def nervous(img, s):
        import torch

        n_planes = max(2, min(32, int(params.get('frames', 32))))
        style = params.get('style') or 'shuffle'
        ring = s['ring']
        ring.append((img * 255.0).round().to(dtype=torch.uint8))
        if len(ring) > n_planes:
            ring.pop(0)
        stock = len(ring)
        f = s['frame']
        if style == 'scratch':
            if s['timer'] > 0:
                s['readplane'] += s['stride']
                while s['readplane'] < 0:
                    s['readplane'] += stock
                while s['readplane'] >= stock:
                    s['readplane'] -= stock
                s['timer'] -= 1
            else:
                s['readplane'] = _rint(seed, f, 0, 0, stock - 1)
                stv = _rint(seed, f, 1, -2, 2)
                s['stride'] = stv + 1 if stv >= 0 else stv
                s['timer'] = _rint(seed, f, 2, 2, 7)
            idx = s['readplane'] % stock
        else:
            idx = _rint(seed, f, 0, 0, stock - 1)
        return ring[idx].to(dtype=img.dtype) / 255.0

    def fn(img, t):
        s = st_for(img)
        if mode == 'vertigo':
            out = vertigo(img, s)
        elif mode == 'echo':
            out = echo(img, s)
        else:
            out = nervous(img, s)
        s['frame'] += 1
        return out

    return fn


def build_strobe_fn(params):
    import torch

    interval = max(1, min(120, int(params.get('interval', 3))))
    invert = bool(params.get('invert', False))
    mode = params.get('strobe_mode') or 'black'
    if mode not in STROBE_MODES:
        raise RuntimeError(f"strobe: unknown mode {mode!r}")
    state = {}

    def fn(img, t):
        key = (img.shape[0], img.shape[1], str(img.device))
        s = state.setdefault(key, {'frame': 0, 'held': None})
        n = s['frame']
        s['frame'] = n + 1
        do_strobe = (n % (interval + 1)) > interval // 2
        if invert:
            do_strobe = not do_strobe
        if not do_strobe:
            s['held'] = img
            return img
        if mode == 'hold':
            return s['held'] if s['held'] is not None else img
        if mode == 'white':
            return torch.ones_like(img)
        return torch.zeros_like(img)

    return fn


def feedback_video(view_url: str, *, progress=None, **params) -> str:
    fn = build_feedback_fn(params)
    return torch_process_video(view_url, fn, progress=progress)


def strobe_video(view_url: str, *, progress=None, **params) -> str:
    fn = build_strobe_fn(params)
    return torch_process_video(view_url, fn, progress=progress)


__all__ = ['slitscan_video', 'build_feedback_fn', 'build_strobe_fn',
           'feedback_video', 'strobe_video',
           'SLITSCAN_MODES', 'SLITSCAN_FILTERS', 'FEEDBACK_MODES',
           'NERVOUS_STYLES', 'STROBE_MODES']
