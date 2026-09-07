from __future__ import annotations

from ComfyTV.bot.atlas_cloud import AtlasCloudProvider
from ComfyTV.bot.providers import get_provider


class TestConfig:
    def test_default_base_url(self, monkeypatch):
        monkeypatch.delenv("ATLASCLOUD_API_BASE", raising=False)
        provider = AtlasCloudProvider()
        assert provider._base_url() == "https://api.atlascloud.ai/v1"

    def test_base_url_env_and_override(self, monkeypatch):
        monkeypatch.setenv("ATLASCLOUD_API_BASE", "https://example.test/v1/")
        assert AtlasCloudProvider()._base_url() == "https://example.test/v1"
        provider = AtlasCloudProvider(base_url="https://override.test/v1/")
        assert provider._base_url() == "https://override.test/v1"

    def test_api_key_aliases(self, monkeypatch):
        monkeypatch.delenv("ATLASCLOUD_API_KEY", raising=False)
        monkeypatch.setenv("ATLAS_CLOUD_API_KEY", "alias-key")
        provider = AtlasCloudProvider()
        assert provider._api_headers()["Authorization"] == \
            "Bearer alias-key"

        monkeypatch.setenv("ATLASCLOUD_API_KEY", "primary-key")
        assert provider._api_headers()["Authorization"] == \
            "Bearer primary-key"

    async def test_probe_requires_api_key(self, monkeypatch):
        monkeypatch.delenv("ATLASCLOUD_API_KEY", raising=False)
        monkeypatch.delenv("ATLAS_CLOUD_API_KEY", raising=False)
        status = await AtlasCloudProvider().probe()
        assert status.available is False
        assert status.logged_in is False
        assert "ATLASCLOUD_API_KEY" in status.detail

    async def test_list_models_without_api_key(self, monkeypatch):
        monkeypatch.delenv("ATLASCLOUD_API_KEY", raising=False)
        monkeypatch.delenv("ATLAS_CLOUD_API_KEY", raising=False)
        assert await AtlasCloudProvider().list_models() == []

    def test_does_not_manage_local_models(self):
        assert AtlasCloudProvider()._lms_bin() == ""


def test_provider_is_registered():
    provider = get_provider("atlas-cloud")
    assert isinstance(provider, AtlasCloudProvider)
    assert provider.label == "Atlas Cloud"
