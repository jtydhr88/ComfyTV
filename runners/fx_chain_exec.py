import json
import logging

from .media import get_video_info
from .media_filter import filter_video
from .media_torch import torch_process_video

_log = logging.getLogger(__name__)


def _parse_curves(raw):
    if isinstance(raw, dict):
        return raw
    try:
        data = json.loads(raw) if (raw or '').strip() else {}
    except (ValueError, TypeError):
        data = {}
    return data if isinstance(data, dict) else {}


def _hue_correct_op(p, ctx=None):
    from .video_color_ops import build_hue_luts, hue_correct_frame

    curves = _parse_curves(p.get('curves'))
    sat_thrsh = float(p.get('sat_thrsh') or 0.0)
    luminance_mix = float(p.get('luminance_mix') or 0.0)
    luts = {}

    def fn(img, t):
        if not luts:
            luts.update(build_hue_luts(curves, device=img.device))
        return hue_correct_frame(img, luts, sat_thrsh=sat_thrsh,
                                 luminance_mix=luminance_mix)

    return fn


def _despill_op(p, ctx=None):
    from .keying import despill_math

    def fn(img, t):
        return despill_math(
            img,
            screen=p.get('screen') or 'green',
            spill_mix=float(p.get('spill_mix', 0.5)),
            expand=float(p.get('expand', 0.0)),
            red_scale=float(p.get('red_scale', 0.0)),
            green_scale=float(p.get('green_scale', -1.0)),
            blue_scale=float(p.get('blue_scale', 0.0)),
            brightness=float(p.get('brightness', 0.0)),
            clamp_black=bool(p.get('clamp_black', True)),
            clamp_white=bool(p.get('clamp_white', False)),
            output_spillmap=bool(p.get('output_spillmap', False)),
        )

    return fn


def _color_suppress_op(p, ctx=None):
    from .keying import color_suppress_math

    def fn(img, t):
        return color_suppress_math(
            img,
            red=float(p.get('red', 0.0)), green=float(p.get('green', 0.0)),
            blue=float(p.get('blue', 0.0)), cyan=float(p.get('cyan', 0.0)),
            magenta=float(p.get('magenta', 0.0)),
            yellow=float(p.get('yellow', 0.0)),
            preserve_luma=bool(p.get('preserve_luma', False)),
            luminance_math=p.get('luminance_math') or 'rec709',
            output=p.get('output') or 'image',
        )

    return fn


def _pack_key_output(out, alpha, output):
    if output == 'matte':
        return alpha.unsqueeze(-1).expand(alpha.shape[0], alpha.shape[1], 3) \
            .clamp(0, 1)
    return out.clamp(0, 1)


def _keyer_op(p, ctx=None):
    from .keying import keyer_math, keyer_params

    kp = keyer_params(
        mode=p.get('mode') or 'luminance',
        key_color=p.get('key_color') or '#000000',
        luminance_math=p.get('luminance_math') or 'rec709',
        softness_lower=float(p.get('softness_lower', -0.5)),
        tolerance_lower=float(p.get('tolerance_lower', 0.0)),
        center=float(p.get('center', 1.0)),
        tolerance_upper=float(p.get('tolerance_upper', 0.0)),
        softness_upper=float(p.get('softness_upper', 0.5)),
        despill=float(p.get('despill', 1.0)),
        despill_angle=float(p.get('despill_angle', 120.0)),
    )
    output = p.get('output') or 'matte'

    def fn(img, t):
        pre, alpha = keyer_math(img, kp)
        return _pack_key_output(pre, alpha, output)

    return fn


