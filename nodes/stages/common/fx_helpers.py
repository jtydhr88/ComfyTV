import json

from comfy_api.latest import io

from .progress import _emit_progress


def _need_video(video, label):
    if not (video or '').strip():
        raise RuntimeError(
            f"{label} needs an upstream video — wire one into the video input."
        )


def _progress_cb(cls):
    def _cb(value, total, text=""):
        import comfy.model_management
        comfy.model_management.throw_exception_if_processing_interrupted()
        _emit_progress(cls, value, total, text)
    return _cb


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
