"""Reference-only images in the trusted fixed-instance global asset library.

No per-chat authorization is implied. No network or disposable disk writes.
"""
import hashlib
from functools import wraps
from threading import BoundedSemaphore
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
from urllib.parse import urlsplit, parse_qs

from PIL import Image
from .. import storage

MAX_SOURCE = 20 * 1024 * 1024
MAX_PIXELS = 40_000_000
MAX_MANIFEST = 8192
_SLOTS = BoundedSemaphore(2)


def _bounded(fn):
    @wraps(fn)
    def bounded(*args, **kwargs):
        if not _SLOTS.acquire(blocking=False):
            raise ValueError('image inspection busy; retry after active reads finish')
        try:
            return fn(*args, **kwargs)
        finally:
            _SLOTS.release()
    return bounded


def asset_id(value):
    if type(value) is not int or not 0 < value <= 9007199254740991:
        raise ValueError('asset_id must be a positive safe integer')
    return value


def parse_refs(raw, *, native=False):
    if raw is None:
        return []
    if not isinstance(raw, list) or len(raw) > 6:
        raise ValueError('at most 6 image asset references required')
    ids = []
    for item in raw:
        if native:
            if not isinstance(item, str) or not re.fullmatch(r'asset:[1-9][0-9]{0,15}', item):
                raise ValueError('image attachments require canonical asset references')
            value = int(item[6:])
        else:
            if not isinstance(item, dict) or set(item) != {'asset_id'}:
                raise ValueError('image attachments require asset_id only')
            value = item['asset_id']
        ids.append(asset_id(value))
    if len(ids) != len(set(ids)):
        raise ValueError('duplicate image asset reference')
    return ids


def _source(aid, media_types=('image',), max_source=MAX_SOURCE):
    import folder_paths
    row = storage.get_asset(asset_id(aid))
    if not row:
        raise ValueError('image asset missing or deleted')
    if row.get('media_type') not in media_types:
        raise ValueError('unsupported asset media type')
    try:
        url = urlsplit(row.get('payload_url') or '')
        q = parse_qs(url.query, keep_blank_values=True, strict_parsing=True)
        if (url.scheme or url.netloc or url.path != '/view' or url.fragment
                or set(q) - {'filename', 'subfolder', 'type'}
                or any(len(v) != 1 for v in q.values())):
            raise ValueError
        kind = q.get('type', ['input'])[0]
        if kind not in {'input', 'output'}:
            raise ValueError
        root = Path(folder_paths.get_input_directory() if kind == 'input'
                    else folder_paths.get_output_directory()).resolve(strict=True)
        parts = [q.get('subfolder', [''])[0], q['filename'][0]]
        if not parts[1] or any('\\' in p or ':' in p or '\x00' in p or p.startswith('/') for p in parts):
            raise ValueError
        relative = Path(*parts)
        if '..' in relative.parts:
            raise ValueError
        path = root / relative
        cursor = root
        for part in relative.parts:
            cursor = cursor / part
            if cursor.is_symlink() or getattr(cursor, 'is_junction', lambda: False)():
                raise ValueError
            # Windows junction/reparse points, including Python <3.12.
            if getattr(cursor.lstat(), 'st_file_attributes', 0) & 0x400:
                raise ValueError
        path.resolve(strict=True).relative_to(root)
        before = path.lstat()
        if not stat.S_ISREG(before.st_mode) or before.st_size > max_source:
            raise ValueError
        flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0) | getattr(os, 'O_BINARY', 0)
        if os.name == 'posix':
            # Resolve every component via directory descriptors: no parent-link race.
            directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                for part in relative.parts[:-1]:
                    child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
                    os.close(directory)
                    directory = child
                fd = os.open(relative.parts[-1], flags, dir_fd=directory)
            finally:
                os.close(directory)
        else:
            fd = os.open(path, flags)
        with os.fdopen(fd, 'rb') as f:
            if not os.path.samestat(before, os.fstat(f.fileno())):
                raise ValueError
            st = os.fstat(f.fileno())
            if not stat.S_ISREG(st.st_mode) or st.st_size > max_source:
                raise ValueError
            data = f.read(max_source + 1)
        if not data or len(data) > max_source:
            raise ValueError
    except Exception:
        raise ValueError('asset unavailable, unsafe, corrupt or exceeds media limits') from None
    return data, row


