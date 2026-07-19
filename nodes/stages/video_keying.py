from ._common import *  # noqa: F401, F403
from ...runners.media_filter import chroma_key_video
from ...runners.keying import (
    pik_video, keyer_video, despill_video, color_suppress_video,
    keymix_videos, matte_monitor_video, morphology_video, MATTE_OUTPUTS,
)

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)


class VideoChromaKeyStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoChromaKeyStage",
            display_name="Chroma Key",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("key_color", "#00FF00"),
                _hidden_float("similarity", 0.1, 0.01, 1.0),
                _hidden_float("blend", 0.05, 0.0, 1.0),
                _hidden_float("despill_mix", 0.5, 0.0, 1.0),
                _hidden_float("despill_expand", 0.0, 0.0, 1.0),
                _hidden_combo("output", ['alpha', 'matte'], 'alpha'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                key_color="#00FF00", similarity=0.1, blend=0.05,
                despill_mix=0.5, despill_expand=0.0, output='alpha', video=""):
        _need_video(video, "Chroma Key")
        payload = chroma_key_video(
            video, key_color=key_color, similarity=similarity, blend=blend,
            despill_mix=despill_mix, despill_expand=despill_expand,
            mode=output, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


KEY_OUTPUTS = list(MATTE_OUTPUTS)


class PIKStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.PIKStage",
            display_name="PIK Keyer",
            category="ComfyTV/Keying",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("screen", ['green', 'blue', 'pick'], 'green'),
                _hidden_str("pick_color", "#00FF00"),
                _hidden_float("red_weight", 0.5, -1.0, 2.0),
                _hidden_float("blue_green_weight", 0.5, -1.0, 2.0),
                _hidden_str("alpha_bias", "#808080"),
                _hidden_str("despill_bias", "#808080"),
                io.Boolean.Input("use_alpha_bias", default=True,
                                 socketless=True, extra_dict={"hidden": True}),
                io.Boolean.Input("screen_subtraction", default=True,
                                 socketless=True, extra_dict={"hidden": True}),
                _hidden_float("clip_black", 0.0, 0.0, 1.0),
                _hidden_float("clip_white", 1.0, 0.0, 1.0),
                _hidden_combo("replace_mode",
                              ['none', 'source', 'hard', 'soft'], 'soft'),
                _hidden_str("replace_color", "#808080"),
                _hidden_combo("output", KEY_OUTPUTS, 'alpha'),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_VIDEO.Input("clean_plate_video", optional=True),
                COMFYTV_IMAGE.Input("clean_plate", optional=True),
                COMFYTV_IMAGE.Input("in_mask", optional=True),
                COMFYTV_IMAGE.Input("out_mask", optional=True),
                COMFYTV_VIDEO.Input("bg_video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                screen='green', pick_color="#00FF00", red_weight=0.5,
                blue_green_weight=0.5, alpha_bias="#808080",
                despill_bias="#808080", use_alpha_bias=True,
                screen_subtraction=True, clip_black=0.0, clip_white=1.0,
                replace_mode='soft', replace_color="#808080",
                output='alpha', video="", clean_plate_video="",
                clean_plate="", in_mask="", out_mask="", bg_video=""):
        _need_video(video, "PIK Keyer")
        plate = (clean_plate_video or '').strip() or (clean_plate or '').strip()
        payload = pik_video(
            video, screen=screen, pick_color=pick_color or '#00FF00',
            clean_plate_url=plate,
            red_weight=_f(red_weight, -1, 2, 0.5),
            blue_green_weight=_f(blue_green_weight, -1, 2, 0.5),
            alpha_bias=alpha_bias or '#808080',
            despill_bias=despill_bias or '#808080',
            use_alpha_bias_for_despill=bool(use_alpha_bias),
            screen_subtraction=bool(screen_subtraction),
            clip_black=_f(clip_black, 0, 1, 0.0),
            clip_white=_f(clip_white, 0, 1, 1.0),
            replace_mode=replace_mode, replace_color=replace_color or '#808080',
            in_mask_url=in_mask or '', out_mask_url=out_mask or '',
            bg_url=bg_video or '', output=output,
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class KeyerStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.KeyerStage",
            display_name="Keyer",
            category="ComfyTV/Keying",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ['luminance', 'color', 'screen', 'none'],
                              'luminance'),
                _hidden_str("key_color", "#000000"),
                _hidden_float("softness_lower", -0.5, -1.0, 0.0),
                _hidden_float("tolerance_lower", 0.0, -1.0, 0.0),
                _hidden_float("center", 1.0, 0.0, 1.0),
                _hidden_float("tolerance_upper", 0.0, 0.0, 1.0),
                _hidden_float("softness_upper", 0.5, 0.0, 1.0),
                _hidden_float("despill", 1.0, 0.0, 2.0),
                _hidden_float("despill_angle", 120.0, 0.0, 180.0, step=1.0),
                _hidden_combo("output", KEY_OUTPUTS, 'matte'),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_IMAGE.Input("in_mask", optional=True),
                COMFYTV_IMAGE.Input("out_mask", optional=True),
                COMFYTV_VIDEO.Input("bg_video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='luminance', key_color="#000000", softness_lower=-0.5,
                tolerance_lower=0.0, center=1.0, tolerance_upper=0.0,
                softness_upper=0.5, despill=1.0, despill_angle=120.0,
                output='matte', video="", in_mask="", out_mask="",
                bg_video=""):
        _need_video(video, "Keyer")
        payload = keyer_video(
            video, mode=mode, key_color=key_color or '#000000',
            softness_lower=_f(softness_lower, -1, 0, -0.5),
            tolerance_lower=_f(tolerance_lower, -1, 0, 0.0),
            center=_f(center, 0, 1, 1.0),
            tolerance_upper=_f(tolerance_upper, 0, 1, 0.0),
            softness_upper=_f(softness_upper, 0, 1, 0.5),
            despill=_f(despill, 0, 2, 1.0),
            despill_angle=_f(despill_angle, 0, 180, 120.0),
            in_mask_url=in_mask or '', out_mask_url=out_mask or '',
            bg_url=bg_video or '', output=output,
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class DespillStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.DespillStage",
            display_name="Despill",
            category="ComfyTV/Keying",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("screen", ['green', 'blue'], 'green'),
                _hidden_float("spill_mix", 0.5, 0.0, 1.0),
                _hidden_float("expand", 0.0, 0.0, 1.0),
                _hidden_float("red_scale", 0.0, -2.0, 2.0),
                _hidden_float("green_scale", -1.0, -2.0, 2.0),
                _hidden_float("blue_scale", 0.0, -2.0, 2.0),
                _hidden_float("brightness", 0.0, -1.0, 1.0),
                io.Boolean.Input("output_spillmap", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                screen='green', spill_mix=0.5, expand=0.0, red_scale=0.0,
                green_scale=-1.0, blue_scale=0.0, brightness=0.0,
                output_spillmap=False, video=""):
        _need_video(video, "Despill")
        payload = despill_video(
            video, screen=screen, spill_mix=_f(spill_mix, 0, 1, 0.5),
            expand=_f(expand, 0, 1, 0.0),
            red_scale=_f(red_scale, -2, 2, 0.0),
            green_scale=_f(green_scale, -2, 2, -1.0),
            blue_scale=_f(blue_scale, -2, 2, 0.0),
            brightness=_f(brightness, -1, 1, 0.0),
            output_spillmap=bool(output_spillmap),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class ColorSuppressStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ColorSuppressStage",
            display_name="Color Suppress",
            category="ComfyTV/Keying",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("red", 0.0, 0.0, 1.0),
                _hidden_float("green", 0.0, 0.0, 1.0),
                _hidden_float("blue", 0.0, 0.0, 1.0),
                _hidden_float("cyan", 0.0, 0.0, 1.0),
                _hidden_float("magenta", 0.0, 0.0, 1.0),
                _hidden_float("yellow", 0.0, 0.0, 1.0),
                io.Boolean.Input("preserve_luma", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                _hidden_combo("output", ['image', 'matte'], 'image'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                red=0.0, green=0.0, blue=0.0, cyan=0.0, magenta=0.0,
                yellow=0.0, preserve_luma=False, output='image', video=""):
        _need_video(video, "Color Suppress")
        vals = {k: _f(v, 0, 1, 0.0) for k, v in
                (('red', red), ('green', green), ('blue', blue),
                 ('cyan', cyan), ('magenta', magenta), ('yellow', yellow))}
        if not any(vals.values()):
            raise RuntimeError(
                "Color Suppress: all amounts are zero — raise one first.")
        payload = color_suppress_video(
            video, preserve_luma=bool(preserve_luma), output=output,
            progress=_progress_cb(cls), **vals)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class KeyMixStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.KeyMixStage",
            display_name="Key Mix",
            category="ComfyTV/Keying",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("mix", 1.0, 0.0, 1.0),
                io.Boolean.Input("invert_mask", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video_a", optional=True),
                COMFYTV_VIDEO.Input("video_b", optional=True),
                COMFYTV_VIDEO.Input("mask_video", optional=True),
                COMFYTV_IMAGE.Input("mask", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mix=1.0, invert_mask=False, video_a="", video_b="",
                mask_video="", mask=""):
        if not (video_a or '').strip() or not (video_b or '').strip():
            raise RuntimeError(
                "Key Mix needs two videos — A goes over B where the mask is white.")
        mk = (mask_video or '').strip() or (mask or '').strip()
        if not mk:
            raise RuntimeError(
                "Key Mix needs a mask — wire a matte video or mask image.")
        payload = keymix_videos(
            video_a, video_b, mk, mix=_f(mix, 0, 1, 1.0),
            invert_mask=bool(invert_mask), progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class MatteMonitorStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MatteMonitorStage",
            display_name="Matte Monitor",
            category="ComfyTV/Keying",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("slope", 0.5, 0.0, 1.0),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                slope=0.5, video=""):
        _need_video(video, "Matte Monitor")
        payload = matte_monitor_video(video, slope=_f(slope, 0, 1, 0.5),
                                      progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class MatteMorphStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MatteMorphStage",
            display_name="Matte Morphology",
            category="ComfyTV/Keying",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("op", ['erode', 'dilate', 'open', 'close'],
                              'erode'),
                _hidden_int("size_x", 1, 0, 64),
                _hidden_int("size_y", 1, 0, 64),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                op='erode', size_x=1, size_y=1, video=""):
        _need_video(video, "Matte Morphology")
        payload = morphology_video(
            video, op=op, size_x=min(64, max(0, int(size_x or 0))),
            size_y=min(64, max(0, int(size_y or 0))),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
