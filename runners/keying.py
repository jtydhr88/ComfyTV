import numpy as np

from .media import localize
from .media_torch import torch_process_video

from ._matte_common import (  # noqa: F401
    LUMA_WEIGHTS,
    MATTE_OUTPUTS,
    _SideSource,
    _check_output,
    _luma,
    _luma_f,
    _matte_out,
    _parse_color,
)


def despill_video(view_url: str, *, screen: str = 'green',
                  spill_mix: float = 0.5, expand: float = 0.0,
                  red_scale: float = 0.0, green_scale: float = -1.0,
                  blue_scale: float = 0.0, brightness: float = 0.0,
                  clamp_black: bool = True, clamp_white: bool = False,
                  output_spillmap: bool = False, progress=None) -> str:
    import torch

    if screen not in ('green', 'blue'):
        raise RuntimeError(f"despill: unknown screen {screen!r}")

    def frame_fn(img, t):
        return despill_math(img, screen=screen, spill_mix=spill_mix,
                            expand=expand, red_scale=red_scale,
                            green_scale=green_scale, blue_scale=blue_scale,
                            brightness=brightness, clamp_black=clamp_black,
                            clamp_white=clamp_white,
                            output_spillmap=output_spillmap)

    return torch_process_video(view_url, frame_fn, progress=progress)


def despill_math(img, *, screen='green', spill_mix=0.5, expand=0.0,
                 red_scale=0.0, green_scale=-1.0, blue_scale=0.0,
                 brightness=0.0, clamp_black=True, clamp_white=False,
                 output_spillmap=False):
    import torch

    mixv = max(0.0, min(1.0, float(spill_mix)))
    exp = max(0.0, min(1.0, float(expand)))
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    if screen == 'green':
        spill = (g - (r * mixv + b * (1 - mixv)) * (1 - exp)).clamp(min=0)
    else:
        spill = (b - (r * mixv + g * (1 - mixv)) * (1 - exp)).clamp(min=0)
    out = torch.stack([
        r + spill * float(red_scale) + float(brightness) * spill,
        g + spill * float(green_scale) + float(brightness) * spill,
        b + spill * float(blue_scale) + float(brightness) * spill,
    ], dim=-1)
    if clamp_black:
        out = out.clamp(min=0)
    if clamp_white:
        out = out.clamp(max=1)
    if output_spillmap:
        return spill.unsqueeze(-1).expand_as(out).clamp(0, 1)
    return out


def color_suppress_video(view_url: str, *, red: float = 0.0,
                         green: float = 0.0, blue: float = 0.0,
                         cyan: float = 0.0, magenta: float = 0.0,
                         yellow: float = 0.0, preserve_luma: bool = False,
                         luminance_math: str = 'rec709',
                         output: str = 'image', progress=None) -> str:
    import torch

    if output not in ('image', 'matte'):
        raise RuntimeError(f"color suppress: unknown output {output!r}")

    def frame_fn(img, t):
        return color_suppress_math(img, red=red, green=green, blue=blue,
                                   cyan=cyan, magenta=magenta, yellow=yellow,
                                   preserve_luma=preserve_luma,
                                   luminance_math=luminance_math,
                                   output=output)

    return torch_process_video(view_url, frame_fn, progress=progress)


