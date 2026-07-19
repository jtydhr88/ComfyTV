import hashlib
import re
import urllib.parse
from pathlib import Path

from aiohttp import web

from .. import storage
from ._common import routes

RESOURCE_KIND_DIRS = {'lut': 'comfytv-luts', 'font': 'comfytv-fonts'}
RESOURCE_KIND_EXTS = {
    'lut': {'.cube', '.3dl', '.dat', '.m3d', '.csp'},
    'font': {'.ttf', '.otf', '.woff', '.woff2'},
}
MAX_RESOURCE_SIZE = 64 * 1024 * 1024
_SAFE_NAME = re.compile(r'^[\w][\w .()\-一-鿿]*$')


def _input_dir() -> Path:
    import folder_paths
    return Path(folder_paths.get_input_directory())


def resource_dir(kind: str) -> Path:
    d = _input_dir() / RESOURCE_KIND_DIRS[kind]
    d.mkdir(parents=True, exist_ok=True)
    return d


def _view_url(filename: str, subfolder: str) -> str:
    qs = urllib.parse.urlencode({
        'filename': filename, 'subfolder': subfolder, 'type': 'input',
    })
    return f'/view?{qs}'


def _sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def adopt_kind(kind: str) -> None:
    d = resource_dir(kind)
    known = {r['filename'] for r in storage.list_resources(kind)}
    exts = RESOURCE_KIND_EXTS[kind]
    for p in sorted(d.iterdir()):
        if not p.is_file() or p.suffix.lower() not in exts or p.name in known:
            continue
        storage.register_resource(
            kind, p.name, RESOURCE_KIND_DIRS[kind],
            size=p.stat().st_size, sha256=_sha256_of(p),
        )


def decorate(row: dict) -> dict:
    path = _input_dir() / row['subfolder'] / row['filename']
    return {
        **row,
        'url': _view_url(row['filename'], row['subfolder']),
        'missing': not path.is_file(),
    }


async def save_upload(
    request: web.Request,
    forced_kind: str | None = None,
    *,
    overwrite: bool = False,
) -> tuple[dict | None, web.Response | None]:
    try:
        reader = await request.multipart()
    except (AssertionError, ValueError) as e:
        return None, web.json_response(
            {'error': f'expected multipart body: {e}'}, status=400)
    kind = forced_kind or (request.query.get('kind') or '').strip() or None
    field = None
    while True:
        part = await reader.next()
        if part is None:
            break
        if part.name == 'kind' and forced_kind is None:
            kind = (await part.text()).strip() or None
        elif part.name == 'file':
            field = part
            break
    if field is None:
        return None, web.json_response(
            {'error': "expected multipart field 'file'"}, status=400)
    if kind not in RESOURCE_KIND_DIRS:
        return None, web.json_response(
            {'error': f"kind must be one of {sorted(RESOURCE_KIND_DIRS)}"}, status=400)
    name = (field.filename or '').strip()
    suffix = Path(name).suffix.lower()
    exts = RESOURCE_KIND_EXTS[kind]
    if suffix not in exts:
        allowed = '/'.join(sorted(exts))
        return None, web.json_response(
            {'error': f'unsupported {kind} type {suffix!r} (use {allowed})'},
            status=400)
    base = Path(name).name
    if not _SAFE_NAME.match(base):
        return None, web.json_response({'error': 'bad file name'}, status=400)
    d = resource_dir(kind)
    dest = d / base
    if not overwrite:
        stem, ext = Path(base).stem, Path(base).suffix
        n = 1
        while dest.exists():
            dest = d / f'{stem}-{n}{ext}'
            n += 1
    size = 0
    h = hashlib.sha256()
    with open(dest, 'wb') as f:
        while True:
            chunk = await field.read_chunk()
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_RESOURCE_SIZE:
                f.close()
                dest.unlink(missing_ok=True)
                return None, web.json_response(
                    {'error': 'file too large (>64MB)'}, status=400)
            h.update(chunk)
            f.write(chunk)
    row = storage.register_resource(
        kind, dest.name, RESOURCE_KIND_DIRS[kind],
        size=size, sha256=h.hexdigest(),
    )
    if row is None:
        return None, web.json_response({'error': 'failed to register resource'}, status=500)
    return decorate(row), None


@routes.get('/comfytv/resources')
async def list_resources(request: web.Request) -> web.Response:
    kind = (request.query.get('kind') or '').strip()
    if kind and kind not in RESOURCE_KIND_DIRS:
        return web.json_response({'error': f'unknown kind {kind!r}'}, status=400)
    for k in ([kind] if kind else list(RESOURCE_KIND_DIRS)):
        adopt_kind(k)
    rows = [decorate(r) for r in storage.list_resources(kind or None)]
    return web.json_response({'resources': rows})


@routes.post('/comfytv/resources')
async def upload_resource(request: web.Request) -> web.Response:
    row, err = await save_upload(request)
    if err is not None:
        return err
    return web.json_response({'ok': True, 'resource': row})


def _resource_id(raw: str) -> int | None:
    try:
        return int(raw)
    except ValueError:
        return None


@routes.patch('/comfytv/resources/{rid}')
async def rename_resource(request: web.Request) -> web.Response:
    rid = _resource_id(request.match_info['rid'])
    if rid is None:
        return web.json_response({'error': 'resource not found'}, status=404)
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({'error': f'invalid json: {e}'}, status=400)
    name = body.get('name')
    if not isinstance(name, str) or not name.strip():
        return web.json_response({'error': 'name is required'}, status=400)
    row = storage.rename_resource(rid, name)
    if row is None:
        return web.json_response({'error': 'resource not found'}, status=404)
    return web.json_response({'ok': True, 'resource': decorate(row)})


@routes.delete('/comfytv/resources/{rid}')
async def delete_resource(request: web.Request) -> web.Response:
    rid = _resource_id(request.match_info['rid'])
    if rid is None:
        return web.json_response({'error': 'resource not found'}, status=404)
    if not storage.unregister_resource(rid):
        return web.json_response({'error': 'resource not found'}, status=404)
    return web.json_response({'ok': True})