def _pik_op(p, ctx=None):
    import torch
    from .keying import pik_math, pik_params

    pp = pik_params(
        screen=p.get('screen') or 'green',
        pick_color=p.get('pick_color') or '#00FF00',
        red_weight=float(p.get('red_weight', 0.5)),
        blue_green_weight=float(p.get('blue_green_weight', 0.5)),
        alpha_bias=p.get('alpha_bias') or '#808080',
        despill_bias=p.get('despill_bias') or '#808080',
        use_alpha_bias_for_despill=bool(p.get('use_alpha_bias', True)),
        screen_subtraction=bool(p.get('screen_subtraction', True)),
        clamp_alpha=bool(p.get('clamp_alpha', True)),
        clip_black=float(p.get('clip_black', 0.0)),
        clip_white=float(p.get('clip_white', 1.0)),
        replace_mode=p.get('replace_mode') or 'soft',
        replace_color=p.get('replace_color') or '#808080',
    )
    output = p.get('output') or 'alpha'

    def fn(img, t):
        c = torch.tensor(pp['const_c'], dtype=torch.float32,
                         device=img.device).expand_as(img[..., :3])
        out, alpha = pik_math(img, pp, c)
        return _pack_key_output(out, alpha, output)

    return fn


def _matte_morph_op(p, ctx=None):
    from .keying import morphology_math

    def fn(img, t):
        return morphology_math(
            img, op=p.get('op') or 'erode',
            size_x=int(p.get('size_x', 1)), size_y=int(p.get('size_y', 1)))

    return fn


def _glow_op(p, ctx=None):
    from .video_stylize_ops import glow_math

    def fn(img, t):
        return glow_math(
            img, threshold=float(p.get('threshold', 0.7)),
            size=float(p.get('size', 4.0)),
            bloom_ratio=float(p.get('bloom_ratio', 2.0)),
            bloom_count=int(p.get('bloom_count', 5)),
            gain=float(p.get('gain', 1.0)), mix=float(p.get('mix', 1.0)))

    return fn


def _god_rays_op(p, ctx=None):
    from .video_stylize_ops import god_rays_frame, god_rays_setup

    cache = {}
    max_mode = bool(p.get('max_mode', False))
    mix = float(p.get('mix', 1.0))

    def fn(img, t):
        key = (img.shape[0], img.shape[1])
        if key not in cache:
            cache[key] = god_rays_setup(
                key[1], key[0],
                translate_x=float(p.get('translate_x', 0.0)),
                translate_y=float(p.get('translate_y', 0.0)),
                scale=float(p.get('scale', 1.4)),
                rotate_deg=float(p.get('rotate_deg', 0.0)),
                steps=int(p.get('steps', 5)),
                decay=float(p.get('decay', 0.3)))
        mats, weights = cache[key]
        return god_rays_frame(img, mats, weights, max_mode=max_mode, mix=mix)

    return fn


def _old_film_op(p, ctx=None):
    from .video_stylize_ops import old_film_frame

    info = (ctx or {}).get('info') or {}
    duration = max(1e-6, float(info.get('duration') or 0.0))
    fps = info.get('fps') or 24
    line_state = {}

    def fn(img, t):
        return old_film_frame(
            img, t, duration=duration, fps=fps, line_state=line_state,
            delta=int(p.get('delta', 14)), every=int(p.get('every', 20)),
            brightness_up=int(p.get('brightness_up', 20)),
            brightness_down=int(p.get('brightness_down', 30)),
            brightness_every=int(p.get('brightness_every', 70)),
            develop_up=int(p.get('develop_up', 60)),
            develop_down=int(p.get('develop_down', 20)),
            develop_duration=int(p.get('develop_duration', 70)),
            lines_num=int(p.get('lines_num', 5)),
            line_width=int(p.get('line_width', 2)),
            lines_darker=int(p.get('lines_darker', 40)),
            lines_lighter=int(p.get('lines_lighter', 40)))

    return fn


