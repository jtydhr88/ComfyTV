import logging
import re

from aiohttp import web

from ._common import routes

_log = logging.getLogger(__name__)

_LUT_EXTS = {'.cube', '.3dl', '.dat', '.m3d', '.csp'}
_SAFE_NAME = re.compile(r'^[\w][\w .()\-一-鿿]*$')


def _lut_dir():
    import folder_paths
    from pathlib import Path
    d = Path(folder_paths.get_input_directory()) / 'comfytv-luts'
    d.mkdir(parents=True, exist_ok=True)
    return d


@routes.get('/comfytv/luts')
async def list_luts(request: web.Request) -> web.Response:
    from pathlib import Path
    names = sorted(p.name for p in _lut_dir().iterdir()
                   if p.suffix.lower() in _LUT_EXTS)
    return web.json_response({'luts': names})


@routes.post('/comfytv/luts')
async def upload_lut(request: web.Request) -> web.Response:
    reader = await request.multipart()
    field = await reader.next()
    if field is None or field.name != 'file':
        return web.json_response({'error': "expected multipart field 'file'"}, status=400)
    name = (field.filename or '').strip()
    from pathlib import Path
    suffix = Path(name).suffix.lower()
    if suffix not in _LUT_EXTS:
        return web.json_response(
            {'error': f'unsupported LUT type {suffix!r} (use .cube/.3dl/.dat/.m3d/.csp)'},
            status=400)
    base = Path(name).name
    if not _SAFE_NAME.match(base):
        return web.json_response({'error': 'bad file name'}, status=400)
    dest = _lut_dir() / base
    size = 0
    with open(dest, 'wb') as f:
        while True:
            chunk = await field.read_chunk()
            if not chunk:
                break
            size += len(chunk)
            if size > 64 * 1024 * 1024:
                f.close()
                dest.unlink(missing_ok=True)
                return web.json_response({'error': 'LUT too large (>64MB)'}, status=400)
            f.write(chunk)
    _log.info('[ComfyTV/fx] LUT uploaded: %s (%d bytes)', base, size)
    return web.json_response({'ok': True, 'name': base})
