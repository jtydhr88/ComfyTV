from ._common import *  # noqa: F401, F403
from ...runners.media_filter import filter_video

from .common.fx_helpers import _progress_cb, _hidden_str  # noqa: F401


def _connected_fx_slots(group):
    try:
        items = list(group.items())
    except AttributeError:
        seq = group if isinstance(group, (list, tuple)) else []
        items = [(f"fx_spec{i}", v) for i, v in enumerate(seq)]
    slots = []
    for key, raw in items:
        if raw is None or not str(raw).strip():
            continue
        try:
            idx = int(str(key)[len("fx_spec"):])
        except ValueError:
            continue
        slots.append((idx + 1, str(raw)))
    slots.sort(key=lambda s: s[0])
    return slots


def _apply_chain_order(parsed, chain_order):
    try:
        order = json.loads(chain_order) if (chain_order or '').strip() else []
    except (ValueError, TypeError):
        order = []
    if not isinstance(order, list):
        order = []
    by_ordinal = dict(parsed)
    ordered = []
    used = set()
    for o in order:
        try:
            o = int(o)
        except (TypeError, ValueError):
            continue
        if o in by_ordinal and o not in used:
            ordered.append((o, by_ordinal[o]))
            used.add(o)
    for o, data in parsed:
        if o not in used:
            ordered.append((o, data))
    return ordered


class FXChainStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.FXChainStage",
            display_name="FX Chain",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                COMFYTV_VIDEO.Input("video", optional=True),
                io.Autogrow.Input("fx_specs", template=_fxspec_template(6)),
                _hidden_str("chain_order", "",
                            "JSON array of 1-based fx_spec slot ordinals, e.g. [2,1,3]"),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                video="", fx_specs=None, chain_order=""):
        slots = _connected_fx_slots(fx_specs)
        if not slots:
            raise RuntimeError(
                "FX Chain: connect at least one FX — wire fx_spec outputs "
                "into the fx_specs inputs."
            )
        if not (video or '').strip():
            raise RuntimeError(
                "FX Chain needs an upstream video — wire one into the video input."
            )
        parsed = [(ordinal, parse_fx_spec(raw, f"fx_spec slot {ordinal}"))
                  for ordinal, raw in slots]
        ordered = _apply_chain_order(parsed, chain_order)
        video_specs = []
        audio_specs = []
        for _ordinal, data in ordered:
            target = video_specs if data['domain'] == 'video' else audio_specs
            for name, args in data['specs']:
                target.append((name, args))
        payload = filter_video(video, video_specs, audio_specs,
                               progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
