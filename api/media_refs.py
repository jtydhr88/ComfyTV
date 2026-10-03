"""Validated reference-only image/video/audio attachments; no remote URLs."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

from .. import storage
from . import image_refs

MAX_SOURCE = 64 * 1024 * 1024
MAX_DURATION = 300
LIMITATIONS = ('Sampled frames/timeline are not continuous video understanding or soundtrack listening. '
               'Audio metadata/waveform cannot establish speech, transcription, lyrics, language, emotion or music meaning. '
               'Call inspect_media_asset on demand; call vision_analyze on returned MEDIA previews before describing visual contents.')


def _decode(data, kind, **options):
    try:
        result = subprocess.run([sys.executable, '-I', '-B', str(Path(__file__).with_name('_media_decode.py')),
                                 json.dumps({'kind': kind, **options})], input=data, capture_output=True,
                                check=True, timeout=20,
                                env={**os.environ, 'OPENBLAS_NUM_THREADS': '1', 'OMP_NUM_THREADS': '1'})
        if len(result.stdout) > 2 * 1024 * 1024:
            raise ValueError
        return json.loads(result.stdout)
    except Exception:
        raise ValueError('media unavailable, corrupt or exceeds inspection limits') from None


def _read(aid):
    row = storage.get_asset(image_refs.asset_id(aid))
    if not row:
        raise ValueError('media asset missing or deleted')
    kind = row.get('media_type')
    if kind == 'image':
        return image_refs._read(aid)
    if kind not in {'video', 'audio'}:
        raise ValueError('unsupported asset media type; only image/video/audio')
    data, current = image_refs._source(aid, ('video', 'audio'), MAX_SOURCE)
    if current.get('media_type') != kind:
        raise ValueError('asset changed during inspection')
    facts = _decode(data, kind)
    return data, {'asset_id': aid, 'media_type': kind, **facts, 'size_bytes': len(data),
                  'revision': 'sha256:' + hashlib.sha256(data).hexdigest(),
                  'perception': 'not_inspected', 'inspect_tool': 'inspect_media_asset',
                  'limitations': LIMITATIONS}


@image_refs._bounded
def preview(args):
    import math
    if not isinstance(args, dict) or set(args) - {'asset_id', 'revision', 'mode', 'time_seconds', 'frames'} or 'asset_id' not in args:
        raise ValueError('asset_id, optional revision and bounded inspection options only')
    mode = args.get('mode', 'metadata')
    if not isinstance(mode, str) or mode not in {'metadata', 'frame', 'timeline', 'waveform'}:
        raise ValueError('invalid inspection mode')
    if 'time_seconds' in args and (mode != 'frame' or type(args['time_seconds']) not in {int, float}
                                    or not math.isfinite(args['time_seconds']) or not 0 <= args['time_seconds'] <= MAX_DURATION):
        raise ValueError('invalid time_seconds')
    if 'frames' in args and (mode != 'timeline' or type(args['frames']) is not int or not 2 <= args['frames'] <= 4):
        raise ValueError('timeline frames must be 2..4')
    data, meta = _read(args['asset_id'])
    if 'revision' in args and args['revision'] != meta['revision']:
        raise ValueError('media asset revision changed; reattach current asset')
    if mode == 'metadata':
        return meta
    if not ((meta['media_type'] == 'video' and mode in {'frame', 'timeline'})
            or (meta['media_type'] == 'audio' and mode == 'waveform')):
        raise ValueError('inspection mode does not match media type')
    return {**meta, **_decode(data, meta['media_type'], **{k: v for k, v in args.items() if k in {'mode', 'time_seconds', 'frames'}})}


def build_manifest(ids):
    ids = image_refs.parse_refs([{'asset_id': aid} for aid in ids])
    # Retain the existing image-only entry point (and its concurrency budget).
    if all((storage.get_asset(aid) or {}).get('media_type') == 'image' for aid in ids):
        return image_refs.build_manifest(ids)
    return _build_manifest(ids)


@image_refs._bounded
def _build_manifest(ids):
    manifest = {'version': 1, 'assets': [_read(aid)[1] for aid in ids]}
    if len(json.dumps(manifest, ensure_ascii=False).encode()) > image_refs.MAX_MANIFEST:
        raise ValueError('media reference manifest exceeds 8 KiB')
    return manifest
