import asyncio

from aiohttp import web

from ._common import _log, routes


@routes.post('/comfytv/proxy/ensure')
async def proxy_ensure(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({'error': f'invalid json: {e}'}, status=400)
    url = str(body.get('url') or '').strip()
    if not url:
        return web.json_response({'error': 'url is required'}, status=400)
    retry = bool(body.get('retry'))
    create = bool(body.get('create'))

    from ..runners.proxy import ensure_proxy
    try:
        result = await asyncio.get_running_loop().run_in_executor(
            None, ensure_proxy, url, retry, create)
    except Exception as e:
        _log.exception('[ComfyTV/proxy] ensure failed for %s', url)
        return web.json_response({'error': str(e)}, status=500)
    return web.json_response(result)
