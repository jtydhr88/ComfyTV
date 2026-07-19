from ._common import *  # noqa: F401, F403
from ...runners.media import get_video_info
from ...runners.media_filter import filter_video
from ...runners.stabilize import stabilize_video

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_combo,
)


class VideoBlurSharpenStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoBlurSharpenStage",
            display_name="Blur / Sharpen",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ['gaussian', 'box', 'bilateral', 'sharpen'],
                              'gaussian'),
                _hidden_float("amount", 2.0, 0.0, 20.0, step=0.1),
                _hidden_int("size", 5, 3, 13, "unsharp/box kernel size (odd)"),
                _hidden_float("edge_preserve", 0.1, 0.01, 1.0,
                              tooltip="bilateral sigmaR — lower keeps edges harder"),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video"), COMFYTV_FXSPEC.Output("fx_spec")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='gaussian', amount=2.0, size=5, edge_preserve=0.1, video=""):
        amount = _f(amount, 0.0, 20.0, 2.0)
        size = int(size or 5)
        size += (size + 1) % 2
        size = min(13, max(3, size))
        if mode == 'gaussian':
            if amount <= 0:
                raise RuntimeError("Blur: amount must be > 0")
            spec = ('gblur', f'sigma={amount}')
        elif mode == 'box':
            spec = ('avgblur', f'sizeX={max(1, int(amount))}')
        elif mode == 'bilateral':
            spec = ('bilateral',
                    f'sigmaS={max(0.1, amount)}:sigmaR={_f(edge_preserve, 0.01, 1.0, 0.1)}')
        elif mode == 'sharpen':
            spec = ('unsharp',
                    f'luma_msize_x={size}:luma_msize_y={size}:luma_amount={_f(amount, 0.0, 5.0, 1.0)}')
        else:
            raise RuntimeError(f"Blur / Sharpen: unknown mode {mode!r}")
        fx_spec = build_fx_spec("ComfyTV.VideoBlurSharpenStage", "Blur / Sharpen",
                                "video", [spec])
        if not (video or '').strip():
            return _fx_spec_only(fx_spec)
        payload = filter_video(video, [spec], progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                extra_outputs=(fx_spec,))


class VideoDenoiseStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoDenoiseStage",
            display_name="Video Denoise",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("method",
                              ['atadenoise', 'nlmeans', 'fftdnoiz', 'deband', 'gradfun'],
                              'atadenoise'),
                _hidden_float("strength", 0.3, 0.0, 1.0),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video"), COMFYTV_FXSPEC.Output("fx_spec")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                method='atadenoise', strength=0.3, video=""):
        s = _f(strength, 0.0, 1.0, 0.3)
        if s <= 0:
            raise RuntimeError("Video Denoise: strength must be > 0")
        if method == 'atadenoise':
            v = 0.02 + s * 0.28
            spec = ('atadenoise', ':'.join(f'{k}={v:.4f}'
                                           for k in ('0a', '0b', '1a', '1b', '2a', '2b')))
        elif method == 'nlmeans':
            spec = ('nlmeans', f's={1.0 + s * 29.0:.2f}:p=7:r=15')
        elif method == 'fftdnoiz':
            spec = ('fftdnoiz', f'sigma={s * 30.0:.2f}')
        elif method == 'deband':
            t = 0.005 + s * 0.045
            spec = ('deband', ':'.join(f'{k}={t:.5f}' for k in ('1thr', '2thr', '3thr', '4thr')))
        elif method == 'gradfun':
            spec = ('gradfun', f'strength={0.51 + s * 10.0:.2f}:radius=16')
        else:
            raise RuntimeError(f"Video Denoise: unknown method {method!r}")
        fx_spec = build_fx_spec("ComfyTV.VideoDenoiseStage", "Video Denoise",
                                "video", [spec])
        if not (video or '').strip():
            return _fx_spec_only(fx_spec)
        payload = filter_video(video, [spec], progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                extra_outputs=(fx_spec,))


class VideoInterpolateStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoInterpolateStage",
            display_name="Frame Interpolate",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("mode", ['retime_fps', 'slowmo'], 'retime_fps'),
                _hidden_int("target_fps", 60, 24, 120),
                _hidden_float("slow_factor", 2.0, 2.0, 8.0, step=0.5),
                _hidden_combo("mi_mode", ['mci', 'blend', 'dup'], 'mci'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='retime_fps', target_fps=60, slow_factor=2.0, mi_mode='mci',
                video=""):
        _need_video(video, "Frame Interpolate")
        info = get_video_info(video)
        if mode == 'retime_fps':
            fps = min(120, max(24, int(target_fps or 60)))
            specs = [('minterpolate', f'fps={fps}:mi_mode={mi_mode}')]
            payload = filter_video(video, specs, out_fps=fps,
                                   progress=_progress_cb(cls))
        else:
            n = _f(slow_factor, 2.0, 8.0, 2.0)
            src_fps = info['fps'] or 24
            specs = [
                ('minterpolate', f'fps={src_fps * n:.3f}:mi_mode={mi_mode}'),
                ('setpts', f'{n}*PTS'),
            ]
            audio = []
            remain = 1.0 / n
            while remain < 0.5 - 1e-9:
                audio.append(('atempo', '0.5'))
                remain /= 0.5
            audio.append(('atempo', f'{remain:.6f}'))
            payload = filter_video(video, specs, audio_specs=audio,
                                   out_fps=src_fps, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoDeinterlaceStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoDeinterlaceStage",
            display_name="Deinterlace",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("method", ['bwdif', 'yadif', 'estdif', 'w3fdif'], 'bwdif'),
                _hidden_combo("rate", ['frame', 'field'], 'frame',
                              "field doubles the output frame rate"),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video"), COMFYTV_FXSPEC.Output("fx_spec")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                method='bwdif', rate='frame', video=""):
        if method in ('bwdif', 'yadif'):
            spec = (method, f"mode={'send_field' if rate == 'field' else 'send_frame'}")
        elif method == 'estdif':
            spec = ('estdif', f"mode={'field' if rate == 'field' else 'frame'}")
        elif method == 'w3fdif':
            spec = ('w3fdif', None)
        else:
            raise RuntimeError(f"Deinterlace: unknown method {method!r}")
        fx_spec = build_fx_spec("ComfyTV.VideoDeinterlaceStage", "Deinterlace",
                                "video", [spec])
        if not (video or '').strip():
            return _fx_spec_only(fx_spec)
        info = get_video_info(video)
        out_fps = info['fps'] * 2 if (rate == 'field' or method == 'w3fdif') else info['fps']
        payload = filter_video(video, [spec], out_fps=out_fps,
                               progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                extra_outputs=(fx_spec,))


class VideoStabilizeStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoStabilizeStage",
            display_name="Video Stabilize",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("range_x", 16, 8, 64, "max horizontal shift searched"),
                _hidden_int("range_y", 16, 8, 64, "max vertical shift searched"),
                _hidden_combo("edge", ['mirror', 'blank', 'original', 'clamp'], 'mirror'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                range_x=16, range_y=16, edge='mirror', video=""):
        _need_video(video, "Video Stabilize")
        edge_map = {'blank': 0, 'original': 1, 'clamp': 2, 'mirror': 3}
        rx = min(64, max(16, round(int(range_x or 16) / 16) * 16))
        spec = ('deshake',
                f'rx={rx}:ry={min(64, max(8, int(range_y)))}'
                f':edge={edge_map.get(edge, 3)}')
        payload = filter_video(video, [spec], progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


class VideoStabilizeV2Stage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoStabilizeV2Stage",
            display_name="Stabilize Pro",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_int("smoothing", 15, 0, 60,
                            "camera-path gaussian radius in frames"),
                _hidden_int("accuracy", 15, 1, 15,
                            "fraction of measurement fields used"),
                io.Boolean.Input("opt_zoom", default=True,
                                 socketless=True, extra_dict={"hidden": True},
                                 tooltip="auto-zoom just enough to hide borders"),
                _hidden_float("extra_zoom", 0.0, 0.0, 30.0, step=0.5),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                smoothing=15, accuracy=15, opt_zoom=True, extra_zoom=0.0,
                video=""):
        _need_video(video, "Stabilize Pro")
        payload = stabilize_video(
            video, smoothing=min(60, max(0, int(smoothing or 15))),
            accuracy=min(15, max(1, int(accuracy or 15))),
            opt_zoom=bool(opt_zoom),
            extra_zoom=_f(extra_zoom, 0, 30, 0.0),
            progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
