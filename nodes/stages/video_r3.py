from ._common import *  # noqa: F401, F403
from ...runners.media_filter import filter_video
from ...runners.temporal import (
    frame_blend_video, time_blur_video, FRAME_BLEND_OPS, SHUTTER_TYPES,
)
from ...runners.patterns import ken_burns_video
from ...runners.retro import old_film_video
from ...runners.audio_react import (
    audio_reactive_keyframes, meter_overlay_video, BANDS,
)

from .video_fx import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)

COLORFX_MODES = ['selectivecolor', 'chromashift', 'pseudocolor', 'elbg',
                 'colorspace', 'grayworld']
PSEUDOCOLOR_PRESETS = ['magma', 'inferno', 'plasma', 'viridis', 'turbo',
                       'cividis', 'range1', 'range2', 'shadows', 'highlights',
                       'solar', 'nominal', 'preferred', 'total', 'spectral',
                       'cool', 'heat', 'fiery', 'blues', 'green', 'helix']
SELECTIVE_ZONES = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas',
                   'whites', 'neutrals', 'blacks']
COLORSPACE_TARGETS = ['bt709', 'bt601-6-625', 'bt2020', 'smpte170m']
ANNOTATE_MODES = ['box', 'grid', 'fillborders', 'scroll']
FILLBORDER_MODES = ['smear', 'mirror', 'fixed', 'reflect', 'wrap', 'fade']


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


class ColorFXStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        zones = [_hidden_float(f"sc_{z}", 0.0, -1.0, 1.0) for z in SELECTIVE_ZONES]
        return io.Schema(
            node_id="ComfyTV.ColorFXStage",
            display_name="Color FX",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", COLORFX_MODES, 'selectivecolor'),
                _hidden_combo("sc_method", ['absolute', 'relative'], 'absolute'),
                *zones,
                _hidden_float("shift_rh", 0.0, -255.0, 255.0, step=1.0),
                _hidden_float("shift_rv", 0.0, -255.0, 255.0, step=1.0),
                _hidden_float("shift_bh", 0.0, -255.0, 255.0, step=1.0),
                _hidden_float("shift_bv", 0.0, -255.0, 255.0, step=1.0),
                _hidden_combo("shift_edge", ['smear', 'wrap'], 'smear'),
                _hidden_combo("pseudo_preset", PSEUDOCOLOR_PRESETS, 'viridis'),
                _hidden_float("pseudo_opacity", 1.0, 0.0, 1.0),
                _hidden_int("elbg_colors", 9, 1, 50),
                _hidden_int("elbg_steps", 1, 1, 10),
                _hidden_combo("cs_target", COLORSPACE_TARGETS, 'bt709'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='selectivecolor', sc_method='absolute',
                shift_rh=0.0, shift_rv=0.0, shift_bh=0.0, shift_bv=0.0,
                shift_edge='smear', pseudo_preset='viridis',
                pseudo_opacity=1.0, elbg_colors=9, elbg_steps=1,
                cs_target='bt709', video="", **kwargs):
        _need_video(video, "Color FX")
        if mode == 'selectivecolor':
            parts = [f'correction_method={sc_method}']
            any_zone = False
            for z in SELECTIVE_ZONES:
                v = _f(kwargs.get(f'sc_{z}', 0.0), -1, 1, 0.0)
                if v:
                    any_zone = True
                    parts.append(f'{z}={v}')
            if not any_zone:
                raise RuntimeError(
                    "Color FX: all selective-color zones are zero — adjust one.")
            specs = [('selectivecolor', ':'.join(parts))]
        elif mode == 'chromashift':
            rh = _f(shift_rh, -255, 255, 0.0)
            rv = _f(shift_rv, -255, 255, 0.0)
            bh = _f(shift_bh, -255, 255, 0.0)
            bv = _f(shift_bv, -255, 255, 0.0)
            if not any((rh, rv, bh, bv)):
                raise RuntimeError("Color FX: all chroma shifts are zero.")
            edge = 0 if shift_edge == 'smear' else 1
            specs = [('chromashift',
                      f'crh={int(rh)}:crv={int(rv)}:cbh={int(bh)}'
                      f':cbv={int(bv)}:edge={edge}')]
        elif mode == 'pseudocolor':
            p = pseudo_preset if pseudo_preset in PSEUDOCOLOR_PRESETS \
                else 'viridis'
            specs = [('pseudocolor',
                      f'preset={p}:opacity={_f(pseudo_opacity, 0, 1, 1.0)}')]
        elif mode == 'elbg':
            specs = [('elbg',
                      f'codebook_length={min(50, max(1, int(elbg_colors)))}'
                      f':nb_steps={min(10, max(1, int(elbg_steps)))}')]
        elif mode == 'colorspace':
            t = cs_target if cs_target in COLORSPACE_TARGETS else 'bt709'
            specs = [('colorspace', f'all={t}:format=yuv420p')]
        elif mode == 'grayworld':
            specs = [('grayworld', None)]
        else:
            raise RuntimeError(f"Color FX: unknown mode {mode!r}")
        payload = filter_video(video, specs, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class KenBurnsStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.KenBurnsStage",
            display_name="Ken Burns",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("width", 1280, 16, 4096),
                _hidden_int("height", 720, 16, 4096),
                _hidden_int("fps", 24, 1, 120),
                _hidden_float("duration", 5.0, 0.5, 120.0, step=0.5),
                _hidden_float("start_zoom", 1.0, 1.0, 6.0),
                _hidden_float("end_zoom", 1.3, 1.0, 6.0),
                _hidden_float("start_x", 0.5, 0.0, 1.0),
                _hidden_float("start_y", 0.5, 0.0, 1.0),
                _hidden_float("end_x", 0.5, 0.0, 1.0),
                _hidden_float("end_y", 0.5, 0.0, 1.0),
                _hidden_combo("interp", ['linear', 'smooth', 'ease_in',
                                         'ease_out'], 'smooth'),
                COMFYTV_IMAGE.Input("image", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                width=1280, height=720, fps=24, duration=5.0,
                start_zoom=1.0, end_zoom=1.3, start_x=0.5, start_y=0.5,
                end_x=0.5, end_y=0.5, interp='smooth', image=""):
        if not (image or '').strip():
            raise RuntimeError(
                "Ken Burns needs an image — wire one into the image input.")
        payload = ken_burns_video(
            image, width=int(width), height=int(height), fps=int(fps),
            duration=_f(duration, 0.5, 120, 5.0),
            start_zoom=_f(start_zoom, 1, 6, 1.0),
            end_zoom=_f(end_zoom, 1, 6, 1.3),
            start_x=_f(start_x, 0, 1, 0.5), start_y=_f(start_y, 0, 1, 0.5),
            end_x=_f(end_x, 0, 1, 0.5), end_y=_f(end_y, 0, 1, 0.5),
            interp=interp, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


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
        _need_video(video, "Old Film")
        payload = old_film_video(
            video, delta=min(400, max(0, int(delta))),
            every=min(100, max(0, int(every))),
            brightness_up=min(100, max(0, int(brightness_up))),
            brightness_down=min(100, max(0, int(brightness_down))),
            brightness_every=min(100, max(0, int(brightness_every))),
            develop_up=min(100, max(0, int(develop_up))),
            develop_down=min(100, max(0, int(develop_down))),
            develop_duration=min(10000, max(0, int(develop_duration))),
            lines_num=min(100, max(0, int(lines_num))),
            line_width=min(100, max(0, int(line_width))),
            lines_darker=min(100, max(0, int(lines_darker))),
            lines_lighter=min(100, max(0, int(lines_lighter))),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AnnotateStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AnnotateStage",
            display_name="Annotate",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ANNOTATE_MODES, 'box'),
                _hidden_float("x", 0.25, 0.0, 1.0),
                _hidden_float("y", 0.25, 0.0, 1.0),
                _hidden_float("w", 0.5, 0.0, 1.0),
                _hidden_float("h", 0.5, 0.0, 1.0),
                _hidden_str("color", "#4ADE80"),
                _hidden_int("thickness", 3, 1, 40),
                _hidden_float("opacity", 1.0, 0.0, 1.0),
                _hidden_combo("border_mode", FILLBORDER_MODES, 'mirror'),
                _hidden_int("border_px", 32, 0, 512),
                _hidden_float("scroll_h", 0.0, -1.0, 1.0),
                _hidden_float("scroll_v", 0.0, -1.0, 1.0),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='box', x=0.25, y=0.25, w=0.5, h=0.5, color="#4ADE80",
                thickness=3, opacity=1.0, border_mode='mirror', border_px=32,
                scroll_h=0.0, scroll_v=0.0, video=""):
        _need_video(video, "Annotate")
        col = (color or '#4ADE80').lstrip('#')
        op = _f(opacity, 0, 1, 1.0)
        th = min(40, max(1, int(thickness)))
        if mode == 'box':
            specs = [('drawbox',
                      f'x=iw*{_f(x, 0, 1, 0.25)}:y=ih*{_f(y, 0, 1, 0.25)}'
                      f':w=iw*{_f(w, 0, 1, 0.5)}:h=ih*{_f(h, 0, 1, 0.5)}'
                      f':color=0x{col}@{op}:t={th}')]
        elif mode == 'grid':
            specs = [('drawgrid',
                      f'w=iw*{max(0.01, _f(w, 0, 1, 0.5))}'
                      f':h=ih*{max(0.01, _f(h, 0, 1, 0.5))}'
                      f':color=0x{col}@{op}:t={th}')]
        elif mode == 'fillborders':
            px = min(512, max(0, int(border_px)))
            if px <= 0:
                raise RuntimeError("Annotate: border size is zero.")
            bm = border_mode if border_mode in FILLBORDER_MODES else 'mirror'
            specs = [('fillborders',
                      f'left={px}:right={px}:top={px}:bottom={px}:mode={bm}')]
        elif mode == 'scroll':
            sh = _f(scroll_h, -1, 1, 0.0)
            sv = _f(scroll_v, -1, 1, 0.0)
            if not sh and not sv:
                raise RuntimeError("Annotate: scroll speed is zero.")
            specs = [('scroll', f'horizontal={sh}:vertical={sv}')]
        else:
            raise RuntimeError(f"Annotate: unknown mode {mode!r}")
        payload = filter_video(video, specs, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioReactiveStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioReactiveStage",
            display_name="Audio Reactive",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("band", list(BANDS) + ['custom'], 'bass'),
                _hidden_float("freq_lo", 40.0, 10.0, 16000.0, step=10.0),
                _hidden_float("freq_hi", 200.0, 20.0, 16000.0, step=10.0),
                _hidden_float("attack", 0.02, 0.001, 1.0, step=0.001),
                _hidden_float("release", 0.25, 0.01, 2.0, step=0.01),
                _hidden_float("rate", 10.0, 1.0, 60.0, step=1.0),
                _hidden_float("min_value", 0.0, -1000.0, 1000.0),
                _hidden_float("max_value", 1.0, -1000.0, 1000.0),
                _hidden_float("gain", 1.0, 0.1, 8.0),
                _hidden_combo("field", ['v', 'scale', 'opacity', 'x', 'y',
                                        'rotation'], 'v'),
                COMFYTV_AUDIO.Input("audio", optional=True),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_TEXT.Output("keyframes")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                band='bass', freq_lo=40.0, freq_hi=200.0, attack=0.02,
                release=0.25, rate=10.0, min_value=0.0, max_value=1.0,
                gain=1.0, field='v', audio="", video=""):
        src = (audio or '').strip() or (video or '').strip()
        if not src:
            raise RuntimeError(
                "Audio Reactive needs an audio (or video with audio) input.")
        payload = audio_reactive_keyframes(
            src, band=band, freq_lo=_f(freq_lo, 10, 16000, 40.0),
            freq_hi=_f(freq_hi, 20, 16000, 200.0),
            attack=_f(attack, 0.001, 1, 0.02),
            release=_f(release, 0.01, 2, 0.25),
            rate=_f(rate, 1, 60, 10.0),
            min_value=_f(min_value, -1000, 1000, 0.0),
            max_value=_f(max_value, -1000, 1000, 1.0),
            gain=_f(gain, 0.1, 8, 1.0), field=field,
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class AudioMeterStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioMeterStage",
            display_name="Audio Meter Overlay",
            category="ComfyTV/AudioFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("meter_w", 400, 80, 1920),
                _hidden_int("meter_h", 20, 8, 120),
                _hidden_combo("corner", ['bottom-left', 'bottom-right',
                                         'top-left', 'top-right'],
                              'bottom-left'),
                _hidden_int("margin", 16, 0, 200),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                meter_w=400, meter_h=20, corner='bottom-left', margin=16,
                video=""):
        _need_video(video, "Audio Meter Overlay")
        payload = meter_overlay_video(
            video, meter_w=min(1920, max(80, int(meter_w))),
            meter_h=min(120, max(8, int(meter_h))), corner=corner,
            margin=min(200, max(0, int(margin))),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
