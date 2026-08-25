import asyncio
import logging
import time
import uuid

from aiohttp import web

from .. import storage
from ..bot import comfyui_llm_engine as engine
from ._common import routes

_log = logging.getLogger(__name__)

_GEN_LOCK = asyncio.Lock()
_MAX_TOKENS_CAP = 32768


def _enabled() -> bool:
    try:
        return bool(storage.get_setting("enable-bot"))
    except Exception:
        _log.exception("[ComfyTV/llm] settings lookup failed")
        return False


def _thinking_default() -> bool:
    try:
        return bool(storage.get_setting("bot-comfyui-llm-thinking"))
    except Exception:
        return True


def _error(status: int, message: str) -> web.Response:
    return web.json_response(
        {"error": {"message": message, "type": "invalid_request_error"}},
        status=status)


@routes.get("/comfytv/llm/v1/models")
async def llm_models(request: web.Request) -> web.Response:
    if not _enabled():
        return _error(403, "the ComfyTV bot is disabled — enable enable-bot "
                           "in the ComfyTV sidebar under Settings")
    data = [{"id": name, "object": "model", "owned_by": "comfyui"}
            for name in engine.list_model_files()]
    return web.json_response({"object": "list", "data": data})


@routes.post("/comfytv/llm/v1/chat/completions")
async def llm_chat_completions(request: web.Request) -> web.Response:
    if not _enabled():
        return _error(403, "the ComfyTV bot is disabled — enable enable-bot "
                           "in the ComfyTV sidebar under Settings")
    try:
        body = await request.json()
    except Exception:
        return _error(400, "request body is not valid JSON")
    if body.get("stream"):
        return _error(400, "streaming is not supported — request a "
                           "non-streamed completion")
    messages = body.get("messages")
    if not isinstance(messages, list) or not messages:
        return _error(400, "messages must be a non-empty list")

    model = str(body.get("model") or "")
    if not model:
        available = engine.list_model_files()
        if not available:
            return _error(400, "no generation-capable text encoder found — "
                               "put a Qwen3 or Gemma checkpoint in "
                               "models/text_encoders")
        model = available[0]

    tools = body.get("tools") or []
    max_tokens = int(body.get("max_tokens")
                     or body.get("max_completion_tokens") or 1024)
    max_tokens = max(1, min(max_tokens, _MAX_TOKENS_CAP))
    temperature = float(body.get("temperature", 0.7))
    top_p = float(body.get("top_p", 0.95))
    seed = body.get("seed")
    thinking = body["thinking"] if "thinking" in body else _thinking_default()

    try:
        async with _GEN_LOCK:
            result = await asyncio.to_thread(
                engine.generate_chat, model, messages, tools,
                max_tokens=max_tokens, temperature=temperature, top_p=top_p,
                seed=seed, thinking=bool(thinking))
    except FileNotFoundError:
        return _error(404, f"model not found: {model}")
    except Exception as e:
        _log.exception("[ComfyTV/llm] generation failed for %s", model)
        return _error(500, f"generation failed: {e}")

    message = {"role": "assistant", "content": result["content"] or None}
    if result["tool_calls"]:
        message["tool_calls"] = result["tool_calls"]
    return web.json_response({
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "message": message,
                     "finish_reason": result["finish_reason"]}],
        "usage": result["usage"],
    })
