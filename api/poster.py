import logging

from aiohttp import web

from ._common import routes
from ..nodes import poster as poster_lib

_log = logging.getLogger(__name__)


@routes.get("/comfytv/poster/templates")
async def poster_templates(request: web.Request) -> web.Response:
    return web.json_response(poster_lib.discover_templates_meta())


@routes.post("/comfytv/poster/elements")
async def poster_elements(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        data = {}
    try:
        els = poster_lib.elements_for_request(data)
    except Exception:
        _log.exception("[ComfyTV/poster] elements build failed")
        els = []
    return web.json_response(els)


@routes.post("/comfytv/poster/html")
async def poster_html(request: web.Request) -> web.Response:
    try:
        data = await request.json()
    except Exception:
        data = {}
    try:
        html = poster_lib.build_html_from_request(data)
    except Exception as exc:
        _log.exception("[ComfyTV/poster] preview build failed")
        html = (
            "<html><body style='font-family:sans-serif;color:#b00;"
            f"padding:24px'>Preview error: {exc}</body></html>"
        )
    return web.Response(text=html, content_type="text/html")
