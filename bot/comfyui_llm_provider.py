from __future__ import annotations

from .local_llm import LocalLlmProvider
from .providers import ProviderStatus


def shim_url() -> str:
    try:
        from server import PromptServer
        port = getattr(PromptServer.instance, "port", None) or 8188
    except Exception:
        port = 8188
    return f"http://127.0.0.1:{port}/comfytv/llm/v1"


class ComfyUiLlmProvider(LocalLlmProvider):
    id = "comfyui-llm"
    label = "ComfyUI LLM (experimental)"
    unloads_lms_during_waits = False

    async def probe(self) -> ProviderStatus:
        status = await super().probe()
        if not status.available and "no models" in status.detail:
            return ProviderStatus(
                available=False,
                detail="no generation-capable text encoder found — put a "
                       "Qwen3 or Gemma checkpoint in models/text_encoders")
        return status
