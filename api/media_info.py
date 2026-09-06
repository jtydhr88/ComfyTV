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


@routes.post('/comfytv/media/info_batch')
async def media_info_batch(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({'error': 'invalid JSON body'}, status=400)
    urls = body.get('urls')
    if not isinstance(urls, list) or len(urls) > 200:
        return web.json_response({'error': 'urls must be a list of <=200'}, status=400)
    from ..runners.media_info import probe_media

    def probe_one(url: str):
        if not url or url.startswith(('http://', 'https://')):
            return None
        try:
            return probe_media(url)
        except Exception:
            return None

    clean = [str(u or '').strip() for u in urls]
    infos = await asyncio.gather(*(asyncio.to_thread(probe_one, u) for u in clean))
    return web.json_response({'infos': dict(zip(clean, infos))})
