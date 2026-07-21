from ._common import *  # noqa: F401, F403
from ...runners.media_filter import filter_video
from ...runners.video_stylize_ops import (
    glow_video, god_rays_video, old_film_video,
)
from ...runners.temporal import (
    frame_blend_video, time_blur_video, FRAME_BLEND_OPS, SHUTTER_TYPES,
)

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_combo,
)


_SEPIA = '.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0'

STYLIZE_EFFECTS = ['vignette', 'grain', 'pixelize', 'edge', 'sepia',
                   'monochrome', 'old_film']


class VideoStylizeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoStylizeStage",
            display_name="Video Stylize",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("effect", STYLIZE_EFFECTS, 'vignette'),
                _hidden_float("strength", 0.5, 0.0, 1.0),
                _hidden_int("block", 8, 2, 64, "pixelize block size"),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                effect='vignette', strength=0.5, block=8, video=""):
        s = _f(strength, 0.0, 1.0, 0.5)
        if effect == 'vignette':
            specs = [('vignette', f'angle={max(0.05, s * 1.5):.4f}')]
        elif effect == 'grain':
            specs = [('noise', f'alls={max(1, int(s * 40))}:allf=t+u')]
        elif effect == 'pixelize':
            b = min(64, max(2, int(block or 8)))
            specs = [('pixelize', f'width={b}:height={b}')]
        elif effect == 'edge':
            specs = [('edgedetect', f'low={max(0.02, s * 0.3):.3f}:high={max(0.05, s * 0.6):.3f}:mode=colormix')]
        elif effect == 'sepia':
            specs = [('colorchannelmixer', _SEPIA)]
        elif effect == 'monochrome':
            specs = [('monochrome', None)]
        elif effect == 'old_film':
            specs = [
                ('curves', 'preset=vintage'),
                ('noise', f'alls={max(1, int(s * 30))}:allf=t+u'),
                ('vignette', f'angle={max(0.05, s * 1.2):.4f}'),
            ]
        else:
            raise RuntimeError(f"Video Stylize: unknown effect {effect!r}")
        fx_spec = build_fx_spec(
            "ComfyTV.VideoStylizeStage", "Video Stylize", "video", specs,
            params={'effect': effect, 'strength': s,
                    'block': min(64, max(2, int(block or 8)))})
        return _fx_passthrough(video, fx_spec)


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
        fx_spec = build_torch_fx_spec(
            "ComfyTV.GlowStage", "Glow", "video", "glow",
            {'threshold': _f(threshold, 0, 0.99, 0.7),
             'size': _f(size, 0.5, 50, 4.0),
             'bloom_ratio': _f(bloom_ratio, 1.1, 4, 2.0),
             'bloom_count': min(8, max(1, int(bloom_count or 5))),
             'gain': _f(gain, 0, 8, 1.0), 'mix': _f(mix, 0, 1, 1.0)})
        return _fx_passthrough(video, fx_spec)


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
        fx_spec = build_torch_fx_spec(
            "ComfyTV.GodRaysStage", "God Rays", "video", "god_rays",
            {'translate_x': float(translate_x or 0),
             'translate_y': float(translate_y or 0),
             'scale': _f(scale, 0.2, 4, 1.4),
             'rotate_deg': float(rotate_deg or 0),
             'steps': min(7, max(1, int(steps or 5))),
             'decay': _f(decay, 0.001, 1, 0.3),
             'max_mode': bool(max_mode), 'mix': _f(mix, 0, 1, 1.0)})
        return _fx_passthrough(video, fx_spec)


class OldFilmStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.OldFilmStage",
            display_name="Old Film",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("delta", 14, 0, 400),
                _hidden_int("every", 20, 0, 100),
                _hidden_int("brightness_up", 20, 0, 100),
                _hidden_int("brightness_down", 30, 0, 100),
                _hidden_int("brightness_every", 70, 0, 100),
                _hidden_int("develop_up", 60, 0, 100),
                _hidden_int("develop_down", 20, 0, 100),
                _hidden_int("develop_duration", 70, 0, 10000),
                _hidden_int("lines_num", 5, 0, 100),
                _hidden_int("line_width", 2, 0, 100),
                _hidden_int("lines_darker", 40, 0, 100),
                _hidden_int("lines_lighter", 40, 0, 100),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                delta=14, every=20, brightness_up=20, brightness_down=30,
                brightness_every=70, develop_up=60, develop_down=20,
                develop_duration=70, lines_num=5, line_width=2,
                lines_darker=40, lines_lighter=40, video=""):
        fx_spec = build_torch_fx_spec(
            "ComfyTV.OldFilmStage", "Old Film", "video", "old_film",
            {'delta': min(400, max(0, int(delta))),
             'every': min(100, max(0, int(every))),
             'brightness_up': min(100, max(0, int(brightness_up))),
             'brightness_down': min(100, max(0, int(brightness_down))),
             'brightness_every': min(100, max(0, int(brightness_every))),
             'develop_up': min(100, max(0, int(develop_up))),
             'develop_down': min(100, max(0, int(develop_down))),
             'develop_duration': min(10000, max(0, int(develop_duration))),
             'lines_num': min(100, max(0, int(lines_num))),
             'line_width': min(100, max(0, int(line_width))),
             'lines_darker': min(100, max(0, int(lines_darker))),
             'lines_lighter': min(100, max(0, int(lines_lighter)))})
        return _fx_passthrough(video, fx_spec)


