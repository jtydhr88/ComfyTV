from ._common import *  # noqa: F401, F403

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)


class VideoColorStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        wheel = []
        for zone in ('shadows', 'midtones', 'highlights'):
            for ch in ('r', 'g', 'b'):
                wheel.append(_hidden_float(f"{zone}_{ch}", 0.0, -1.0, 1.0))
        return io.Schema(
            node_id="ComfyTV.VideoColorStage",
            display_name="Video Color",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("exposure", 0.0, -3.0, 3.0),
                _hidden_float("black", 0.0, -0.1, 0.1, step=0.001),
                _hidden_int("temperature", 6500, 1000, 40000),
                _hidden_float("temp_mix", 1.0, 0.0, 1.0),
                _hidden_float("hue", 0.0, -180.0, 180.0, step=1.0),
                _hidden_float("saturation", 0.0, -1.0, 1.0),
                _hidden_float("vibrance", 0.0, -2.0, 2.0),
                _hidden_float("blackpoint", 0.0, -0.5, 0.5, step=0.005),
                _hidden_float("whitepoint", 1.0, 0.5, 2.0, step=0.005),
                *wheel,
                io.Boolean.Input("preserve_lightness", default=True,
                                 socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                exposure=0.0, black=0.0, temperature=6500, temp_mix=1.0,
                hue=0.0, saturation=0.0, vibrance=0.0,
                blackpoint=0.0, whitepoint=1.0,
                shadows_r=0.0, shadows_g=0.0, shadows_b=0.0,
                midtones_r=0.0, midtones_g=0.0, midtones_b=0.0,
                highlights_r=0.0, highlights_g=0.0, highlights_b=0.0,
                preserve_lightness=True, video=""):
        specs = []
        exposure = _f(exposure, -3, 3)
        black = _f(black, -0.1, 0.1)
        if exposure or black:
            specs.append(('exposure', f'exposure={exposure}:black={black}'))
        temperature = min(40000, max(1000, int(temperature or 6500)))
        if temperature != 6500:
            specs.append(('colortemperature',
                          f'temperature={temperature}:mix={_f(temp_mix, 0, 1, 1.0)}'))
        hue = _f(hue, -180, 180)
        saturation = _f(saturation, -1, 1)
        if hue or saturation:
            specs.append(('huesaturation', f'hue={hue}:saturation={saturation}'))
        vibrance = _f(vibrance, -2, 2)
        if vibrance:
            specs.append(('vibrance', f'intensity={vibrance}'))
        bp = _f(blackpoint, -0.5, 0.5, 0.0)
        wp = _f(whitepoint, 0.5, 2.0, 1.0)
        if bp or wp != 1.0:
            wp = max(bp + 0.01, wp)
            imax = min(wp, 1.0)
            args = ':'.join(f'{c}imin={bp}:{c}imax={imax}' for c in 'rgb')
            if wp > 1.0:
                omax = (1.0 - bp) / (wp - bp)
                args += ':' + ':'.join(f'{c}omax={omax}' for c in 'rgb')
            specs.append(('colorlevels', args))
        wheels = {
            'rs': _f(shadows_r, -1, 1), 'gs': _f(shadows_g, -1, 1), 'bs': _f(shadows_b, -1, 1),
            'rm': _f(midtones_r, -1, 1), 'gm': _f(midtones_g, -1, 1), 'bm': _f(midtones_b, -1, 1),
            'rh': _f(highlights_r, -1, 1), 'gh': _f(highlights_g, -1, 1), 'bh': _f(highlights_b, -1, 1),
        }
        if any(wheels.values()):
            args = ':'.join(f'{k}={v}' for k, v in wheels.items() if v)
            if preserve_lightness:
                args += ':pl=1'
            specs.append(('colorbalance', args))
        if not specs:
            return _fx_identity(video)
        fx_spec = build_fx_spec(
            "ComfyTV.VideoColorStage", "Video Color", "video", specs,
            params={
                'exposure': exposure, 'black': black,
                'temperature': temperature, 'temp_mix': temp_mix,
                'hue': hue, 'saturation': saturation, 'vibrance': vibrance,
                'blackpoint': bp, 'whitepoint': wp,
                'shadows_r': wheels['rs'], 'shadows_g': wheels['gs'],
                'shadows_b': wheels['bs'],
                'midtones_r': wheels['rm'], 'midtones_g': wheels['gm'],
                'midtones_b': wheels['bm'],
                'highlights_r': wheels['rh'], 'highlights_g': wheels['gh'],
                'highlights_b': wheels['bh'],
                'preserve_lightness': bool(preserve_lightness),
            })
        return _fx_passthrough(video, fx_spec)


CURVES_PRESETS = ['none', 'color_negative', 'cross_process', 'darker',
                  'increase_contrast', 'lighter', 'linear_contrast',
                  'medium_contrast', 'negative', 'strong_contrast', 'vintage']

_CURVE_PT_RE = None


def _curve_points_arg(raw: str) -> str:
    global _CURVE_PT_RE
    if not (raw or '').strip():
        return ''
    try:
        pts = json.loads(raw)
    except (ValueError, TypeError):
        return ''
    dedup = {}
    for p in pts or []:
        try:
            x, y = float(p[0]), float(p[1])
        except (TypeError, ValueError, IndexError):
            continue
        dedup[round(min(1.0, max(0.0, x)), 4)] = min(1.0, max(0.0, y))
    good = sorted(dedup.items())
    if len(good) < 2:
        return ''
    return ' '.join(f'{x:.4f}/{y:.4f}' for x, y in good)


class VideoCurvesStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoCurvesStage",
            display_name="Video Curves",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("preset", CURVES_PRESETS, 'none'),
                _hidden_str("master_pts", "", "JSON [[x,y],...] control points 0..1"),
                _hidden_str("red_pts", ""),
                _hidden_str("green_pts", ""),
                _hidden_str("blue_pts", ""),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                preset='none', master_pts="", red_pts="", green_pts="", blue_pts="",
                video=""):
        parts = []
        if preset and preset != 'none':
            parts.append(f'preset={preset}')
        for key, raw in (('master', master_pts), ('red', red_pts),
                         ('green', green_pts), ('blue', blue_pts)):
            arg = _curve_points_arg(raw)
            if arg:
                parts.append(f'{key}={arg}')
        if not parts:
            return _fx_identity(video)
        specs = [('curves', ':'.join(parts))]
        fx_spec = build_fx_spec(
            "ComfyTV.VideoCurvesStage", "Video Curves", "video", specs,
            params={
                'preset': preset, 'master_pts': master_pts,
                'red_pts': red_pts, 'green_pts': green_pts,
                'blue_pts': blue_pts,
            })
        return _fx_passthrough(video, fx_spec)