def color_suppress_math(img, *, red=0.0, green=0.0, blue=0.0, cyan=0.0,
                        magenta=0.0, yellow=0.0, preserve_luma=False,
                        luminance_math='rec709', output='image'):
    import torch

    r = img[..., 0].clone()
    g = img[..., 1].clone()
    b = img[..., 2].clone()
    modified = torch.zeros_like(r)
    luma1 = _luma(img, luminance_math) if preserve_luma else None

    if yellow != 0.0:
        cond = (b < g) & (b < r)
        d1 = (g - b) * float(yellow)
        d2 = (r - b) * float(yellow)
        d = torch.where(d1 > d2, d2, d1)
        g = torch.where(cond, g - d, g)
        r = torch.where(cond, r - d, r)
        modified = modified + torch.where(cond, d.abs(),
                                          torch.zeros_like(d))
    if magenta != 0.0:
        cond = (g < b) & (g < r)
        d1 = (b - g) * float(magenta)
        d2 = (r - g) * float(magenta)
        d = torch.where(d1 > d2, d2, d1)
        b = torch.where(cond, b - d, b)
        r = torch.where(cond, r - d, r)
        modified = modified + torch.where(cond, d.abs(),
                                          torch.zeros_like(d))
    if cyan != 0.0:
        cond = (r < g) & (r < b)
        d1 = (g - r) * float(cyan)
        d2 = (b - r) * float(cyan)
        d = torch.where(d1 > d2, d2, d1)
        g = torch.where(cond, g - d, g)
        b = torch.where(cond, b - d, b)
        modified = modified + torch.where(cond, d.abs(),
                                          torch.zeros_like(d))
    if red != 0.0:
        cond = (r > g) & (r > b)
        d = (r - torch.maximum(g, b)) * float(red)
        r = torch.where(cond, r - d, r)
        modified = modified + torch.where(cond, d.abs(),
                                          torch.zeros_like(d))
    if green != 0.0:
        cond = (g > b) & (g > r)
        d = (g - torch.maximum(b, r)) * float(green)
        g = torch.where(cond, g - d, g)
        modified = modified + torch.where(cond, d.abs(),
                                          torch.zeros_like(d))
    if blue != 0.0:
        cond = (b > g) & (b > r)
        d = (b - torch.maximum(g, r)) * float(blue)
        b = torch.where(cond, b - d, b)
        modified = modified + torch.where(cond, d.abs(),
                                          torch.zeros_like(d))

    out = torch.stack([r, g, b], dim=-1)
    if output == 'matte':
        return modified.unsqueeze(-1).expand_as(out).clamp(0, 1)
    if preserve_luma:
        out = out + (luma1 - _luma(out, luminance_math)).unsqueeze(-1)
    return out.clamp(0, 1)


KEYMIX_OPS = ('over', 'add', 'subtract', 'max', 'min')


def keymix_videos(a_url: str, b_url: str, mask_url: str, *,
                  mix: float = 1.0, invert_mask: bool = False,
                  alpha_op: str = 'over', progress=None) -> str:
    import torch

    if alpha_op not in KEYMIX_OPS:
        raise RuntimeError(f"keymix: unknown alpha op {alpha_op!r}")
    a_src = _SideSource(a_url)
    mask_src = _SideSource(mask_url)
    eff = max(0.0, min(1.0, float(mix)))

    def frame_fn(img, t):
        hw = (img.shape[0], img.shape[1])
        a_full = a_src.at(t, img.device, hw)
        a = a_full[..., :3]
        mk = mask_src.at(t, img.device, hw)
        m = mk[..., 3] if mk.shape[-1] == 4 else _luma(mk)
        m = m.clamp(0, 1)
        if invert_mask:
            m = 1 - m
        if alpha_op != 'over':
            aa = a_full[..., 3].clamp(0, 1) if a_full.shape[-1] == 4 \
                else torch.ones_like(m)
            if alpha_op == 'add':
                m = (aa + m).clamp(0, 1)
            elif alpha_op == 'subtract':
                m = (aa - m).clamp(0, 1)
            elif alpha_op == 'max':
                m = torch.maximum(aa, m)
            else:
                m = torch.minimum(aa, m)
        return img + (a - img) * (m * eff).unsqueeze(-1)

    try:
        return torch_process_video(b_url, frame_fn, progress=progress)
    finally:
        a_src.close()
        mask_src.close()