def _transform_op(p, ctx=None):
    from .media_torch import build_transform_frame_fn

    info = (ctx or {}).get('info') or {}
    keyframes = p.get('keyframes')
    if not isinstance(keyframes, list) or not keyframes:
        keyframes = None
    return build_transform_frame_fn(
        int(info.get('width') or 2), int(info.get('height') or 2),
        info.get('fps') or 24,
        translate_x=float(p.get('pos_x', 0.0)),
        translate_y=float(p.get('pos_y', 0.0)),
        scale=float(p.get('scale', 1.0)),
        rotation_deg=float(p.get('rotation', 0.0)),
        skew_x=float(p.get('skew_x', 0.0)),
        keyframes=keyframes,
        motion_blur=float(p.get('motion_blur', 0.0)),
        shutter=float(p.get('shutter', 0.5)),
        shutter_type=p.get('shutter_type') or 'centered',
        shutter_offset=float(p.get('shutter_offset', 0.0)))


TORCH_FX_OPS = {
    'hue_correct': _hue_correct_op,
    'despill': _despill_op,
    'color_suppress': _color_suppress_op,
    'keyer': _keyer_op,
    'pik': _pik_op,
    'matte_morph': _matte_morph_op,
    'glow': _glow_op,
    'god_rays': _god_rays_op,
    'old_film': _old_film_op,
    'transform': _transform_op,
}


def _torch_frame_fn(entries, ctx=None):
    fns = []
    for e in entries:
        op = e.get('op') or ''
        builder = TORCH_FX_OPS.get(op)
        if builder is None:
            raise RuntimeError(f"FX Chain: unknown torch op {op!r}")
        fns.append(builder(e.get('params') or {}, ctx))

    def frame_fn(img, t):
        for fn in fns:
            img = fn(img, t).clamp(0.0, 1.0)
        return img

    return frame_fn


DELIVERY_CODECS = {
    'h264': {'vcodec': 'libx264', 'ext': '.mp4', 'pix_fmt': 'yuv420p',
             'quality': {'draft': {'crf': '28', 'preset': 'veryfast'},
                         'standard': None,
                         'high': {'crf': '16', 'preset': 'slow'}}},
    'hevc': {'vcodec': 'libx265', 'ext': '.mp4', 'pix_fmt': 'yuv420p',
             'quality': {'draft': {'crf': '30', 'preset': 'fast'},
                         'standard': None,
                         'high': {'crf': '20', 'preset': 'slow'}}},
    'prores': {'vcodec': 'prores_ks', 'ext': '.mov',
               'pix_fmt': 'yuv422p10le',
               'quality': {'draft': {'profile': '0'},
                           'standard': {'profile': '2'},
                           'high': {'profile': '3'}}},
}


DELIVERY_COLORSPACES = {'bt709', 'bt601-6-625', 'bt2020', 'smpte170m'}


def _delivery_norm(delivery):
    d = dict(delivery or {})

    def _num(key):
        try:
            v = float(d.get(key) or 0)
        except (TypeError, ValueError):
            return 0
        return v if v > 0 else 0

    codec = d.get('codec')
    quality = d.get('quality')
    cs = d.get('colorspace')
    return {
        'colorspace': cs if cs in DELIVERY_COLORSPACES else 'bt709',
        'size': int(_num('size')),
        'fps': _num('fps'),
        'codec': codec if codec in DELIVERY_CODECS else 'h264',
        'quality': quality if quality in ('draft', 'standard', 'high')
        else 'standard',
    }


def _delivery_active(d):
    return (d['colorspace'] != 'bt709' or d['size'] > 0 or d['fps'] > 0
            or d['codec'] != 'h264' or d['quality'] != 'standard')


def _delivery_specs(d):
    specs = []
    if d['fps'] > 0:
        specs.append(('fps', f"fps={d['fps']:g}"))
    if d['size'] > 0:
        s = d['size'] - d['size'] % 2
        specs.append(('scale',
                      f"w='if(gt(iw,ih),-2,{s})':h='if(gt(iw,ih),{s},-2)'"))
    return specs


