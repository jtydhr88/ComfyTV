import logging
import os
import threading
import uuid
from pathlib import Path

import folder_paths

from .. import storage
from .media import get_video_info, localize, path_to_view_url, view_url_to_path

_log = logging.getLogger(__name__)

PROXY_PROFILE = '1280-crf23'
PROXY_MAX_EDGE = 1280
PROXY_TRIGGER_BYTES = 150 * 1024 * 1024
PROXY_TRIGGER_EDGE = 1920
PROXY_SUBFOLDER = 'comfytv-proxies'

_progress: dict = {}
_original: set = set()
_lock = threading.Lock()


def proxy_dir() -> Path:
    d = Path(folder_paths.get_output_directory()) / PROXY_SUBFOLDER
    d.mkdir(parents=True, exist_ok=True)
    return d


def needs_proxy(src: Path, info: dict) -> bool:
    if src.stat().st_size >= PROXY_TRIGGER_BYTES:
        return True
    edge = max(int(info.get('width') or 0), int(info.get('height') or 0))
    return edge > PROXY_TRIGGER_EDGE


def proxy_dims(width: int, height: int) -> tuple:
    edge = max(width, height)
    scale = min(1.0, PROXY_MAX_EDGE / edge) if edge > 0 else 1.0
    tw = max(2, int(width * scale / 2) * 2)
    th = max(2, int(height * scale / 2) * 2)
    return tw, th


def ensure_proxy(view_url: str, retry: bool = False,
                 create: bool = False) -> dict:
    try:
        src = view_url_to_path(view_url)
    except ValueError:
        return {'status': 'original'}
    if src is None or not src.is_file():
        return {'status': 'original'}

    st = src.stat()
    identity = (str(src), st.st_size, st.st_mtime_ns)
    with _lock:
        if identity in _original:
            return {'status': 'original'}

    row = storage.get_proxy(str(src), PROXY_PROFILE)
    fresh = (row is not None
             and row['src_size'] == st.st_size
             and row['src_mtime_ns'] == st.st_mtime_ns)
    if fresh:
        if row['status'] == 'ready':
            pp = Path(row['proxy_path'] or '')
            if pp.is_file():
                return {
                    'status': 'ready',
                    'proxy_url': path_to_view_url(pp),
                    'width': row['width'],
                    'height': row['height'],
                }
        elif row['status'] in ('pending', 'running'):
            return {'status': row['status'],
                    'pct': _progress.get(row['id'], 0)}
        elif row['status'] == 'failed' and not (retry and create):
            return {'status': 'failed', 'error': row['error'] or ''}

    try:
        info = get_video_info(view_url)
    except Exception:
        return {'status': 'original'}
    if not needs_proxy(src, info):
        with _lock:
            _original.add(identity)
        return {'status': 'original'}

    if not create:
        return {'status': 'candidate'}

    storage.create_or_reset_proxy(
        str(src), PROXY_PROFILE, src_url=view_url,
        src_size=st.st_size, src_mtime_ns=st.st_mtime_ns)
    return {'status': 'pending', 'pct': 0}


def build_proxy(view_url: str, progress=None) -> str:
    try:
        src = view_url_to_path(view_url)
    except ValueError as e:
        raise RuntimeError(f"proxy: bad source url: {e}") from e
    if src is None or not src.is_file():
        raise RuntimeError("proxy: source file not found")

    st = src.stat()
    row = storage.get_proxy(str(src), PROXY_PROFILE)
    fresh = (row is not None
             and row['src_size'] == st.st_size
             and row['src_mtime_ns'] == st.st_mtime_ns)
    if fresh and row['status'] == 'ready':
        pp = Path(row['proxy_path'] or '')
        if pp.is_file():
            return path_to_view_url(pp)
        fresh = False
    if not fresh or row['status'] not in ('pending', 'running'):
        row = storage.create_or_reset_proxy(
            str(src), PROXY_PROFILE, src_url=view_url,
            src_size=st.st_size, src_mtime_ns=st.st_mtime_ns)

    proxy_id = row['id']
    try:
        return _transcode(proxy_id, view_url, progress)
    except Exception as e:
        storage.set_proxy_status(proxy_id, 'failed', error=str(e))
        raise
    finally:
        _progress.pop(proxy_id, None)


def _transcode(proxy_id: int, src_url: str, progress=None) -> str:
    from .media_filter import filter_video

    storage.set_proxy_status(proxy_id, 'running')
    info = get_video_info(src_url)
    tw, th = proxy_dims(int(info['width']), int(info['height']))

    def cb(value, total, text=''):
        _progress[proxy_id] = int(value * 100 / total) if total else 0
        if progress is not None:
            progress(value, total, text)

    out_url = filter_video(
        src_url, [('scale', f'w={tw}:h={th}')],
        vcodec_options={'crf': '23', 'preset': 'veryfast'},
        progress=cb)
    tmp = localize(out_url)
    dest = proxy_dir() / f'px{proxy_id}_{uuid.uuid4().hex[:8]}.mp4'
    os.replace(tmp, dest)
    storage.set_proxy_status(proxy_id, 'ready', proxy_path=str(dest),
                             width=tw, height=th)
    return path_to_view_url(dest)


__all__ = ['ensure_proxy', 'build_proxy', 'needs_proxy', 'proxy_dims',
           'proxy_dir', 'PROXY_PROFILE', 'PROXY_MAX_EDGE',
           'PROXY_TRIGGER_BYTES', 'PROXY_TRIGGER_EDGE']