def matte_monitor_video(view_url: str, *, slope: float = 0.5,
                        progress=None) -> str:
    import av
    import torch

    src = localize(view_url)
    with av.open(str(src)) as c:
        cc = c.streams.video[0].codec_context
        alpha_in = 'a' in (cc.pix_fmt or '')

    s = max(0.0, min(1.0, float(slope)))

    def frame_fn(img, t):
        a = img[..., 3] if img.shape[-1] == 4 else _luma(img)
        stretched = torch.where((a > 0) & (a < 1), 0.5 + (a - 0.5) * s, a)
        return stretched.unsqueeze(-1).expand(img.shape[0], img.shape[1], 3)

    return torch_process_video(view_url, frame_fn, alpha_in=alpha_in,
                               progress=progress)


def morphology_math(img, *, op: str = 'erode', size_x: int = 1,
                    size_y: int = 1):
    import torch

    sx = max(0, min(64, int(size_x)))
    sy = max(0, min(64, int(size_y)))
    kx, ky = sx * 2 + 1, sy * 2 + 1

    def _minmax(t, maximum):
        c = t.permute(2, 0, 1).unsqueeze(0)
        c = torch.nn.functional.pad(c, (sx, sx, sy, sy), mode='replicate')
        if maximum:
            c = torch.nn.functional.max_pool2d(c, (ky, kx), stride=1)
        else:
            c = -torch.nn.functional.max_pool2d(-c, (ky, kx), stride=1)
        return c.squeeze(0).permute(1, 2, 0)

    if sx == 0 and sy == 0:
        return img
    if op == 'erode':
        return _minmax(img, False)
    if op == 'dilate':
        return _minmax(img, True)
    if op == 'open':
        return _minmax(_minmax(img, False), True)
    return _minmax(_minmax(img, True), False)


def morphology_video(view_url: str, *, op: str = 'erode',
                     size_x: int = 1, size_y: int = 1,
                     progress=None) -> str:
    if op not in ('erode', 'dilate', 'open', 'close'):
        raise RuntimeError(f"morphology: unknown op {op!r}")

    def frame_fn(img, t):
        return morphology_math(img, op=op, size_x=size_x, size_y=size_y)

    return torch_process_video(view_url, frame_fn, progress=progress)


def keyer_video(view_url: str, *, mode: str = 'luminance',
                key_color: str = '#000000',
                luminance_math: str = 'rec709',
                softness_lower: float = -0.5, tolerance_lower: float = 0.0,
                center: float = 1.0, tolerance_upper: float = 0.0,
                softness_upper: float = 0.5, despill: float = 1.0,
                despill_angle: float = 120.0,
                in_mask_url: str = '', out_mask_url: str = '',
                bg_url: str = '', output: str = 'matte',
                progress=None) -> str:
    import math
    import torch

    if mode not in ('luminance', 'color', 'screen', 'none'):
        raise RuntimeError(f"keyer: unknown mode {mode!r}")
    _check_output(output)
    if output == 'composite' and not (bg_url or '').strip():
        raise RuntimeError("keyer: composite output needs a background input")

    p = keyer_params(mode=mode, key_color=key_color,
                     luminance_math=luminance_math,
                     softness_lower=softness_lower,
                     tolerance_lower=tolerance_lower, center=center,
                     tolerance_upper=tolerance_upper,
                     softness_upper=softness_upper, despill=despill,
                     despill_angle=despill_angle)

    in_mask = _SideSource(in_mask_url) if (in_mask_url or '').strip() else None
    out_mask = _SideSource(out_mask_url) if (out_mask_url or '').strip() else None
    bg = _SideSource(bg_url) if (bg_url or '').strip() else None

    def _mask_at(src, t, device, hw):
        mk = src.at(t, device, hw)
        m = mk[..., 3] if mk.shape[-1] == 4 else _luma(mk)
        return m.clamp(0, 1)

    def frame_fn(img, t):
        device = img.device
        hw = (img.shape[0], img.shape[1])
        im = _mask_at(in_mask, t, device, hw) if in_mask is not None else None
        om = _mask_at(out_mask, t, device, hw) if out_mask is not None else None
        pre, alpha = keyer_math(img, p, in_mask_t=im, out_mask_t=om)
        if output == 'composite':
            bgt = bg.at(t, device, hw)[..., :3]
            return (pre + bgt * (1 - alpha).unsqueeze(-1)).clamp(0, 1)
        return _matte_out(pre, alpha, output)

    try:
        return torch_process_video(view_url, frame_fn,
                                   out_alpha=(output == 'alpha'),
                                   progress=progress)
    finally:
        for s in (in_mask, out_mask, bg):
            if s is not None:
                s.close()