def _delivery_encode_kwargs(d):
    c = DELIVERY_CODECS[d['codec']]
    opts = c['quality'][d['quality']]
    return {'vcodec': c['vcodec'], 'out_ext': c['ext'],
            'pix_fmt': c['pix_fmt'],
            'vcodec_options': dict(opts) if opts else None,
            'out_colorspace': d['colorspace']}


def _segment_progress(progress, index, count):
    if progress is None or count <= 1:
        return progress

    def cb(value, total, text=''):
        progress(value, total, f"{text or 'rendering'} {index + 1}/{count}")

    return cb


def run_fx_chain(view_url: str, entries, progress=None,
                 delivery=None) -> str:
    d = _delivery_norm(delivery)
    _log.info('[ComfyTV/fx-chain] render %d entries from %s (delivery=%s)',
              len(entries), view_url, json.dumps(d))
    for e in entries:
        _log.info('[ComfyTV/fx-chain]   %s engine=%s op=%s specs=%s params=%s',
                  e.get('kind'), e.get('engine', 'avfilter'), e.get('op'),
                  json.dumps(e.get('specs'))[:400],
                  json.dumps(e.get('params', {}))[:400])
    video_entries = [e for e in entries if e['domain'] == 'video']
    audio_specs = [tuple(s) for e in entries if e['domain'] == 'audio'
                   for s in e['specs']]

    segments = []
    for e in video_entries:
        engine = 'torch' if e.get('engine') == 'torch' else 'avfilter'
        if segments and segments[-1][0] == engine:
            segments[-1][1].append(e)
        else:
            segments.append((engine, [e]))

    if not segments and not audio_specs:
        raise RuntimeError("FX Chain: nothing to render")

    count = len(segments) + (1 if audio_specs else 0)
    cur = view_url
    for i, (engine, group) in enumerate(segments):
        last = i == count - 1
        last_video = i == len(segments) - 1
        seg_progress = _segment_progress(progress, i, count)
        if engine == 'avfilter':
            specs = []
            fps_mult = 1
            for j, e in enumerate(group):
                if j:
                    specs.append(('format', 'yuv420p'))
                specs.extend(tuple(s) for s in e['specs'])
                m = e.get('out_fps_mult')
                if isinstance(m, (int, float)) and m > 1:
                    fps_mult *= m
            out_fps = None
            if fps_mult != 1:
                out_fps = get_video_info(cur)['fps'] * fps_mult
            opts = None if last else {'crf': '10', 'preset': 'veryfast'}
            kwargs = {'vcodec_options': opts}
            if last_video:
                specs.extend(_delivery_specs(d))
                if d['fps'] > 0:
                    out_fps = d['fps']
                kwargs = _delivery_encode_kwargs(d)
            _log.info('[ComfyTV/fx-chain] segment %d/%d avfilter specs=%s '
                      'out_fps=%s', i + 1, count, json.dumps(specs)[:600],
                      out_fps)
            cur = filter_video(cur, specs, out_fps=out_fps,
                               progress=seg_progress, **kwargs)
        else:
            ctx = {'info': get_video_info(cur)}
            _log.info('[ComfyTV/fx-chain] segment %d/%d torch ops=%s',
                      i + 1, count, [e.get('op') for e in group])
            cur = torch_process_video(cur, _torch_frame_fn(group, ctx),
                                      progress=seg_progress)
    if _delivery_active(d) and (not segments or segments[-1][0] == 'torch'):
        _log.info('[ComfyTV/fx-chain] delivery pass %s', json.dumps(d))
        cur = filter_video(cur, _delivery_specs(d) or [('null', None)],
                           out_fps=d['fps'] or None,
                           **_delivery_encode_kwargs(d))
    if audio_specs:
        cur = filter_video(cur, None, audio_specs,
                           out_ext=DELIVERY_CODECS[d['codec']]['ext'],
                           progress=_segment_progress(progress, count - 1,
                                                      count))
    return cur


__all__ = ['run_fx_chain', 'TORCH_FX_OPS']
