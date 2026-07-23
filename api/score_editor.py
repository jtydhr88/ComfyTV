from aiohttp import web

from ._common import routes


@routes.post('/comfytv/score_editor/import')
async def score_editor_import(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({'error': f'invalid json: {e}'},
                                 status=400)
    xml = str(body.get('musicxml') or '').strip()
    if not xml:
        return web.json_response({'error': 'musicxml is required'},
                                 status=400)
    from ..runners.score_edit import musicxml_to_editor
    try:
        state = musicxml_to_editor(xml)
    except RuntimeError as e:
        return web.json_response({'error': str(e)}, status=400)
    return web.json_response(state)
