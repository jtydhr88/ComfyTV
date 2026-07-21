import logging

from aiohttp import web

from .. import storage
from . import resources as res
from ._common import routes

_log = logging.getLogger(__name__)


@routes.get('/comfytv/luts')
async def list_luts(request: web.Request) -> web.Response:
    res.adopt_kind('lut')
    rows = [res.decorate(r) for r in storage.list_resources('lut')]
    names = sorted(r['filename'] for r in rows if not r['missing'])
    return web.json_response({'luts': names})


@routes.get('/comfytv/luts/{name}')
async def get_lut(request: web.Request) -> web.Response:
    res.adopt_kind('lut')
    name = request.match_info['name']
    path = res.resource_file('lut', name)
    if path is None:
        return web.json_response({'error': f'lut {name!r} not found'},
                                 status=404)
    return web.FileResponse(path)


@routes.post('/comfytv/luts')
async def upload_lut(request: web.Request) -> web.Response:
    row, err = await res.save_upload(request, forced_kind='lut', overwrite=True)
    if err is not None:
        return err
    _log.info('[ComfyTV/fx] LUT uploaded: %s (%d bytes)', row['filename'], row['size'])
    return web.json_response({'ok': True, 'name': row['filename']})