def keyer_params(*, mode='luminance', key_color='#000000',
                 luminance_math='rec709', softness_lower=-0.5,
                 tolerance_lower=0.0, center=1.0, tolerance_upper=0.0,
                 softness_upper=0.5, despill=1.0, despill_angle=120.0):
    import math

    kc = _parse_color(key_color, default=(0.0, 0.0, 0.0))
    return {
        'mode': mode,
        'luminance_math': luminance_math,
        'kc': kc,
        'kc_sum': sum(kc),
        'kc_norm2': sum(v * v for v in kc),
        'tol_u': 1.0 if mode == 'screen' else float(tolerance_upper),
        'soft_u': 1.0 if mode == 'screen' else float(softness_upper),
        'soft_l': float(softness_lower),
        'tol_l': float(tolerance_lower),
        'ctr': float(center),
        'desp': (max(0.0, min(2.0, float(despill)))
                 if mode in ('screen', 'none') else 0.0),
        'closing': math.tan(
            (90 - 0.5 * max(0.0, min(180.0, float(despill_angle))))
            * math.pi / 180.0),
    }


def _keyer_key_bg(kfg, p):
    import torch

    ones = torch.ones_like(kfg)
    zeros = torch.zeros_like(kfg)
    a_pt = p['ctr'] + p['tol_l'] + p['soft_l']
    b_pt = p['ctr'] + p['tol_l']
    c_pt = p['ctr'] + p['tol_u']
    d_pt = p['ctr'] + p['tol_u'] + p['soft_u']
    out = torch.where(kfg < a_pt, zeros, ones)
    if p['soft_l'] < 0:
        ramp = (kfg - a_pt) / -p['soft_l']
        out = torch.where((kfg >= a_pt) & (kfg < b_pt), ramp, out)
    out = torch.where((kfg >= b_pt) & (kfg <= c_pt), ones, out)
    if p['soft_u'] > 0:
        ramp = (d_pt - kfg) / p['soft_u']
        out = torch.where((kfg > c_pt) & (kfg < d_pt), ramp, out)
    out = torch.where(kfg >= d_pt, zeros, out)
    if b_pt <= 0:
        out = torch.where(kfg <= 0, ones, out)
    if c_pt >= 1:
        out = torch.where(kfg >= 1, ones, out)
    return out.clamp(0, 1)


