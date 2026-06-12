import re

from aiohttp import web

from ..nodes.stages import STAGE_META
from ..nodes.stages.common.caps import caps_payload
from ..runners import RUNNER_REGISTRY, WORKFLOW_KINDS
from ._common import routes


@routes.get("/comfytv/stages")
async def list_stages(_request: web.Request) -> web.Response:
    stages = [
        {
            "node_id": f"ComfyTV.{cls_name}",
            "kind": meta.get("kind", "image"),
            "variant": meta.get("variant"),
            "workflow_kind": meta.get("workflow_kind"),
        }
        for cls_name, meta in STAGE_META.items()
    ]
    return web.json_response({"stages": stages})


@routes.get("/comfytv/caps")
async def list_caps(_request: web.Request) -> web.Response:
    return web.json_response(caps_payload())


_UPSTREAM_PAT = re.compile(
    r'^upstream_(image|video|audio|text):(annotated|value|masked)(?:\[(\d+)\])?$'
)
_KINDS = ("image", "video", "audio", "text")


def _compute_input_usage(bindings: list[dict]) -> dict:
    uses     = {k: False for k in _KINDS}
    requires = {k: False for k in _KINDS}
    requires_count: dict[str, int] = {k: 0 for k in _KINDS}
    max_inputs: dict[str, int | None] = {k: 0 for k in _KINDS}
    uses_main_prompt = False

    for cell in bindings or []:
        src = str(cell.get("from") or "")
        if src == "main_prompt":
            uses_main_prompt = True
            continue
        m = _UPSTREAM_PAT.match(src)
        if not m:
            continue
        kind = m.group(1)
        idx = int(m.group(3)) if m.group(3) else 0
        uses[kind] = True
        if cell.get("required") is True:
            requires[kind] = True
            if idx + 1 > requires_count[kind]:
                requires_count[kind] = idx + 1
        cur = max_inputs[kind] or 0
        if idx + 1 > cur:
            max_inputs[kind] = idx + 1

    if uses_main_prompt:
        uses["text"] = True
        max_inputs["text"] = None

    return {
        "uses": uses,
        "requires": requires,
        "requires_count": requires_count,
        "max_inputs": max_inputs,
    }


@routes.get("/comfytv/workflow_info")
async def workflow_info(_request: web.Request) -> web.Response:
    from ..runners import workflow_db
    out: dict[str, dict[str, dict]] = {kind: {} for kind in WORKFLOW_KINDS}

    for entry in workflow_db.list_workflow_bindings():
        kind = entry["kind"]
        if kind not in out:
            out[kind] = {}
        out[kind][entry["label"]] = _compute_input_usage(entry["bindings"])

    for r in RUNNER_REGISTRY.all():
        for k in r.kinds:
            if k in out and r.label not in out[k]:
                out[k][r.label] = {
                    "uses":           {k_: False for k_ in _KINDS},
                    "requires":       {k_: False for k_ in _KINDS},
                    "requires_count": {k_: 0     for k_ in _KINDS},
                    "max_inputs":     {k_: 0     for k_ in _KINDS},
                }

    return web.json_response(out)