def _read(aid):
    data, _ = _source(aid)
    try:
        with Image.open(io.BytesIO(data)) as image:
            w, h = image.size
            if w * h > MAX_PIXELS or getattr(image, 'n_frames', 1) != 1:
                raise ValueError
            mime = Image.MIME.get(image.format)
            if mime not in {'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'}:
                raise ValueError
            image.verify()
        # Same bounded bytes, private Pillow globals. The producer slot remains
        # held until run() has waited/reaped the child, including on timeout.
        subprocess.run(
            [sys.executable, '-I', '-B', str(Path(__file__).with_name('_image_decode.py')),
             str(MAX_SOURCE), str(MAX_PIXELS)], input=data, check=True, timeout=20,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        raise ValueError('image asset unavailable, unsafe, corrupt or exceeds media limits') from None
    return data, {'asset_id': aid, 'media_type': 'image', 'mime_type': mime,
                  'width': w, 'height': h, 'size_bytes': len(data),
                  'revision': 'sha256:' + hashlib.sha256(data).hexdigest(),
                  'perception': 'not_inspected'}


@_bounded
def preview(args):
    import base64
    if not isinstance(args, dict) or set(args) - {'asset_id', 'revision'} or 'asset_id' not in args:
        raise ValueError('asset_id and optional revision only')
    data, meta = _read(args['asset_id'])
    if 'revision' in args and args['revision'] != meta['revision']:
        raise ValueError('image asset revision changed; reattach current asset')
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.thumbnail((1200, 1200))
            rgb = image.convert('RGB')
            for quality in (80, 65, 45, 25):
                out = io.BytesIO()
                rgb.save(out, format='JPEG', quality=quality)
                if out.tell() <= 1024 * 1024:
                    break
            else:
                raise ValueError
            return {**meta, 'preview_width': rgb.width, 'preview_height': rgb.height,
                    'perception': 'preview_only_not_analyzed',
                    '_images': [{'data': base64.b64encode(out.getvalue()).decode('ascii'),
                                 'mimeType': 'image/jpeg'}]}
    except Exception:
        raise ValueError('image preview unavailable or exceeds limits') from None


def task_input(text, manifest):
    try:
        if not isinstance(text, str) or not isinstance(manifest, dict) or set(manifest) != {'version', 'assets'}:
            raise ValueError
        if type(manifest['version']) is not int or manifest['version'] != 1:
            raise ValueError
        assets = manifest['assets']
        if not isinstance(assets, list) or not 1 <= len(assets) <= 6:
            raise ValueError
        from .media_refs import build_manifest as build_media_manifest
        current = build_media_manifest([a['asset_id'] for a in assets])
        if manifest != current:
            raise ValueError
        result = json.dumps({'schema': 'comfytv.task-input.v1', 'user_text': text,
                             'attachment_manifest': current}, ensure_ascii=False,
                            sort_keys=True, separators=(',', ':'))
        if len(result.encode('utf-8')) > 8192:
            raise ValueError
        return result
    except (ValueError, KeyError, TypeError):
        raise ValueError('image references invalid, changed, unavailable or task input exceeds 8 KiB') from None


@_bounded
def build_manifest(ids):
    ids = parse_refs([{'asset_id': i} for i in ids])
    manifest = {'version': 1, 'assets': [_read(i)[1] for i in ids]}
    if len(json.dumps(manifest, ensure_ascii=False).encode()) > MAX_MANIFEST:
        raise ValueError('image reference manifest exceeds 8 KiB')
    return manifest
