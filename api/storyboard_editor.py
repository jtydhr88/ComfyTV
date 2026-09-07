import asyncio
import logging

from aiohttp import web

from ._common import routes


_log = logging.getLogger(__name__)


@routes.post("/comfytv/storyboard_editor/animatic")
async def storyboard_animatic(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid json"}, status=400)

    boards = body.get("boards")
    if boards is None:
        return web.json_response({"error": "boards required"}, status=400)
    if not isinstance(boards, list):
        return web.json_response({"error": "boards must be an array"}, status=400)
    if not boards:
        return web.json_response({"error": "boards required"}, status=400)
    if not all(isinstance(b, dict) for b in boards):
        return web.json_response({"error": "boards must be objects"}, status=400)
    from ..runners.animatic import MAX_BOARDS
    if len(boards) > MAX_BOARDS:
        return web.json_response(
            {"error": f"too many boards ({len(boards)} > {MAX_BOARDS})"}, status=400)

    width = int(body.get("width") or 1280)
    height = int(body.get("height") or 720)
    fps = int(body.get("fps") or 24)
    fmt = str(body.get("format") or "mp4").lower()
    burn_captions = bool(body.get("burn_captions"))
    if fmt not in ("mp4", "gif"):
        return web.json_response({"error": f"unknown format {fmt!r}"}, status=400)

    from ..runners.animatic import boards_to_animatic, boards_to_gif
    try:
        if fmt == "gif":
            url = await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: boards_to_gif(boards, width=width, height=height,
                                      burn_captions=burn_captions),
            )
            return web.json_response({"gif_url": url})
        url = await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: boards_to_animatic(boards, width=width, height=height,
                                       fps=fps, burn_captions=burn_captions),
        )
    except ValueError as e:
        return web.json_response({"error": str(e)}, status=400)
    except Exception as e:
        _log.exception("animatic export failed")
        return web.json_response({"error": str(e)}, status=500)

    return web.json_response({"video_url": url})
