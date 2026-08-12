from aiohttp import web

from ..runners.exec_errors import list_exec_errors
from ._common import routes


@routes.get("/comfytv/exec_errors")
async def get_exec_errors(request: web.Request) -> web.Response:
    try:
        limit = int(request.query.get("limit", "10"))
    except ValueError:
        limit = 10
    return web.json_response({"errors": list_exec_errors(limit)})