def keyer_math(img, p, in_mask_t=None, out_mask_t=None):
    import math
    import torch

    mode = p['mode']
    kc = p['kc']
    fg = img[..., :3]
    r, g, b = fg[..., 0], fg[..., 1], fg[..., 2]

    scalar = r * kc[0] + g * kc[1] + b * kc[2]
    if mode == 'luminance':
        kfg = _luma(fg, p['luminance_math'])
        d = None
    elif mode == 'color':
        kfg = (_luma(fg, p['luminance_math']) if p['kc_sum'] == 0
               else scalar / p['kc_sum'])
        d = None
    else:
        norm2 = r * r + g * g + b * b
        proj2 = (scalar * scalar / p['kc_norm2']) if p['kc_norm2'] > 0 else 0.0
        d = (norm2 - proj2).clamp(min=0).sqrt()
        kfg = (_luma(fg, p['luminance_math']) if p['kc_sum'] == 0
               else scalar / p['kc_sum']) - d

    if mode == 'none':
        kbg = torch.ones_like(r)
    else:
        kbg = _keyer_key_bg(kfg, p)

    if in_mask_t is not None:
        kbg = torch.where((in_mask_t > 0) & (kbg > 1 - in_mask_t),
                          1 - in_mask_t, kbg)
    if out_mask_t is not None:
        kbg = torch.where((out_mask_t > 0) & (kbg < out_mask_t),
                          out_mask_t, kbg)

    out = fg
    if p['desp'] > 0 and mode in ('screen', 'none') and p['kc_norm2'] > 0:
        kc_norm = math.sqrt(p['kc_norm2'])
        along = scalar / kc_norm
        cone = d * p['closing']
        maxdesp = (kbg * min(p['desp'], 1.0)
                   + (1 - kbg) * max(0.0, p['desp'] - 1.0))
        shift = maxdesp * torch.maximum(
            torch.full_like(along, kc_norm), along - cone)
        shift = torch.minimum(shift, along - cone)
        apply = (along > cone) & (shift > 0)
        shift = torch.where(apply, shift, torch.zeros_like(shift))
        out = torch.stack([
            out[..., 0] - shift * kc[0] / kc_norm,
            out[..., 1] - shift * kc[1] / kc_norm,
            out[..., 2] - shift * kc[2] / kc_norm,
        ], dim=-1)

    alpha = (1 - kbg).clamp(0, 1)
    pre = (out * alpha.unsqueeze(-1)).clamp(0, 1)
    return pre, alpha


def pik_video(view_url: str, *, screen: str = 'green',
              pick_color: str = '#00FF00', clean_plate_url: str = '',
              red_weight: float = 0.5, blue_green_weight: float = 0.5,
              alpha_bias: str = '#808080', despill_bias: str = '#808080',
              use_alpha_bias_for_despill: bool = True,
              screen_subtraction: bool = True, clamp_alpha: bool = True,
              clip_black: float = 0.0, clip_white: float = 1.0,
              replace_mode: str = 'soft', replace_color: str = '#808080',
              in_mask_url: str = '', out_mask_url: str = '',
              bg_url: str = '', output: str = 'alpha',
              progress=None) -> str:
    import torch

    if screen not in ('green', 'blue', 'pick'):
        raise RuntimeError(f"pik: unknown screen {screen!r}")
    if replace_mode not in ('none', 'source', 'hard', 'soft'):
        raise RuntimeError(f"pik: unknown replace mode {replace_mode!r}")
    _check_output(output)
    if output == 'composite' and not (bg_url or '').strip():
        raise RuntimeError("pik: composite output needs a background input")

    p = pik_params(screen=screen, pick_color=pick_color,
                   red_weight=red_weight,
                   blue_green_weight=blue_green_weight,
                   alpha_bias=alpha_bias, despill_bias=despill_bias,
                   use_alpha_bias_for_despill=use_alpha_bias_for_despill,
                   screen_subtraction=screen_subtraction,
                   clamp_alpha=clamp_alpha, clip_black=clip_black,
                   clip_white=clip_white, replace_mode=replace_mode,
                   replace_color=replace_color)
    ab = p['ab']
    use_pick = screen == 'pick'

    plate = (_SideSource(clean_plate_url)
             if (clean_plate_url or '').strip() and not use_pick else None)
    in_mask = _SideSource(in_mask_url) if (in_mask_url or '').strip() else None
    out_mask = _SideSource(out_mask_url) if (out_mask_url or '').strip() else None
    bg = _SideSource(bg_url) if (bg_url or '').strip() else None

    def _mask_at(src, t, device, hw):
        mk = src.at(t, device, hw)
        m = mk[..., 3] if mk.shape[-1] == 4 else _luma(mk)
        return m.clamp(0, 1)

    def frame_fn(img, t):
        device = img.device
        hw = (img.shape[0], img.shape[1])
        fg = img[..., :3]

        if plate is not None:
            cp = plate.at(t, device, hw)[..., :3]
            c = torch.stack([cp[..., i] / ab[i] for i in range(3)], dim=-1)
        else:
            c = torch.tensor(p['const_c'], dtype=torch.float32,
                             device=device).expand_as(fg)

        im = _mask_at(in_mask, t, device, hw) if in_mask is not None else None
        om = _mask_at(out_mask, t, device, hw) if out_mask is not None else None
        out, alpha = pik_math(img, p, c, in_mask_t=im, out_mask_t=om)

        if output == 'composite':
            bgt = bg.at(t, device, hw)[..., :3]
            return (out + bgt * (1 - alpha.unsqueeze(-1))).clamp(0, 1)
        return _matte_out(out, alpha, output)

    try:
        return torch_process_video(view_url, frame_fn,
                                   out_alpha=(output == 'alpha'),
                                   progress=progress)
    finally:
        for s in (plate, in_mask, out_mask, bg):
            if s is not None:
                s.close()


