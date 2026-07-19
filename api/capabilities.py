import logging
import tomllib
from pathlib import Path

from aiohttp import web

from .. import storage
from ._common import routes
from .presets import _stage_class_map
from .resources import RESOURCE_KIND_DIRS, decorate

_log = logging.getLogger(__name__)


def _read_version() -> str:
    try:
        text = (Path(__file__).resolve().parents[1] / "pyproject.toml") \
            .read_text(encoding="utf-8")
        return str(tomllib.loads(text)["project"]["version"])
    except (OSError, KeyError, TypeError, tomllib.TOMLDecodeError) as e:
        _log.warning("[ComfyTV/capabilities] version read failed: %s", e)
        return "unknown"


VERSION = _read_version()


@routes.get("/comfytv/capabilities")
async def get_capabilities(request: web.Request) -> web.Response:
    from ..nodes.stages.common.resource_fields import RESOURCE_FIELDS
    node_ids = sorted((await _stage_class_map()).keys())
    resources: dict[str, list[dict]] = {kind: [] for kind in RESOURCE_KIND_DIRS}
    for row in storage.list_resources():
        if decorate(row)["missing"]:
            continue
        resources.setdefault(row["kind"], []).append({
            "filename": row["filename"],
            "sha256": row.get("sha256") or "",
        })
    return web.json_response({
        "version": VERSION,
        "node_ids": node_ids,
        "resources": resources,
        "resource_fields": RESOURCE_FIELDS,
    })
