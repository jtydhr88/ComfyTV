from __future__ import annotations

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
async def client(reset_db, monkeypatch):
    from ComfyTV import api  # noqa: F401 — registers routes on the stub PromptServer
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


async def _mk_category(client, name):
    r = await client.post("/comfytv/asset_categories", json={"name": name})
    return (await r.json())["category"]["id"]


async def _mk_preset(client, name="warm"):
    r = await client.post("/comfytv/presets", json={
        "kind": "ComfyTV.VideoColorStage", "name": name, "config": {"exposure": 0.5},
    })
    return (await r.json())["preset"]


async def _mk_entry(client, label="hero", kind="prompt"):
    from ComfyTV import storage
    storage.ensure_default_project()
    r = await client.post("/comfytv/projects/default/entries", json={
        "kind": kind, "label": label, "content": "a fennec girl",
    })
    return (await r.json())["entry"]


async def _set_tags(client, kind, tid, ids):
    return await client.put(f"/comfytv/tags/{kind}/{tid}", json={"category_ids": ids})


def _user_presets(payload):
    return [p for p in payload["presets"] if not p["builtin"]]


class TestTagRoutes:
    async def test_new_rows_start_untagged(self, client):
        assert (await _mk_preset(client))["category_ids"] == []
        assert (await _mk_entry(client))["category_ids"] == []

    async def test_set_and_list_preset_tags(self, client):
        a = await _mk_category(client, "warm")
        b = await _mk_category(client, "film")
        preset = await _mk_preset(client)

        r = await _set_tags(client, "preset", preset["id"], [b, a])
        assert (await r.json()) == {"ok": True, "category_ids": sorted([a, b])}

        listed = _user_presets(await (await client.get("/comfytv/presets")).json())
        assert listed[0]["category_ids"] == sorted([a, b])

        r = await _set_tags(client, "preset", preset["id"], [a])
        assert (await r.json())["category_ids"] == [a]

    async def test_entry_tags_survive_edit(self, client):
        cat = await _mk_category(client, "portrait")
        entry = await _mk_entry(client)
        await _set_tags(client, "entry", entry["id"], [cat])

        r = await client.post("/comfytv/projects/default/entries", json={
            "id": entry["id"], "kind": "prompt", "label": "hero", "content": "edited",
        })
        assert (await r.json())["entry"]["category_ids"] == [cat]

        listed = (await (await client.get("/comfytv/projects/default/entries")).json())["entries"]
        assert [e["category_ids"] for e in listed if e["id"] == entry["id"]] == [[cat]]

    async def test_tags_shared_with_asset_categories(self, client):
        cat = await _mk_category(client, "shared")
        preset = await _mk_preset(client)
        entry = await _mk_entry(client)
        await _set_tags(client, "preset", preset["id"], [cat])
        await _set_tags(client, "entry", entry["id"], [cat])

        r = await client.delete(f"/comfytv/asset_categories/{cat}")
        assert r.status == 200

        listed = _user_presets(await (await client.get("/comfytv/presets")).json())
        assert listed[0]["category_ids"] == []
        entries = (await (await client.get("/comfytv/projects/default/entries")).json())["entries"]
        assert all(e["category_ids"] == [] for e in entries)

    async def test_deleted_row_does_not_leak_tags_to_reused_id(self, client):
        cat = await _mk_category(client, "sticky")
        first = await _mk_preset(client, "one")
        await _set_tags(client, "preset", first["id"], [cat])
        await client.delete(f"/comfytv/presets/{first['id']}")

        second = await _mk_preset(client, "two")
        assert second["category_ids"] == []

    async def test_stage_group_and_resource_kinds_accepted(self, client):
        from ComfyTV import storage
        cat = await _mk_category(client, "kit")
        group = storage.save_stage_group("combo", {"nodes": [{}]}, None)
        res = storage.register_resource("lut", "warm.cube", "comfytv/luts")

        r = await _set_tags(client, "stage_group", group["id"], [cat])
        assert (await r.json())["category_ids"] == [cat]
        r = await _set_tags(client, "resource", res["id"], [cat])
        assert (await r.json())["category_ids"] == [cat]

        assert storage.list_stage_groups()[0]["category_ids"] == [cat]
        assert storage.list_resources("lut")[0]["category_ids"] == [cat]

        assert storage.delete_stage_group(group["id"])
        assert storage.unregister_resource(res["id"])

    async def test_rejects_bad_input(self, client):
        preset = await _mk_preset(client)
        assert (await _set_tags(client, "workflow", preset["id"], [])).status == 404
        assert (await _set_tags(client, "preset", 9999, [])).status == 404
        assert (await _set_tags(client, "preset", preset["id"], [424242])).status == 404
        r = await client.put(f"/comfytv/tags/preset/{preset['id']}", json={"category_ids": "x"})
        assert r.status == 400