def pik_params(*, screen='green', pick_color='#00FF00', red_weight=0.5,
               blue_green_weight=0.5, alpha_bias='#808080',
               despill_bias='#808080', use_alpha_bias_for_despill=True,
               screen_subtraction=True, clamp_alpha=True, clip_black=0.0,
               clip_white=1.0, replace_mode='soft',
               replace_color='#808080'):
    ab = [max(1e-4, v) for v in _parse_color(alpha_bias, (0.5, 0.5, 0.5))]
    lum_ab = _luma_f(ab)
    ab = [v / lum_ab for v in ab]
    db_raw = ab if use_alpha_bias_for_despill else [
        max(1e-4, v) for v in _parse_color(despill_bias, (0.5, 0.5, 0.5))]
    db = (list(ab) if use_alpha_bias_for_despill
          else [v / lum_ab for v in db_raw])

    pick = _parse_color(pick_color, (0.0, 1.0, 0.0))
    if screen == 'pick':
        screen_kind = 'green' if pick[1] / ab[1] > pick[2] / ab[2] else 'blue'
    else:
        screen_kind = screen

    clip_min = max(0.0, min(1.0, float(clip_black)))
    return {
        'ab': ab,
        'db': db,
        'const_c': [pick[i] / ab[i] for i in range(3)],
        'screen_kind': screen_kind,
        'rw': float(red_weight),
        'gbw': float(blue_green_weight),
        'screen_subtraction': bool(screen_subtraction),
        'clamp_alpha': bool(clamp_alpha),
        'clip_min': clip_min,
        'clip_max': max(clip_min + 1e-4, min(1.0, float(clip_white))),
        'replace_mode': replace_mode,
        'rep_col': _parse_color(replace_color, (0.5, 0.5, 0.5)),
    }


