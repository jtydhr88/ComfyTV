import logging
import threading
from collections import OrderedDict
from pathlib import Path

from ._media_paths import localize

_log = logging.getLogger(__name__)

IMAGE_EXT = {
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff',
    '.psd', '.psb', '.avif', '.heic', '.heif', '.exr', '.hdr', '.jxl',
}
AUDIO_EXT = {
    '.wav', '.mp3', '.flac', '.ogg', '.oga', '.m4a', '.aac', '.opus',
    '.aiff', '.aif', '.wma',
}
MODEL_EXT = {
    '.glb', '.gltf', '.obj', '.fbx', '.stl', '.ply', '.usdz', '.usd',
    '.usda', '.usdc', '.3mf', '.dae', '.abc', '.vrm',
}

_CACHE_MAX = 512
_cache: 'OrderedDict[tuple, dict]' = OrderedDict()
_lock = threading.Lock()


def probe_media(view_url: str) -> dict:
    src = localize(view_url)
    st = src.stat()
    key = (str(src), st.st_mtime_ns, st.st_size)
    with _lock:
        hit = _cache.get(key)
        if hit is not None:
            _cache.move_to_end(key)
            return dict(hit)
    info = _probe_path(src, st.st_size)
    with _lock:
        _cache[key] = info
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)
    return dict(info)


def _probe_path(src: Path, size: int) -> dict:
    ext = src.suffix.lower()
    base = {'kind': 'other', 'format': ext.lstrip('.').upper(), 'size_bytes': size}
    if ext in MODEL_EXT:
        return {**base, 'kind': 'model'}
    if ext in IMAGE_EXT:
        info = _probe_image(src)
        if info:
            return {**base, **info}
    info = _probe_av(src, prefer_audio=ext in AUDIO_EXT)
    if info:
        return {**base, **info}
    if ext in IMAGE_EXT:
        return {**base, 'kind': 'image'}
    if ext in AUDIO_EXT:
        return {**base, 'kind': 'audio'}
    return base


def _probe_image(src: Path) -> dict | None:
    try:
        from PIL import Image
        with Image.open(str(src)) as im:
            w, h = im.size
            out = {'kind': 'image', 'width': int(w), 'height': int(h)}
            if not src.suffix and im.format:
                out['format'] = str(im.format).upper()
            frames = int(getattr(im, 'n_frames', 1) or 1)
            if frames > 1:
                out['frames'] = frames
            return out
    except Exception as e:
        _log.debug('[ComfyTV/media_info] PIL failed for %s: %s', src, e)
        return None


def _stream_duration(container, stream) -> float | None:
    try:
        if stream is not None and stream.duration and stream.time_base:
            return float(stream.duration * stream.time_base)
        if container.duration:
            return container.duration / 1_000_000
    except Exception:
        pass
    return None


def _probe_av(src: Path, prefer_audio: bool) -> dict | None:
    try:
        import av
        with av.open(str(src)) as c:
            v = c.streams.video[0] if c.streams.video else None
            a = c.streams.audio[0] if c.streams.audio else None
            if v is not None and not prefer_audio:
                fps = None
                try:
                    fps = float(v.average_rate) if v.average_rate else None
                except (TypeError, ZeroDivisionError):
                    fps = None
                out = {
                    'kind': 'video',
                    'width': int(v.width or 0) or None,
                    'height': int(v.height or 0) or None,
                    'duration_s': _stream_duration(c, v),
                    'fps': round(fps, 3) if fps else None,
                    'has_audio': a is not None,
                    'codec': getattr(v.codec_context, 'name', None),
                }
                if v.frames:
                    out['frames'] = int(v.frames)
                return out
            if a is not None:
                return {
                    'kind': 'audio',
                    'duration_s': _stream_duration(c, a),
                    'sample_rate': int(a.sample_rate or 0) or None,
                    'channels': int(getattr(a, 'channels', 0) or 0) or None,
                    'codec': getattr(a.codec_context, 'name', None),
                }
            return None
    except Exception as e:
        _log.debug('[ComfyTV/media_info] av failed for %s: %s', src, e)
        return None
