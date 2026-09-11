import mimetypes

from aiohttp import web
from server import PromptServer

from ..runners._media_paths import view_url_to_path

_MEDIA_PREFIXES = ('video/', 'audio/', 'image/')


def _wants_rescue(filename: str) -> bool:
    return '..' in filename and '/' not in filename and '\\' not in filename


def _resolve_media(request) -> tuple:
    try:
        p = view_url_to_path('/view?' + request.rel_url.query_string)
    except ValueError:
        return None, ''
    if p is None or not p.is_file():
        return None, ''
    ctype = mimetypes.guess_type(p.name)[0] or ''
    if not ctype.startswith(_MEDIA_PREFIXES) or ctype == 'image/svg+xml':
        return None, ''
    return p, ctype


def _wrap(orig):
    async def view(request):
        filename = request.rel_url.query.get('filename', '')
        if _wants_rescue(filename):
            p, ctype = _resolve_media(request)
            if p is not None:
                return web.FileResponse(
                    p, headers={'Content-Type': ctype, 'X-Content-Type-Options': 'nosniff'})
        return await orig(request)

    view._comfytv_view_patch = True
    return view


def install(routes=None) -> bool:
    routes = routes if routes is not None else PromptServer.instance.routes
    items = getattr(routes, '_items', None)
    if items is None:
        return False
    for i, r in enumerate(items):
        if not isinstance(r, web.RouteDef) or r.method != 'GET' or r.path != '/view':
            continue
        if getattr(r.handler, '_comfytv_view_patch', False):
            return True
        items[i] = web.RouteDef(r.method, r.path, _wrap(r.handler), r.kwargs)
        return True
    return False


install()
