import asyncio

from aiohttp import web

from ._common import _log, routes


@routes.get('/comfytv/media/info')
async def media_info(request: web.Request) -> web.Response:
    url = str(request.query.get('url') or '').strip()
    if not url:
        return web.json_response({'error': 'url is required'}, status=400)
    if url.startswith(('http://', 'https://')):
        return web.json_response({'error': 'remote urls are not probed'}, status=404)
    from ..runners.media_info import probe_media
    try:
        info = await asyncio.to_thread(probe_media, url)
    except ValueError:
        return web.json_response({'error': 'forbidden path'}, status=403)
    except (FileNotFoundError, RuntimeError) as e:
        return web.json_response({'error': str(e)}, status=404)
    except Exception as e:
        _log.exception('[ComfyTV/media_info] probe failed for %s', url)
        return web.json_response({'error': str(e)}, status=500)
    return web.json_response(info)
