from ._common import *  # noqa: F401, F403
from ...runners.fx_chain_exec import run_fx_chain

from .common.fx_helpers import _progress_cb  # noqa: F401


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
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                video=""):
        url, entries = unpack_fx_video(video)
        if not url:
            raise RuntimeError(
                "FX Chain needs an upstream video — wire one into the video input."
            )
        if not entries:
            raise RuntimeError(
                "FX Chain: no FX upstream — chain FX stages along the video "
                "wire before this node."
            )
        payload = run_fx_chain(url, entries, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