def _lut_path(name):
    from ...api.resources import resource_file
    return resource_file('lut', name)


class VideoLUTStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoLUTStage",
            display_name="Video LUT",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("lut_file", "", "file name from the LUT library"),
                _hidden_combo("interp", ['tetrahedral', 'trilinear', 'nearest',
                                         'pyramid', 'prism'], 'tetrahedral'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                lut_file="", interp='tetrahedral', video=""):
        name = os.path.basename((lut_file or '').strip())
        if not name:
            return _fx_identity(video)
        path = _lut_path(name)
        if path is None:
            raise RuntimeError(f"Video LUT: {name!r} not found in the LUT library.")
        esc = str(path).replace('\\', '/').replace(':', r'\:')
        if path.suffix.lower() == '.png':
            raise RuntimeError("Video LUT: Hald .png LUTs need a second input — "
                               "convert to .cube, or use lut3d-compatible formats.")
        specs = [('lut3d', f"file={esc}:interp={interp}")]
        fx_spec = build_fx_spec(
            "ComfyTV.VideoLUTStage", "Video LUT", "video", specs,
            params={'lut_file': name, 'interp': interp})
        return _fx_passthrough(video, fx_spec)


class HueCorrectStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.HueCorrectStage",
            display_name="Hue Correct",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("curves", "",
                            'JSON {"sat"|"lum"|"red"|"green"|"blue"|"r_sup"|'
                            '"g_sup"|"b_sup"|"hue": [[x,y],...]} over hue 0..1'),
                _hidden_float("sat_thrsh", 0.0, 0.0, 1.0),
                _hidden_float("luminance_mix", 0.0, 0.0, 1.0),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                curves="", sat_thrsh=0.0, luminance_mix=0.0, video=""):
        try:
            parsed = json.loads(curves) if (curves or '').strip() else {}
        except (ValueError, TypeError):
            parsed = {}
        if not isinstance(parsed, dict) or not any(
                isinstance(v, list) and len(v) >= 2 for v in parsed.values()):
            return _fx_identity(video)
        fx_spec = build_torch_fx_spec(
            "ComfyTV.HueCorrectStage", "Hue Correct", "video", "hue_correct",
            {'curves': parsed, 'sat_thrsh': _f(sat_thrsh, 0, 1, 0.0),
             'luminance_mix': _f(luminance_mix, 0, 1, 0.0)})
        return _fx_passthrough(video, fx_spec)


SELECTIVE_ZONES = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas',
                   'whites', 'neutrals', 'blacks']


class SelectiveColorStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        zones = [_hidden_float(f"sc_{z}", 0.0, -1.0, 1.0) for z in SELECTIVE_ZONES]
        return io.Schema(
            node_id="ComfyTV.SelectiveColorStage",
            display_name="Selective Color",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("sc_method", ['absolute', 'relative'], 'absolute'),
                *zones,
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                sc_method='absolute', video="", **kwargs):
        parts = [f'correction_method={sc_method}']
        any_zone = False
        for z in SELECTIVE_ZONES:
            v = _f(kwargs.get(f'sc_{z}', 0.0), -1, 1, 0.0)
            if v:
                any_zone = True
                parts.append(f'{z}={v}')
        if not any_zone:
            return _fx_identity(video)
        fx_spec = build_fx_spec(
            "ComfyTV.SelectiveColorStage", "Selective Color", "video",
            [('selectivecolor', ':'.join(parts))],
            params={'sc_method': sc_method,
                    **{f'sc_{z}': _f(kwargs.get(f'sc_{z}', 0.0), -1, 1, 0.0)
                       for z in SELECTIVE_ZONES}})
        return _fx_passthrough(video, fx_spec)


class GrayWorldStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.GrayWorldStage",
            display_name="Auto White Balance",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                video=""):
        fx_spec = build_fx_spec(
            "ComfyTV.GrayWorldStage", "Auto White Balance", "video",
            [('grayworld', None)], params={})
        return _fx_passthrough(video, fx_spec)