def pik_math(img, p, c, in_mask_t=None, out_mask_t=None):
    import torch

    ab = p['ab']
    db = p['db']
    rw = p['rw']
    gbw = p['gbw']
    replace_mode = p['replace_mode']
    rep_col = p['rep_col']
    device = img.device
    fg = img[..., :3]
    pfg = torch.stack([fg[..., i] / ab[i] for i in range(3)], dim=-1)

    if p['screen_kind'] == 'green':
        pfg_key = pfg[..., 1] - pfg[..., 0] * rw - pfg[..., 2] * gbw
        c_key = c[..., 1] - c[..., 0] * rw - c[..., 2] * gbw
        c_prim = c[..., 1]
    else:
        pfg_key = pfg[..., 2] - pfg[..., 0] * rw - pfg[..., 1] * gbw
        c_key = c[..., 2] - c[..., 0] * rw - c[..., 1] * gbw
        c_prim = c[..., 2]

    alpha = 1 - pfg_key / torch.where(c_key <= 0,
                                      torch.ones_like(c_key), c_key)
    ones = torch.ones_like(alpha)
    alpha = torch.where((c_prim <= 0) | (pfg_key <= 0) | (c_key <= 0),
                        ones, alpha)

    if p['screen_subtraction']:
        sub = torch.stack([
            (fg[..., i] + c[..., i] * db[i] * (alpha - 1)).clamp(min=0)
            for i in range(3)], dim=-1)
        out = torch.where(alpha.unsqueeze(-1) >= 1, fg, sub)
    else:
        out = fg

    if p['clamp_alpha']:
        alpha = alpha.clamp(0, 1)

    clipped = ((alpha - p['clip_min'])
               / (p['clip_max'] - p['clip_min'])).clamp(0, 1)
    clipped = torch.where(alpha <= p['clip_min'], torch.zeros_like(alpha),
                          clipped)
    clipped = torch.where(alpha >= p['clip_max'], ones, clipped)
    down = clipped < alpha
    up = clipped > alpha
    safe = torch.where(alpha > 0, alpha, ones)
    out = torch.where(down.unsqueeze(-1),
                      out * (clipped / safe).unsqueeze(-1), out)
    if replace_mode != 'none':
        diff = torch.where(up, clipped - alpha, torch.zeros_like(alpha))
        if replace_mode == 'source':
            out = out + fg * diff.unsqueeze(-1)
        elif replace_mode == 'hard':
            out = out + torch.tensor(rep_col, dtype=torch.float32,
                                     device=device) * diff.unsqueeze(-1)
        else:
            out = out + (torch.tensor(rep_col, dtype=torch.float32,
                                      device=device)
                         * (diff * _luma(fg)).unsqueeze(-1))
    alpha = clipped

    if in_mask_t is not None:
        imdiff = (in_mask_t - alpha).clamp(min=0)
        if replace_mode == 'source':
            out = out + fg * imdiff.unsqueeze(-1)
        elif replace_mode == 'hard':
            out = out + torch.tensor(rep_col, dtype=torch.float32,
                                     device=device) * imdiff.unsqueeze(-1)
        elif replace_mode == 'soft':
            out = out + (torch.tensor(rep_col, dtype=torch.float32,
                                      device=device)
                         * (imdiff * _luma(fg)).unsqueeze(-1))
        alpha = torch.maximum(alpha, in_mask_t)
    if out_mask_t is not None:
        lim = 1 - out_mask_t
        over = alpha > lim
        safe = torch.where(alpha > 0, alpha, ones)
        out = torch.where(over.unsqueeze(-1),
                          out * (lim / safe).unsqueeze(-1), out)
        alpha = torch.where(over, lim, alpha)

    if not p['screen_subtraction']:
        out = out * alpha.unsqueeze(-1)

    return out, alpha


SELECT0R_SPACES = ('rgb', 'abi', 'hci')
SELECT0R_SHAPES = ('box', 'ellipsoid', 'octahedron')
SELECT0R_EDGES = ('hard', 'fat', 'normal', 'skiny', 'slope')

_K32 = 0.8660254037844386


def _rgb_to_abi(r, g, b):
    return r - 0.5 * g - 0.5 * b, _K32 * (g - b), (r + g + b) / 3.0


def select0r_params(*, key_color='#00FF00', space='rgb', shape='ellipsoid',
                    edge='normal', delta_1=0.2, delta_2=0.2, delta_3=0.2,
                    slope=0.2, invert=False):
    if space not in SELECT0R_SPACES:
        raise RuntimeError(f"select0r: unknown space {space!r}")
    if shape not in SELECT0R_SHAPES:
        raise RuntimeError(f"select0r: unknown shape {shape!r}")
    if edge not in SELECT0R_EDGES:
        raise RuntimeError(f"select0r: unknown edge {edge!r}")
    kr, kg, kb = _parse_color(key_color)
    if space == 'rgb':
        center = (kr, kg, kb)
    else:
        a, bb, i = _rgb_to_abi(kr, kg, kb)
        if space == 'abi':
            center = (a, bb, i)
        else:
            h = np.arctan2(bb, a) / (2 * np.pi)
            c = float(np.hypot(a, bb))
            center = (float(h), c, i)
    deltas = tuple(max(1e-4, min(2.0, float(d)))
                   for d in (delta_1, delta_2, delta_3))
    return {'space': space, 'shape': shape, 'edge': edge,
            'center': center, 'deltas': deltas,
            'slope': max(1e-6, min(1.0, float(slope))),
            'invert': bool(invert)}


