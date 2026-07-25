import asyncio

from aiohttp import web

from ._common import _log, routes


@routes.post('/comfytv/midi/ensure')
async def midi_ensure(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({'error': f'invalid json: {e}'}, status=400)
    url = str(body.get('url') or '').strip()
    if not url:
        return web.json_response({'error': 'url is required'}, status=400)

    from ..runners.midi_import import ensure_midi_wav
    try:
        result = await asyncio.get_running_loop().run_in_executor(
            None, ensure_midi_wav, url)
    except Exception as e:
        _log.exception('[ComfyTV/midi] ensure failed for %s', url)
        return web.json_response({'error': str(e)}, status=500)
    return web.json_response(result)
