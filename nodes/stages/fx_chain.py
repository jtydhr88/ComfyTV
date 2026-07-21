from ._common import *  # noqa: F401, F403
from ...runners.fx_chain_exec import run_fx_chain

from .common.fx_helpers import _hidden_combo, _progress_cb  # noqa: F401

COLORSPACE_TARGETS = ['bt709', 'bt601-6-625', 'bt2020', 'smpte170m']
DELIVERY_SIZES = ['source', '2160', '1440', '1080', '720', '540', '480']
DELIVERY_FPS = ['source', '24', '25', '30', '50', '60']
DELIVERY_CODEC_IDS = ['h264', 'hevc', 'prores']
DELIVERY_QUALITIES = ['draft', 'standard', 'high']


def _combo_num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0


class FXChainStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.FXChainStage",
            display_name="FX Chain",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("out_colorspace", COLORSPACE_TARGETS, 'bt709'),
                _hidden_combo("out_size", DELIVERY_SIZES, 'source',
                              "delivery short-side resolution"),
                _hidden_combo("out_fps", DELIVERY_FPS, 'source'),
                _hidden_combo("out_codec", DELIVERY_CODEC_IDS, 'h264'),
                _hidden_combo("out_quality", DELIVERY_QUALITIES, 'standard'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                out_colorspace='bt709', out_size='source', out_fps='source',
                out_codec='h264', out_quality='standard', video=""):
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
        delivery = {
            'colorspace': out_colorspace,
            'size': _combo_num(out_size),
            'fps': _combo_num(out_fps),
            'codec': out_codec,
            'quality': out_quality,
        }
        payload = run_fx_chain(url, entries, progress=_progress_cb(cls),
                               delivery=delivery)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
