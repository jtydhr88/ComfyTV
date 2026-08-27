import asyncio
import logging
import shutil
import time
from typing import Any, Callable, Optional

import aiohttp

from ._media_paths import fresh_output_path, localize, path_to_view_url

logger = logging.getLogger(__name__)

DEFAULT_BRIDGE_URL = "http://127.0.0.1:7684"
PROBE_TIMEOUT_S = 3.0
REQUEST_TIMEOUT_S = 120.0
PROBE_CACHE_TTL_S = 3.0
POLL_INTERVAL_S = 1.0

_probe_cache: dict[str, Any] = {"at": 0.0, "status": None}


class BlenderUnavailable(RuntimeError):
    def __init__(self):
        super().__init__(
            "Blender bridge is not running. Launch the blender-web "
            "distribution with blender-for-comfytv.bat and try again.")


def _setting(key: str, default: str = "") -> str:
    from .. import storage
    try:
        value = storage.get_setting(key)
    except Exception:
        return default
    return str(value) if value else default


def bridge_base() -> str:
    return (_setting("blender-bridge-url") or DEFAULT_BRIDGE_URL).rstrip("/")


def _own_base() -> str:
    try:
        from server import PromptServer
        port = PromptServer.instance.port
        return f"http://127.0.0.1:{port}"
    except Exception:
        return "http://127.0.0.1:8188"


async def _request(method: str, path: str, *,
                   json_body: Optional[dict] = None,
                   timeout: float = REQUEST_TIMEOUT_S) -> dict:
    url = f"{bridge_base()}{path}"
    client_timeout = aiohttp.ClientTimeout(total=timeout)
    headers = {"X-ComfyTV-Base": _own_base()}
    async with aiohttp.ClientSession(timeout=client_timeout) as session:
        async with session.request(method, url, json=json_body,
                                   headers=headers) as resp:
            data = await resp.json(content_type=None)
            if resp.status != 200:
                raise RuntimeError(
                    f"Blender bridge {path} -> HTTP {resp.status}: "
                    f"{data.get('error') if isinstance(data, dict) else data!r}")
    return data


async def probe(*, fresh: bool = False) -> dict:
    now = time.monotonic()
    if not fresh and _probe_cache["status"] is not None \
            and now - _probe_cache["at"] < PROBE_CACHE_TTL_S:
        return _probe_cache["status"]

    status: dict[str, Any] = {"online": False}
    try:
        info = await _request("GET", "/comfytv/status", timeout=PROBE_TIMEOUT_S)
        status.update(info)
        status["online"] = info.get("app") == "blender-web"
    except Exception as e:
        logger.debug("[ComfyTV/blender] probe failed: %s", e)

    _probe_cache.update(at=now, status=status)
    return status


async def _require_online():
    if not (await probe(fresh=True)).get("online"):
        raise BlenderUnavailable()


async def list_cameras() -> dict:
    await _require_online()
    return await _request("GET", "/comfytv/cameras", timeout=PROBE_TIMEOUT_S)


async def add_to_scene(model_url: str) -> dict:
    await _require_online()
    model_path = await asyncio.to_thread(localize, model_url)
    return await _request("POST", "/comfytv/import",
                          json_body={"path": str(model_path)})


async def render_camera(camera: str, mode: str, *, shading: str = "clay",
                        progress: Optional[Callable[[float, str], None]] = None) -> str:
    status = await probe(fresh=True)
    if not status.get("online"):
        raise BlenderUnavailable()

    def _tick(frac: float, text: str):
        if progress:
            progress(frac, text)

    scene = status.get("scene") or {}
    total = 1 if mode == "still" else max(
        int(scene.get("frame_end", 1)) - int(scene.get("frame_start", 1)) + 1, 1)

    _tick(0.02, "rendering")
    job = await _request("POST", "/comfytv/render",
                         json_body={"camera": camera, "mode": mode,
                                    "shading": shading})
    job_id = job["job_id"]

    deadline = time.monotonic() + total * 10 + 180
    while True:
        await asyncio.sleep(POLL_INTERVAL_S)
        state = await _request("GET", f"/comfytv/jobs/{job_id}",
                               timeout=PROBE_TIMEOUT_S)
        if state.get("status") == "done":
            break
        if state.get("status") == "error":
            raise RuntimeError(f"Blender render failed: {state.get('error')}")
        if time.monotonic() > deadline:
            raise TimeoutError(f"Blender render timed out (job {job_id})")
        frac = float(state.get("progress") or 0.0)
        _tick(0.02 + frac * 0.95,
              f"rendering {int(frac * total)}/{total}" if total > 1 else "rendering")

    ext = ".png" if mode == "still" else ".mp4"
    out = fresh_output_path(ext, subfolder="comfytv/blender")
    await asyncio.to_thread(shutil.copy2, state["result"]["path"], out)
    _tick(1.0, "done")
    return path_to_view_url(out)
