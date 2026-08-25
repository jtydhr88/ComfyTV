from __future__ import annotations

from .local_llm import LocalLlmProvider
from .providers import ProviderStatus


class ComfyUiLlmProvider(LocalLlmProvider):
    id = "comfyui-llm"
    label = "ComfyUI LLM"

    def _base_url(self) -> str:
        if self._base_url_override is not None:
            return self._base_url_override.rstrip("/")
        try:
            from server import PromptServer
            port = getattr(PromptServer.instance, "port", None) or 8188
        except Exception:
            port = 8188
        return f"http://127.0.0.1:{port}/comfytv/llm/v1"

    def _lms_bin(self) -> str:
        return ""

    async def probe(self) -> ProviderStatus:
        status = await super().probe()
        if not status.available and "no models" in status.detail:
            return ProviderStatus(
                available=False,
                detail="no generation-capable text encoder found — put a "
                       "Qwen3 or Gemma checkpoint in models/text_encoders")
        return status
