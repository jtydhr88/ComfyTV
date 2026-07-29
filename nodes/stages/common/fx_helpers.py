import json

from comfy_api.latest import io

from .progress import _emit_progress


def _need_video(video, label):
    if not (video or '').strip():
        raise RuntimeError(
            f"{label} needs an upstream video — wire one into the video input."
        )


def _simple_video_op(cls, *, video, label, project_id, parent_output_id, run):
    from .emit import _stage_emit_auto
    _need_video(video, label)
    payload = run(video)
    return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                            parent_output_id=parent_output_id)


def _progress_cb(cls):
    def _cb(value, total, text=""):
        import comfy.model_management
        comfy.model_management.throw_exception_if_processing_interrupted()
        _emit_progress(cls, value, total, text)
    return _cb


def _emit_audio_fx(cls, *, src, fx_spec, specs, project_id, parent_output_id):
    from .emit import _stage_emit_auto
    from .fx_spec import _fx_spec_only
    if not src:
        return _fx_spec_only(fx_spec)
    from ....runners.media_filter import filter_audio
    payload = filter_audio(src, specs, progress=_progress_cb(cls))
    return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                            parent_output_id=parent_output_id,
                            extra_outputs=(fx_spec,))


def _f(v, lo, hi, default=0.0):
    try:
        x = float(v)
    except (TypeError, ValueError):
        x = default
    return min(hi, max(lo, x))


def _hidden_float(name, default, lo, hi, step=0.01, tooltip=None):
    return io.Float.Input(name, default=default, min=lo, max=hi, step=step,
                          socketless=True, extra_dict={"hidden": True},
                          tooltip=tooltip)


def _hidden_int(name, default, lo, hi, tooltip=None):
    return io.Int.Input(name, default=default, min=lo, max=hi,
                        socketless=True, extra_dict={"hidden": True},
                        tooltip=tooltip)


def _hidden_str(name, default="", tooltip=None):
    return io.String.Input(name, default=default, multiline=False,
                           socketless=True, extra_dict={"hidden": True},
                           tooltip=tooltip)


def _hidden_combo(name, options, default, tooltip=None):
    return io.Combo.Input(name, options=options, default=default,
                          socketless=True, extra_dict={"hidden": True},
                          tooltip=tooltip)


def _pick_source(audio, video, label):
    src = (audio or '').strip() or (video or '').strip()
    if not src:
        raise RuntimeError(
            f"{label} needs an upstream audio or video — wire one in."
        )
    return src


def _parse_json(raw, default):
    try:
        v = json.loads(raw) if isinstance(raw, str) and raw.strip() else default
        return v if v is not None else default
    except (ValueError, TypeError):
        return default


_AUDIO_SR = 44100
