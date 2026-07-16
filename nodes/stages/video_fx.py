from ._common import *  # noqa: F401, F403
from ...runners.media import extract_frame, get_video_info
from ...runners.media_filter import (
    filter_video, xfade_videos, scene_detect, filter_frame_image,
    chroma_key_video, XFADE_TRANSITIONS,
)


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


class VideoColorStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        wheel = []
        for zone in ('shadows', 'midtones', 'highlights'):
            for ch in ('r', 'g', 'b'):
                wheel.append(_hidden_float(f"{zone}_{ch}", 0.0, -1.0, 1.0))
        return io.Schema(
            node_id="ComfyTV.VideoColorStage",
            display_name="Video Color",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("exposure", 0.0, -3.0, 3.0),
                _hidden_float("black", 0.0, -0.1, 0.1, step=0.001),
                _hidden_int("temperature", 6500, 1000, 40000),
                _hidden_float("temp_mix", 1.0, 0.0, 1.0),
                _hidden_float("hue", 0.0, -180.0, 180.0, step=1.0),
                _hidden_float("saturation", 0.0, -1.0, 1.0),
                _hidden_float("vibrance", 0.0, -2.0, 2.0),
                *wheel,
                io.Boolean.Input("preserve_lightness", default=True,
                                 socketless=True, extra_dict={"hidden": True}),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                exposure=0.0, black=0.0, temperature=6500, temp_mix=1.0,
                hue=0.0, saturation=0.0, vibrance=0.0,
                shadows_r=0.0, shadows_g=0.0, shadows_b=0.0,
                midtones_r=0.0, midtones_g=0.0, midtones_b=0.0,
                highlights_r=0.0, highlights_g=0.0, highlights_b=0.0,
                preserve_lightness=True, video=""):
        _need_video(video, "Video Color")
        specs = []
        exposure = _f(exposure, -3, 3)
        black = _f(black, -0.1, 0.1)
        if exposure or black:
            specs.append(('exposure', f'exposure={exposure}:black={black}'))
        if int(temperature or 6500) != 6500:
            specs.append(('colortemperature',
                          f'temperature={int(temperature)}:mix={_f(temp_mix, 0, 1, 1.0)}'))
        hue = _f(hue, -180, 180)
        saturation = _f(saturation, -1, 1)
        if hue or saturation:
            specs.append(('huesaturation', f'hue={hue}:saturation={saturation}'))
        vibrance = _f(vibrance, -2, 2)
        if vibrance:
            specs.append(('vibrance', f'intensity={vibrance}'))
        wheels = {
            'rs': _f(shadows_r, -1, 1), 'gs': _f(shadows_g, -1, 1), 'bs': _f(shadows_b, -1, 1),
            'rm': _f(midtones_r, -1, 1), 'gm': _f(midtones_g, -1, 1), 'bm': _f(midtones_b, -1, 1),
            'rh': _f(highlights_r, -1, 1), 'gh': _f(highlights_g, -1, 1), 'bh': _f(highlights_b, -1, 1),
        }
        if any(wheels.values()):
            args = ':'.join(f'{k}={v}' for k, v in wheels.items() if v)
            if preserve_lightness:
                args += ':pl=1'
            specs.append(('colorbalance', args))
        if not specs:
            raise RuntimeError("Video Color: everything is at neutral — adjust something first.")
        payload = filter_video(video, specs, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


CURVES_PRESETS = ['none', 'color_negative', 'cross_process', 'darker',
                  'increase_contrast', 'lighter', 'linear_contrast',
                  'medium_contrast', 'negative', 'strong_contrast', 'vintage']

_CURVE_PT_RE = None


def _curve_points_arg(raw: str) -> str:
    global _CURVE_PT_RE
    if not (raw or '').strip():
        return ''
    try:
        pts = json.loads(raw)
    except (ValueError, TypeError):
        return ''
    good = []
    for p in pts or []:
        try:
            x, y = float(p[0]), float(p[1])
        except (TypeError, ValueError, IndexError):
            continue
        good.append((min(1.0, max(0.0, x)), min(1.0, max(0.0, y))))
    good.sort()
    if len(good) < 2:
        return ''
    return ' '.join(f'{x:.4f}/{y:.4f}' for x, y in good)


class VideoCurvesStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoCurvesStage",
            display_name="Video Curves",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("preset", CURVES_PRESETS, 'none'),
                _hidden_str("master_pts", "", "JSON [[x,y],...] control points 0..1"),
                _hidden_str("red_pts", ""),
                _hidden_str("green_pts", ""),
                _hidden_str("blue_pts", ""),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                preset='none', master_pts="", red_pts="", green_pts="", blue_pts="",
                video=""):
        _need_video(video, "Video Curves")
        parts = []
        if preset and preset != 'none':
            parts.append(f'preset={preset}')
        for key, raw in (('master', master_pts), ('red', red_pts),
                         ('green', green_pts), ('blue', blue_pts)):
            arg = _curve_points_arg(raw)
            if arg:
                parts.append(f'{key}={arg}')
        if not parts:
            raise RuntimeError("Video Curves: no curve set — bend a curve or pick a preset.")
        payload = filter_video(video, [('curves', ':'.join(parts))],
                               progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


def _lut_dir():
    import folder_paths
    from pathlib import Path
    d = Path(folder_paths.get_input_directory()) / 'comfytv-luts'
    d.mkdir(parents=True, exist_ok=True)
    return d


def list_lut_files() -> list:
    exts = {'.cube', '.3dl', '.dat', '.m3d', '.csp', '.png'}
    return sorted(p.name for p in _lut_dir().iterdir()
                  if p.suffix.lower() in exts) if _lut_dir().exists() else []


class VideoLUTStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoLUTStage",
            display_name="Video LUT",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_str("lut_file", "", "file name inside input/comfytv-luts"),
                _hidden_combo("interp", ['tetrahedral', 'trilinear', 'nearest',
                                         'pyramid', 'prism'], 'tetrahedral'),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                lut_file="", interp='tetrahedral', video=""):
        _need_video(video, "Video LUT")
        name = os.path.basename((lut_file or '').strip())
        if not name:
            raise RuntimeError("Video LUT: pick or upload a LUT file first.")
        path = _lut_dir() / name
        if not path.exists():
            raise RuntimeError(f"Video LUT: {name!r} not found in input/comfytv-luts.")
        esc = str(path).replace('\\', '/').replace(':', r'\:')
        if path.suffix.lower() == '.png':
            raise RuntimeError("Video LUT: Hald .png LUTs need a second input — "
                               "convert to .cube, or use lut3d-compatible formats.")
        payload = filter_video(video, [('lut3d', f"file={esc}:interp={interp}")],
                               progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


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
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                mode='gaussian', amount=2.0, size=5, edge_preserve=0.1, video=""):
        _need_video(video, "Blur / Sharpen")
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
        payload = filter_video(video, [spec], progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


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
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                method='atadenoise', strength=0.3, video=""):
        _need_video(video, "Video Denoise")
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
        payload = filter_video(video, [spec], progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


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


class VideoTransitionStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoTransitionStage",
            display_name="Video Transition",
            category="ComfyTV/Compose",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("transition", XFADE_TRANSITIONS, 'fade'),
                _hidden_float("duration", 1.0, 0.1, 5.0, step=0.05),
                _hidden_float("offset", 0.0, 0.0, 3600.0,
                              tooltip="seconds into clip A where the transition starts; 0 = auto (end of A)"),
                COMFYTV_VIDEO.Input("video_a", optional=True),
                COMFYTV_VIDEO.Input("video_b", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                transition='fade', duration=1.0, offset=0.0,
                video_a="", video_b=""):
        if not (video_a or '').strip() or not (video_b or '').strip():
            raise RuntimeError(
                "Video Transition needs two upstream videos — wire video_a and video_b."
            )
        payload = xfade_videos(video_a, video_b, transition=transition,
                               duration=_f(duration, 0.1, 5.0, 1.0),
                               offset=(_f(offset, 0.0, 3600.0) or None),
                               progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


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


class SceneDetectStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.SceneDetectStage",
            display_name="Scene Detect",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_float("threshold", 0.4, 0.05, 1.0),
                _hidden_float("min_gap_s", 1.0, 0.0, 30.0, step=0.1),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_IMAGES.Output("images")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                threshold=0.4, min_gap_s=1.0, video=""):
        _need_video(video, "Scene Detect")
        cuts = scene_detect(video, threshold=_f(threshold, 0.05, 1.0, 0.4),
                            min_gap_s=_f(min_gap_s, 0.0, 30.0, 1.0),
                            progress=_progress_cb(cls))
        if not cuts:
            raise RuntimeError(
                "Scene Detect: no cuts found — lower the threshold and try again."
            )
        images = [{'index': 0, 'label': "0.00s", 'image_url': extract_frame(video, 0.0), 't': 0.0}]
        for i, t in enumerate(cuts):
            images.append({'index': i + 1, 'label': f"{t:.2f}s",
                           'image_url': extract_frame(video, t), 't': t})
        payload = json.dumps({'images': images, 'cuts': cuts})
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


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
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                method='bwdif', rate='frame', video=""):
        _need_video(video, "Deinterlace")
        info = get_video_info(video)
        if method in ('bwdif', 'yadif'):
            spec = (method, f"mode={'send_field' if rate == 'field' else 'send_frame'}")
        elif method == 'estdif':
            spec = ('estdif', f"mode={'field' if rate == 'field' else 'frame'}")
        elif method == 'w3fdif':
            spec = ('w3fdif', None)
        else:
            raise RuntimeError(f"Deinterlace: unknown method {method!r}")
        out_fps = info['fps'] * 2 if (rate == 'field' or method == 'w3fdif') else info['fps']
        payload = filter_video(video, [spec], out_fps=out_fps,
                               progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


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
        _need_video(video, "Video Stylize")
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
        payload = filter_video(video, specs, progress=_progress_cb(cls))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)


SCOPES = ['waveform', 'waveform_parade', 'vectorscope', 'histogram']


class VideoScopesStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoScopesStage",
            display_name="Video Scopes",
            category="ComfyTV/Video",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("scope", SCOPES, 'waveform'),
                _hidden_float("at_seconds", -1.0, -1.0, 3600.0,
                              tooltip="-1 = middle of the clip"),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                scope='waveform', at_seconds=-1.0, video=""):
        _need_video(video, "Video Scopes")
        specs = {
            'waveform': [('waveform', 'graticule=green:flags=numbers')],
            'waveform_parade': [('waveform', 'display=parade:graticule=green:flags=numbers')],
            'vectorscope': [('vectorscope', 'mode=color3:graticule=green:flags=name')],
            'histogram': [('histogram', None)],
        }.get(scope)
        if specs is None:
            raise RuntimeError(f"Video Scopes: unknown scope {scope!r}")
        pos = 'middle' if float(at_seconds or -1) < 0 else float(at_seconds)
        payload = filter_frame_image(video, pos, specs)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id)
