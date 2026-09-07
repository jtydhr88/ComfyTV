import asyncio
import inspect

from aiohttp import web

from ._common import _log, routes

_WINDOW_DEFAULT = 1.2
_WINDOW_MIN = 0.4
_WINDOW_MAX = 3.0
_MAX_DIM = 640
_RESERVED = {'force_run_token', 'project_id', 'parent_output_id', 'video'}

_SCALE_ARGS = (f"w='min({_MAX_DIM},iw)':h='min({_MAX_DIM},ih)':"
               f"force_original_aspect_ratio=decrease:force_divisible_by=2")


_SPEC_MARKERS = ('_fx_spec_only(', '_fx_passthrough(', '_fx_identity(',
                 'build_fx_spec(', 'build_torch_fx_spec(', '_emit_audio_fx(')


class PreviewRejected(ValueError):
    pass


def preview_kind(stage_cls) -> str:
    try:
        sig = inspect.signature(stage_cls.execute)
    except (TypeError, ValueError):
        return 'renders'
    if 'video' not in sig.parameters:
        return 'multi_input'
    try:
        src = inspect.getsource(stage_cls.execute)
    except (OSError, TypeError):
        src = ''
    return 'spec' if any(m in src for m in _SPEC_MARKERS) else 'renders'


def _reject_unpreviewable(node_id: str, stage_cls) -> None:
    kind = preview_kind(stage_cls)
    if kind == 'multi_input':
        raise PreviewRejected(
            f"{node_id} takes several sources (or none), so a single-clip "
            f"preview does not apply — preview supports single-source FX only")
    if kind == 'renders':
        raise PreviewRejected(
            f"{node_id} renders its result directly instead of describing a "
            f"filter, so there is nothing cheap to preview — run the stage instead")


def _validate_combo_params(stage_cls, params: dict) -> None:
    from .presets import _input_field, _input_name, _schema_field
    try:
        inputs = _schema_field(stage_cls.define_schema(), 'inputs') or []
    except Exception:
        return
    for inp in inputs:
        name = _input_name(inp)
        if not name or name not in params:
            continue
        options = _input_field(inp, 'options')
        if not isinstance(options, (list, tuple)) or not options:
            continue
        value = params[name]
        if value in options or str(value) in [str(o) for o in options]:
            continue
        raise PreviewRejected(
            f"{name} must be one of: {', '.join(str(o) for o in options)} "
            f"(got {value!r})")


def _filtered_exec_kwargs(stage_cls, params: dict) -> dict:
    sig = inspect.signature(stage_cls.execute)
    known = {
        name for name, p in sig.parameters.items()
        if p.kind in (p.POSITIONAL_OR_KEYWORD, p.KEYWORD_ONLY)
    } - _RESERVED
    return {k: v for k, v in params.items() if k in known}


def _node_output_args(out) -> tuple:
    for attr in ('args', 'values'):
        got = getattr(out, attr, None)
        if isinstance(got, (list, tuple)):
            return tuple(got)
    got = getattr(out, 'result', None)
    if isinstance(got, (list, tuple)):
        return tuple(got)
    return ()


def _spec_from_stage(node_id: str, stage_cls, params: dict,
                     video: str) -> dict:
    from ..nodes.stages.common.fx_spec import parse_fx_spec, unpack_fx_video
    kwargs = _filtered_exec_kwargs(stage_cls, params)
    out = stage_cls.execute(video=video, project_id="", **kwargs)
    args = _node_output_args(out)
    if args and isinstance(args[0], str):
        _url, entries = unpack_fx_video(args[0])
        if entries:
            entry = dict(entries[-1])
            entry.setdefault('domain', 'video')
            entry.setdefault('specs', [])
            return entry
    if len(args) >= 2 and isinstance(args[1], str) and args[1].strip():
        return parse_fx_spec(args[1], node_id)
    raise PreviewRejected(
        f"{node_id} produced no adjustment with these params, so there is "
        f"nothing to preview — pass params that change something (its "
        f"defaults are a no-op)")


def _render_preview(video: str, data: dict, t: float, window: float) -> dict:
    from ..runners.media import get_video_info
    from ..runners.media_filter import filter_video

    info = get_video_info(video)
    duration = float(info.get('duration') or 0.0)
    if duration > 0:
        window = min(window, duration)
    t0 = max(0.0, t - window / 2.0)
    if duration > 0:
        t0 = min(t0, max(0.0, duration - window))
    t1 = t0 + window

    scale_spec = ('scale', _SCALE_ARGS)
    opts = {'crf': '26', 'preset': 'veryfast'}
    if data['domain'] == 'audio':
        url = filter_video(video, [scale_spec], audio_specs=list(data['specs']),
                           start=t0, end=t1, vcodec_options=opts,
                           keep_audio=True)
    elif data.get('engine') == 'torch':
        from ..runners.fx_chain_exec import run_fx_chain
        clip = filter_video(video, [scale_spec], start=t0, end=t1,
                            vcodec_options=opts, keep_audio=False)
        url = run_fx_chain(clip, [data])
    else:
        url = filter_video(video, [scale_spec, *data['specs']],
                           start=t0, end=t1, vcodec_options=opts,
                           keep_audio=False)
    return {'url': url, 't0': round(t0, 3), 't1': round(t1, 3)}


@routes.post('/comfytv/fx_preview')
async def fx_preview(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({'error': f'invalid json: {e}'}, status=400)
    node_id = str(body.get('node_id') or '').strip()
    video = str(body.get('video') or '').strip()
    params = body.get('params') or {}
    if not node_id:
        return web.json_response({'error': 'node_id is required'}, status=400)
    if not video:
        return web.json_response({'error': 'video is required'}, status=400)
    if not isinstance(params, dict):
        return web.json_response({'error': 'params must be an object'}, status=400)
    try:
        t = float(body.get('t') or 0.0)
    except (TypeError, ValueError):
        return web.json_response({'error': 't must be a number'}, status=400)
    try:
        window = float(body.get('window') or _WINDOW_DEFAULT)
    except (TypeError, ValueError):
        return web.json_response({'error': 'window must be a number'}, status=400)
    window = min(_WINDOW_MAX, max(_WINDOW_MIN, window))

    from .presets import _stage_class_map
    stage_cls = (await _stage_class_map()).get(node_id)
    if stage_cls is None:
        return web.json_response(
            {'error': f'unknown node_id {node_id!r}'}, status=404)
    try:
        _reject_unpreviewable(node_id, stage_cls)
        _validate_combo_params(stage_cls, params)
        data = _spec_from_stage(node_id, stage_cls, params, video)
    except PreviewRejected as e:
        return web.json_response({'error': str(e)}, status=400)
    except Exception as e:
        return web.json_response(
            {'error': f'{node_id} does not support clip preview: {e}'},
            status=400)
    try:
        result = await asyncio.get_running_loop().run_in_executor(
            None, _render_preview, video, data, t, window)
    except Exception as e:
        _log.exception('[ComfyTV/fx_preview] render failed for %s', node_id)
        return web.json_response(
            {'error': f'preview render failed: {e}'}, status=500)
    return web.json_response(result)
