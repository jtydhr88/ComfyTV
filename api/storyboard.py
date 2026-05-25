import logging

from aiohttp import web

from ..runners import RUNNER_REGISTRY, RunnerContext
from ..nodes.stages import (
    _storyboard_regenerate_shot_prompt,
    _parse_shotlist_text,
)
from ._common import routes


_log = logging.getLogger(__name__)


@routes.post("/comfytv/storyboard/regenerate_shot")
async def regenerate_shot(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)

    workflow_label = (body.get("workflow") or "").strip()
    if not workflow_label:
        return web.json_response({"error": "workflow is required"}, status=400)
    premise = body.get("premise") or ""
    characters = body.get("characters") or ""
    shots = body.get("shots") or []
    target_no_raw = body.get("target_shot_no")
    user_hint = body.get("user_hint") or ""

    if not isinstance(shots, list) or not shots:
        return web.json_response({"error": "shots[] is required"}, status=400)
    try:
        target_no = int(target_no_raw)
    except (TypeError, ValueError):
        return web.json_response({"error": "target_shot_no must be an integer"}, status=400)

    runner = RUNNER_REGISTRY.by_label(workflow_label, 'storyboard')
    if runner is None:
        return web.json_response(
            {"error": f"no storyboard runner registered with label {workflow_label!r}"},
            status=404,
        )

    composed = _storyboard_regenerate_shot_prompt(
        premise=premise,
        shots=shots,
        target_no=target_no,
        user_hint=user_hint,
        characters=characters,
    )
    try:
        ctx = RunnerContext(
            kind='storyboard',
            main_prompt=composed,
            upstream={},
            options={'max_length': 2048},
        )
        raw_text = await runner.invoke(ctx)
    except Exception as e:
        _log.warning("[ComfyTV/regenerate_shot] runner failed: %s", e)
        return web.json_response(
            {"error": f"LLM call failed: {e}"}, status=500,
        )

    rows = _parse_shotlist_text(str(raw_text or ''))
    if not rows:
        return web.json_response(
            {"error": "LLM response could not be parsed into a shot"},
            status=502,
        )
    new_shot = rows[0]
    new_shot["shot_no"] = str(target_no)
    return web.json_response({"shot": new_shot})
