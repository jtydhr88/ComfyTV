from ._common import *  # noqa: F401, F403
from ...runners.media import (
    extract_frame, get_video_info, trim_video, trim_video_precise,
    view_url_to_path,
)
from ...runners.media_filter import scene_detect, filter_frame_image

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_combo,
)


_SCENE_CACHE: dict = {}
_SCENE_CACHE_CAP = 8


def _scene_cache_src(view_url):
    p = view_url_to_path(view_url)
    return str(p) if p is not None else str(view_url)


def _scene_cache_get(key):
    entry = _SCENE_CACHE.pop(key, None)
    if entry is None:
        return None
    cuts, images, clip_items = entry
    urls = [it['image_url'] for it in clip_items] + [im['image_url'] for im in images]
    if any(view_url_to_path(u) is None for u in urls):
        return None
    _SCENE_CACHE[key] = entry
    return entry


def _scene_cache_put(key, entry):
    _SCENE_CACHE.pop(key, None)
    _SCENE_CACHE[key] = entry
    while len(_SCENE_CACHE) > _SCENE_CACHE_CAP:
        _SCENE_CACHE.pop(next(iter(_SCENE_CACHE)))


def _scene_segments(cuts, duration, cap=48):
    bounds = [0.0, *(float(t) for t in cuts)]
    end = max(float(duration or 0.0), bounds[-1] + 0.05)
    segments = []
    for i, a in enumerate(bounds):
        b = bounds[i + 1] if i + 1 < len(bounds) else end
        if b - a > 1e-3:
            segments.append((a, b))
    return segments[:cap]


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
                _hidden_combo("output", ['frames', 'clips'], 'frames'),
                _hidden_combo("cut_mode", ['fast', 'precise'], 'fast'),
                _selected_index_input(),
                COMFYTV_VIDEO.Input("video", optional=True),
            ],
            outputs=[COMFYTV_IMAGES.Output("images"), COMFYTV_VIDEO.Output("clips")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                threshold=0.4, min_gap_s=1.0, output='frames', cut_mode='fast',
                selected_index=1, video=""):
        _need_video(video, "Scene Detect")
        thr = _f(threshold, 0.05, 1.0, 0.4)
        gap = _f(min_gap_s, 0.0, 30.0, 1.0)
        mode = cut_mode if cut_mode in ('fast', 'precise') else 'fast'
        key = (_scene_cache_src(video), thr, gap, mode)
        cached = _scene_cache_get(key) if output == 'clips' else None
        if cached is not None:
            cuts, images, clip_items = cached
        else:
            cuts = scene_detect(video, threshold=thr, min_gap_s=gap,
                                progress=_progress_cb(cls))
            if not cuts:
                raise RuntimeError(
                    "Scene Detect: no cuts found — lower the threshold and try again."
                )
            images = [{'index': 0, 'label': "0.00s", 'image_url': extract_frame(video, 0.0), 't': 0.0}]
            for i, t in enumerate(cuts):
                images.append({'index': i + 1, 'label': f"{t:.2f}s",
                               'image_url': extract_frame(video, t), 't': t})
            clip_items = None
        if output == 'clips':
            if clip_items is None:
                info = get_video_info(video)
                segments = _scene_segments(cuts, info.get('duration') or 0.0)
                cb = _progress_cb(cls)
                cut = trim_video_precise if mode == 'precise' else trim_video
                clip_items = []
                for i, (a, b) in enumerate(segments):
                    cb(i, len(segments), f"clip {i + 1}/{len(segments)}")
                    clip_items.append({
                        'index': i + 1,
                        'label': f"{i + 1} · {a:.2f}–{b:.2f}s",
                        'image_url': cut(video, a, b),
                        'start': a,
                        'end': b,
                    })
                _scene_cache_put(key, (cuts, images, clip_items))
            sel = min(max(int(selected_index or 1), 1), len(clip_items))
            payload = json.dumps({'images': images, 'cuts': cuts,
                                  'clips': clip_items})
            return _stage_emit_auto(
                cls, project_id=project_id, payload_str=payload,
                parent_output_id=parent_output_id,
                picked_payload=clip_items[sel - 1]['image_url'],
                picked_index=sel)
        payload = json.dumps({'images': images, 'cuts': cuts})
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
