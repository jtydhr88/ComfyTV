import asyncio

from aiohttp import web

from ._common import _log, routes

THUMB_CACHE_HEADERS = {'Cache-Control': 'public, max-age=3600'}

CONTENT_TYPES = {
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.bmp': 'image/bmp',
}


@routes.get('/comfytv/thumb')
async def thumb(request: web.Request) -> web.StreamResponse:
    url = str(request.query.get('url') or '').strip()
    if not url:
        return web.json_response({'error': 'url is required'}, status=400)
    try:
        max_edge = int(request.query.get('max', '512'))
    except ValueError:
        return web.json_response({'error': 'max must be an integer'},
                                 status=400)

    from ..runners.thumbs import resolve_thumb
    try:
        path = await asyncio.get_running_loop().run_in_executor(
            None, resolve_thumb, url, max_edge)
    except FileNotFoundError:
        return web.Response(status=404)
    except ValueError:
        return web.Response(status=403)
    except Exception as e:
        _log.exception('[ComfyTV/thumb] failed for %s', url)
        return web.json_response({'error': str(e)}, status=500)
    headers = dict(THUMB_CACHE_HEADERS)
    ctype = CONTENT_TYPES.get(path.suffix.lower())
    if ctype:
        headers['Content-Type'] = ctype
    return web.FileResponse(path, headers=headers)
