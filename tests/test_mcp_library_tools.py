from __future__ import annotations

import os
import time

import pytest


def _settled(path) -> None:
    old = time.time() - 60
    os.utime(path, (old, old))


@pytest.fixture()
def png(reset_db):
    from PIL import Image
    from ComfyTV.api.assets import media_dir
    root = media_dir()
    for p in sorted(root.rglob("*"), reverse=True):
        p.unlink() if p.is_file() else p.rmdir()
    path = root / "probe.png"
    Image.new("RGB", (64, 48), (255, 0, 0)).save(path)
    _settled(path)
    return path


class TestEntriesUpsert:
    async def test_same_kind_and_label_updates_in_place(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.api.mcp_tools import _entries
        storage.ensure_default_project()
        a = await _entries({"action": "upsert", "kind": "fragment",
                            "label": "dup-probe", "content": "v0"})
        b = await _entries({"action": "upsert", "kind": "fragment",
                            "label": "dup-probe", "content": "v1"})
        assert b["entry"]["id"] == a["entry"]["id"]
        assert b["entry"]["content"] == "v1"
        rows = (await _entries({"action": "list"}))["entries"]
        assert [r["id"] for r in rows if r["label"] == "dup-probe"] == [a["entry"]["id"]]
        c = await _entries({"action": "upsert", "kind": "prompt",
                            "label": "dup-probe", "content": "other kind"})
        assert c["entry"]["id"] != a["entry"]["id"]

    async def test_id_still_renames(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.api.mcp_tools import _entries
        storage.ensure_default_project()
        a = await _entries({"action": "upsert", "kind": "fragment",
                            "label": "old", "content": "x"})
        b = await _entries({"action": "upsert", "kind": "fragment",
                            "label": "new", "content": "x", "id": a["entry"]["id"]})
        assert b["entry"]["id"] == a["entry"]["id"]
        assert b["entry"]["label"] == "new"


class TestAssetProbe:
    def test_adopt_fills_dimensions_and_mime(self, png):
        from ComfyTV.api.assets import adopt_media_folder
        [row] = adopt_media_folder()
        assert (row["width"], row["height"]) == (64, 48)
        assert row["mime_type"] == "image/png"
        assert row["size_bytes"] == png.stat().st_size

    async def test_mcp_create_probes_the_file(self, png):
        from ComfyTV.api.assets import _media_view_url, media_dir
        from ComfyTV.api.mcp_tools import _asset_edit
        url = _media_view_url(png.relative_to(media_dir()))
        out = await _asset_edit({"action": "create", "payload_url": url,
                                 "media_type": "image", "name": "probe"})
        asset = out["asset"]
        assert (asset["width"], asset["height"]) == (64, 48)
        assert asset["mime_type"] == "image/png"
        assert asset["size_bytes"] == png.stat().st_size

    async def test_missing_file_leaves_meta_null(self, reset_db):
        from ComfyTV.api.mcp_tools import _asset_edit
        out = await _asset_edit({"action": "create", "media_type": "image",
                                 "payload_url": "/view?filename=nope.png&type=output"})
        assert out["asset"]["width"] is None
        assert out["asset"]["file_missing"] is True


class TestCategories:
    async def test_rename_and_delete_by_id_or_name(self, reset_db):
        from ComfyTV.api.mcp_tools import _asset_edit, _assets
        cat = (await _asset_edit({"action": "create_category", "name": "e2e"}))["category"]
        out = await _asset_edit({"action": "rename_category",
                                 "category_id": str(cat["id"]), "new_name": "e2e-2"})
        assert out["category"]["name"] == "e2e-2"
        assert (await _assets({"category": str(cat["id"])}))["assets"] == []
        out = await _asset_edit({"action": "delete_category", "name": "e2e-2"})
        assert out["ok"] is True and out["deleted"]["id"] == cat["id"]
        with pytest.raises(ValueError, match="not found"):
            await _asset_edit({"action": "delete_category", "name": "e2e-2"})

    async def test_unknown_category_id_is_an_error(self, reset_db):
        from ComfyTV.api.mcp_tools import _asset_edit, _assets
        await _asset_edit({"action": "create_category", "name": "real"})
        with pytest.raises(ValueError, match=r"category 9999 not found; existing: \d+='real'"):
            await _assets({"category": "9999"})
