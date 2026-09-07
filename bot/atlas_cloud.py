from __future__ import annotations

import os

from .local_llm import LocalLlmProvider
from .providers import ProviderStatus

_DEFAULT_API_BASE = "https://api.atlascloud.ai/v1"
_API_BASE_ENV = "ATLASCLOUD_API_BASE"
_API_KEY_ENVS = ("ATLASCLOUD_API_KEY", "ATLAS_CLOUD_API_KEY")


class AtlasCloudProvider(LocalLlmProvider):
    id = "atlas-cloud"
    label = "Atlas Cloud"

    def __init__(self, *, base_url: str | None = None,
                 model: str | None = None) -> None:
        super().__init__(base_url=base_url, model=model)

    @staticmethod
    def _api_key() -> str:
        for name in _API_KEY_ENVS:
            key = os.environ.get(name, "").strip()
            if key:
                return key
        return ""

    def _base_url(self) -> str:
        if self._base_url_override is not None:
            return self._base_url_override.rstrip("/")
        return os.environ.get(
            _API_BASE_ENV, _DEFAULT_API_BASE).strip().rstrip("/")

    def _api_headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        key = self._api_key()
        if key:
            headers["Authorization"] = f"Bearer {key}"
        return headers

    def _lms_bin(self) -> str:
        return ""

    async def probe(self) -> ProviderStatus:
        if not self._api_key():
            return ProviderStatus(
                available=False,
                logged_in=False,
                detail="set ATLASCLOUD_API_KEY in the ComfyTV environment",
            )
        return await super().probe()

    async def list_models(self) -> list[str]:
        if not self._api_key():
            return []
        return await super().list_models()
