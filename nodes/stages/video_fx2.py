from ._common import *  # noqa: F401, F403
from ...runners.uvmap import uv_remap_video
from ...runners.mask_propagate import propagate_mask_video
from ...runners.fx_torch import hue_correct_video, glow_video, god_rays_video
from ...runners.patterns import generate_pattern_video, PATTERN_KINDS, RAMP_INTERPS

from .video_fx import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)
from .video_pro import _parse_json


class STMapStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.STMapStage",
            display_name="UV Remap",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ['stmap', 'idistort'], 'stmap'),
                _hidden_combo("wrap", ['clamp', 'repeat', 'mirror'], 'clamp'),
                io.Boolean.Input("flip_v", default=True,
                                 socketless=True, extra_dict={"hidden": True}),
                _hidden_float("amount", 32.0, 0.0, 512.0, step=1.0),
                _hidden_float("u_offset", 0.0, -1.0, 1.0),
                _hidden_float("v_offset", 0.0, -1.0, 1.0),
                _hidden_float("u_scale", 1.0, -4.0, 4.0),
                _hidden_float("v_scale", 1.0, -4.0, 4.0),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_VIDEO.Input("uv_video", optional=True),
                COMFYTV_IMAGE.Input("uv_image", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='stmap', wrap='clamp', flip_v=True, amount=32.0,
                u_offset=0.0, v_offset=0.0, u_scale=1.0, v_scale=1.0,
                video="", uv_video="", uv_image=""):
        _need_video(video, "UV Remap")
        uv = (uv_video or '').strip() or (uv_image or '').strip()
        if not uv:
            raise RuntimeError(
                "UV Remap needs a UV source — wire a uv_video or uv_image input."
            )
        payload = uv_remap_video(
            video, uv, mode=mode, wrap=wrap, flip_v=bool(flip_v),
            amount=_f(amount, 0, 512, 32.0),
            u_offset=_f(u_offset, -1, 1), v_offset=_f(v_offset, -1, 1),
            u_scale=_f(u_scale, -4, 4, 1.0), v_scale=_f(v_scale, -4, 4, 1.0),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class MaskPropagateStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.MaskPropagateStage",
            display_name="Mask Propagate",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("model", ['translation', 'similarity', 'perspective'],
                              'similarity'),
                _hidden_float("t_ref", 0.0, 0.0, 3600.0, step=0.05),
                _hidden_int("max_points", 24, 4, 64),
                io.Boolean.Input("invert", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_IMAGE.Input("mask", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("mask")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                model='similarity', t_ref=0.0, max_points=24, invert=False,
                video="", mask=""):
        _need_video(video, "Mask Propagate")
        if not (mask or '').strip():
            raise RuntimeError(
                "Mask Propagate needs a first-frame mask image — wire one in "
                "(the Split Part stage's SAM output works)."
            )
        payload = propagate_mask_video(
            video, mask, t_ref=_f(t_ref, 0, 3600, 0.0), model=model,
            max_points=min(64, max(4, int(max_points or 24))),
            invert=bool(invert), progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class SubtitleGenStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.SubtitleGenStage",
            display_name="Subtitles · Speech-to-Text",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('speech-to-text'),
                               default=default_for('speech-to-text'),
                               tooltip="Which speech-to-text workflow to run."),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_AUDIO.Input("audio", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("subtitles")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", video="", audio=""):
        upstream = {}
        if (audio or '').strip():
            upstream['audio'] = [audio]
        elif (video or '').strip():
            upstream['videos'] = [video]
        else:
            raise RuntimeError(
                "Speech-to-Text needs an upstream audio or video."
            )
        return await run_stage_workflow(
            cls,
            kind='speech-to-text',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=None,
            upstream=upstream,
            options={},
        )


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
        _need_video(video, "Hue Correct")
        payload = hue_correct_video(
            video, curves, sat_thrsh=_f(sat_thrsh, 0, 1, 0.0),
            luminance_mix=_f(luminance_mix, 0, 1, 0.0),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class GlowStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.GlowStage",
            display_name="Glow",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("threshold", 0.7, 0.0, 0.99),
                _hidden_float("size", 4.0, 0.5, 50.0, step=0.5),
                _hidden_float("bloom_ratio", 2.0, 1.1, 4.0),
                _hidden_int("bloom_count", 5, 1, 8),
                _hidden_float("gain", 1.0, 0.0, 8.0),
                _hidden_float("mix", 1.0, 0.0, 1.0),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                threshold=0.7, size=4.0, bloom_ratio=2.0, bloom_count=5,
                gain=1.0, mix=1.0, video=""):
        _need_video(video, "Glow")
        payload = glow_video(
            video, threshold=_f(threshold, 0, 0.99, 0.7),
            size=_f(size, 0.5, 50, 4.0),
            bloom_ratio=_f(bloom_ratio, 1.1, 4, 2.0),
            bloom_count=min(8, max(1, int(bloom_count or 5))),
            gain=_f(gain, 0, 8, 1.0), mix=_f(mix, 0, 1, 1.0),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class GodRaysStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.GodRaysStage",
            display_name="God Rays",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("translate_x", 0.0, -2000.0, 2000.0, step=1.0),
                _hidden_float("translate_y", 0.0, -2000.0, 2000.0, step=1.0),
                _hidden_float("scale", 1.4, 0.2, 4.0),
                _hidden_float("rotate_deg", 0.0, -180.0, 180.0, step=0.5),
                _hidden_int("steps", 5, 1, 7),
                _hidden_float("decay", 0.3, 0.001, 1.0),
                io.Boolean.Input("max_mode", default=False,
                                 socketless=True, extra_dict={"hidden": True}),
                _hidden_float("mix", 1.0, 0.0, 1.0),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                translate_x=0.0, translate_y=0.0, scale=1.4, rotate_deg=0.0,
                steps=5, decay=0.3, max_mode=False, mix=1.0, video=""):
        _need_video(video, "God Rays")
        payload = god_rays_video(
            video, translate_x=float(translate_x or 0),
            translate_y=float(translate_y or 0),
            scale=_f(scale, 0.2, 4, 1.4), rotate_deg=float(rotate_deg or 0),
            steps=min(7, max(1, int(steps or 5))),
            decay=_f(decay, 0.001, 1, 0.3), max_mode=bool(max_mode),
            mix=_f(mix, 0, 1, 1.0), progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class PatternStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.PatternStage",
            display_name="Pattern",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("kind", PATTERN_KINDS, 'ramp'),
                _hidden_int("width", 1280, 16, 4096),
                _hidden_int("height", 720, 16, 4096),
                _hidden_int("fps", 24, 1, 120),
                _hidden_float("duration", 5.0, 0.5, 120.0, step=0.5),
                _hidden_str("color0", "#000000"),
                _hidden_str("color1", "#FFFFFF"),
                _hidden_float("p0_x", 0.0, 0.0, 1.0),
                _hidden_float("p0_y", 0.5, 0.0, 1.0),
                _hidden_float("p1_x", 1.0, 0.0, 1.0),
                _hidden_float("p1_y", 0.5, 0.0, 1.0),
                _hidden_combo("interp", RAMP_INTERPS, 'linear'),
                _hidden_float("softness", 0.0, 0.0, 1.0),
                _hidden_int("noise_scale", 64, 4, 512),
                _hidden_int("noise_octaves", 4, 1, 8),
                _hidden_float("noise_speed", 1.0, 0.0, 10.0),
                _hidden_int("seed", 7, 0, 99999),
                _hidden_int("box_size", 64, 2, 1024),
                _hidden_float("bar_intensity", 75.0, 1.0, 100.0, step=1.0),
                _hidden_float("wheel_gamma", 0.45, 0.0, 4.0),
                _hidden_float("wheel_rotate", 0.0, -180.0, 180.0, step=1.0),
                _hidden_combo("count_style", ['seconds', 'frames'], 'seconds'),
                _hidden_combo("count_direction", ['down', 'up'], 'down'),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                kind='ramp', width=1280, height=720, fps=24, duration=5.0,
                color0="#000000", color1="#FFFFFF",
                p0_x=0.0, p0_y=0.5, p1_x=1.0, p1_y=0.5,
                interp='linear', softness=0.0,
                noise_scale=64, noise_octaves=4, noise_speed=1.0, seed=7,
                box_size=64, bar_intensity=75.0, wheel_gamma=0.45,
                wheel_rotate=0.0, count_style='seconds',
                count_direction='down'):
        payload = generate_pattern_video(
            kind, width=int(width), height=int(height), fps=int(fps),
            duration=_f(duration, 0.5, 120, 5.0),
            color0=color0 or '#000000', color1=color1 or '#FFFFFF',
            p0=(_f(p0_x, 0, 1, 0.0), _f(p0_y, 0, 1, 0.5)),
            p1=(_f(p1_x, 0, 1, 1.0), _f(p1_y, 0, 1, 0.5)),
            interp=interp, softness=_f(softness, 0, 1, 0.0),
            noise_scale=int(noise_scale), noise_octaves=int(noise_octaves),
            noise_speed=_f(noise_speed, 0, 10, 1.0), seed=int(seed or 0),
            box_size=min(1024, max(2, int(box_size or 64))),
            bar_intensity=_f(bar_intensity, 1, 100, 75.0),
            wheel_gamma=_f(wheel_gamma, 0, 4, 0.45),
            wheel_rotate=_f(wheel_rotate, -180, 180, 0.0),
            count_style=count_style, count_direction=count_direction,
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
