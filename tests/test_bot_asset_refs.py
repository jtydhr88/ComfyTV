import pytest


@pytest.fixture()
def asset(reset_db):
    from ComfyTV import storage
    return storage.create_asset(name="deep-src", payload_url="/view?filename=poster.png&type=output",
                                media_type="image")


def test_ref_line_carries_the_url_and_an_executable_hint(asset):
    from ComfyTV.api.bot_media import _resolve_refs
    items, lines = _resolve_refs([{"kind": "asset", "asset_id": asset["id"]}])
    assert items[0]["asset_id"] == asset["id"]
    line = lines[0]
    assert "payload_url /view?filename=poster.png&type=output" in line
    assert f"view_image asset_id={asset['id']}" in line


async def test_view_image_accepts_asset_id(asset, monkeypatch):
    from ComfyTV.api.mcp_tools import media
    seen = {}
    monkeypatch.setattr(media, "_render_view_image", lambda url, max_px: seen.setdefault("url", url) and {"ok": True})
    out = await media._view_image({"asset_id": asset["id"]})
    assert out == {"ok": True}
    assert seen["url"] == "/view?filename=poster.png&type=output"
    with pytest.raises(ValueError, match="asset 99999 not found"):
        await media._view_image({"asset_id": 99999})
    with pytest.raises(ValueError, match="url .* or asset_id is required"):
        await media._view_image({})