def select0r_math(img, p):
    import torch

    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    space = p['space']
    if space == 'rgb':
        ax0, ax1, ax2 = r, g, b
        wrap0 = False
    elif space == 'abi':
        a, bb, i = _rgb_to_abi(r, g, b)
        ax0, ax1, ax2 = a, bb, i
        wrap0 = False
    else:
        a, bb, i = _rgb_to_abi(r, g, b)
        ax0 = torch.atan2(bb, a) / (2 * np.pi)
        ax1 = torch.sqrt(a * a + bb * bb)
        ax2 = i
        wrap0 = True

    c0, c1, c2 = p['center']
    d0, d1, d2 = (1.0 / d for d in p['deltas'])
    if wrap0:
        f0 = (0.5 - ((ax0 - c0).abs() % 1.0 - 0.5).abs()) * d0
    else:
        f0 = (ax0 - c0).abs() * d0
    f1 = (ax1 - c1).abs() * d1
    f2 = (ax2 - c2).abs() * d2

    shape = p['shape']
    if shape == 'box':
        rr = torch.maximum(torch.maximum(f0, f1), f2)
        r2 = rr * rr
    elif shape == 'octahedron':
        rr = f0 + f1 + f2
        r2 = rr * rr
    else:
        r2 = f0 * f0 + f1 * f1 + f2 * f2

    edge = p['edge']
    if edge == 'hard':
        alpha = (r2 < 1.0).to(img.dtype)
    elif edge == 'fat':
        alpha = (1.0 - r2 ** 4).clamp(min=0.0)
    elif edge == 'normal':
        alpha = (1.0 - r2 * r2).clamp(min=0.0)
    elif edge == 'skiny':
        alpha = (1.0 - r2).clamp(min=0.0)
    else:
        islp = 0.2 / p['slope']
        alpha = torch.where(r2 < 1.0, torch.ones_like(r2),
                            (1.0 - islp * (r2 - 1.0)).clamp(min=0.0))
    if p['invert']:
        alpha = 1.0 - alpha
    return img[..., :3] * alpha.unsqueeze(-1), alpha


def select0r_video(view_url: str, *, key_color='#00FF00', space='rgb',
                   shape='ellipsoid', edge='normal', delta_1=0.2,
                   delta_2=0.2, delta_3=0.2, slope=0.2, invert=False,
                   output='matte', bg_video='', progress=None) -> str:
    _check_output(output, needs_encoder=True)
    if output == 'composite' and not (bg_video or '').strip():
        raise RuntimeError(
            "select0r: composite output needs a background input")
    p = select0r_params(key_color=key_color, space=space, shape=shape,
                        edge=edge, delta_1=delta_1, delta_2=delta_2,
                        delta_3=delta_3, slope=slope, invert=invert)
    bg_src = _SideSource(bg_video) if (bg_video or '').strip() else None

    def frame_fn(img, t):
        pre, alpha = select0r_math(img, p)
        bg = None
        if bg_src is not None:
            bg = bg_src.at(t, img.device,
                           (img.shape[0], img.shape[1]))[..., :3]
        return _matte_out(pre, alpha, output, bg=bg)

    try:
        return torch_process_video(
            view_url, frame_fn, out_alpha=(output == 'alpha'),
            progress=progress)
    finally:
        if bg_src is not None:
            bg_src.close()


__all__ = [
    'despill_video', 'color_suppress_video', 'keymix_videos',
    'matte_monitor_video', 'morphology_video', 'keyer_video', 'pik_video',
    'despill_math', 'color_suppress_math', 'morphology_math',
    'keyer_params', 'keyer_math', 'pik_params', 'pik_math',
    'select0r_params', 'select0r_math', 'select0r_video',
    'SELECT0R_SPACES', 'SELECT0R_SHAPES', 'SELECT0R_EDGES', 'KEYMIX_OPS',
]