PSEUDOCOLOR_PRESETS = ['magma', 'inferno', 'plasma', 'viridis', 'turbo',
                       'cividis', 'range1', 'range2', 'shadows', 'highlights',
                       'solar', 'nominal', 'preferred', 'total', 'spectral',
                       'cool', 'heat', 'fiery', 'blues', 'green', 'helix']


class ChromaShiftStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ChromaShiftStage",
            display_name="Chroma Shift",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("shift_rh", 0.0, -255.0, 255.0, step=1.0),
                _hidden_float("shift_rv", 0.0, -255.0, 255.0, step=1.0),
                _hidden_float("shift_bh", 0.0, -255.0, 255.0, step=1.0),
                _hidden_float("shift_bv", 0.0, -255.0, 255.0, step=1.0),
                _hidden_combo("shift_edge", ['smear', 'wrap'], 'smear'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                shift_rh=0.0, shift_rv=0.0, shift_bh=0.0, shift_bv=0.0,
                shift_edge='smear', video=""):
        rh = _f(shift_rh, -255, 255, 0.0)
        rv = _f(shift_rv, -255, 255, 0.0)
        bh = _f(shift_bh, -255, 255, 0.0)
        bv = _f(shift_bv, -255, 255, 0.0)
        if not any((rh, rv, bh, bv)):
            return _fx_identity(video)
        edge = 0 if shift_edge == 'smear' else 1
        fx_spec = build_fx_spec(
            "ComfyTV.ChromaShiftStage", "Chroma Shift", "video",
            [('chromashift',
              f'crh={int(rh)}:crv={int(rv)}:cbh={int(bh)}'
              f':cbv={int(bv)}:edge={edge}')],
            params={'shift_rh': rh, 'shift_rv': rv, 'shift_bh': bh,
                    'shift_bv': bv, 'shift_edge': shift_edge})
        return _fx_passthrough(video, fx_spec)


class PseudocolorStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.PseudocolorStage",
            display_name="Pseudocolor",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("pseudo_preset", PSEUDOCOLOR_PRESETS, 'viridis'),
                _hidden_float("pseudo_opacity", 1.0, 0.0, 1.0),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                pseudo_preset='viridis', pseudo_opacity=1.0, video=""):
        p = pseudo_preset if pseudo_preset in PSEUDOCOLOR_PRESETS else 'viridis'
        fx_spec = build_fx_spec(
            "ComfyTV.PseudocolorStage", "Pseudocolor", "video",
            [('pseudocolor',
              f'preset={p}:opacity={_f(pseudo_opacity, 0, 1, 1.0)}')],
            params={'pseudo_preset': p,
                    'pseudo_opacity': _f(pseudo_opacity, 0, 1, 1.0)})
        return _fx_passthrough(video, fx_spec)


class PosterizeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.PosterizeStage",
            display_name="Posterize",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("elbg_colors", 9, 1, 50),
                _hidden_int("elbg_steps", 1, 1, 10),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                elbg_colors=9, elbg_steps=1, video=""):
        fx_spec = build_fx_spec(
            "ComfyTV.PosterizeStage", "Posterize", "video",
            [('elbg',
              f'codebook_length={min(50, max(1, int(elbg_colors)))}'
              f':nb_steps={min(10, max(1, int(elbg_steps)))}')],
            params={'elbg_colors': min(50, max(1, int(elbg_colors))),
                    'elbg_steps': min(10, max(1, int(elbg_steps)))})
        return _fx_passthrough(video, fx_spec)


class FrameBlendStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.FrameBlendStage",
            display_name="Frame Blend",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ['window', 'shutter'], 'window'),
                _hidden_int("frame_min", -5, -60, 0),
                _hidden_int("frame_max", 0, 0, 60),
                _hidden_int("interval", 1, 1, 10),
                _hidden_combo("operation", list(FRAME_BLEND_OPS), 'average'),
                _hidden_float("decay", 0.0, 0.0, 1.0),
                _hidden_float("shutter", 0.5, 0.0, 8.0, step=0.05),
                _hidden_combo("shutter_type", list(SHUTTER_TYPES), 'centered'),
                _hidden_float("shutter_offset", 0.0, -8.0, 8.0, step=0.05),
                _hidden_int("divisions", 10, 1, 64),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='window', frame_min=-5, frame_max=0, interval=1,
                operation='average', decay=0.0, shutter=0.5,
                shutter_type='centered', shutter_offset=0.0, divisions=10,
                video=""):
        _need_video(video, "Frame Blend")
        if mode == 'shutter':
            payload = time_blur_video(
                video, shutter=_f(shutter, 0, 8, 0.5),
                shutter_type=shutter_type,
                shutter_offset=_f(shutter_offset, -8, 8, 0.0),
                divisions=min(64, max(1, int(divisions or 10))),
                progress=_progress_cb(cls))
        else:
            payload = frame_blend_video(
                video, frame_min=min(0, max(-60, int(frame_min))),
                frame_max=min(60, max(0, int(frame_max))),
                interval=min(10, max(1, int(interval or 1))),
                operation=operation, decay=_f(decay, 0, 1, 0.0),
                progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
