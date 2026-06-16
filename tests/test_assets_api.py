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
    resp = await client.post("/comfytv/asset_categories", json={"name": name})
    return (await resp.json())["category"]


async def _mk_asset(client, **body):
    body.setdefault("payload_url", "/view?filename=a.png&type=input")
    resp = await client.post("/comfytv/assets", json=body)
    return resp


class TestCategoryRoutes:
    async def test_create_list_rename_delete(self, client):
        cat = await _mk_category(client, "people")
        assert cat["name"] == "people"

        listed = await (await client.get("/comfytv/asset_categories")).json()
        assert [c["name"] for c in listed["categories"]] == ["people"]

        r = await client.patch(f"/comfytv/asset_categories/{cat['id']}", json={"name": "folks"})
        assert (await r.json())["category"]["name"] == "folks"

        r = await client.delete(f"/comfytv/asset_categories/{cat['id']}")
        assert r.status == 200

    async def test_create_duplicate_conflict(self, client):
        await _mk_category(client, "dup")
        r = await client.post("/comfytv/asset_categories", json={"name": "dup"})
        assert r.status == 409

    async def test_create_blank_rejected(self, client):
        r = await client.post("/comfytv/asset_categories", json={"name": "  "})
        assert r.status == 400


class TestAssetRoutes:
    async def test_create_with_tags(self, client):
        c1 = await _mk_category(client, "a")
        c2 = await _mk_category(client, "b")
        resp = await _mk_asset(client, name="hero", category_ids=[c1["id"], c2["id"]])
        assert resp.status == 200
        asset = (await resp.json())["asset"]
        assert asset["category_ids"] == sorted([c1["id"], c2["id"]])

    async def test_create_requires_payload(self, client):
        r = await client.post("/comfytv/assets", json={"name": "x"})
        assert r.status == 400

    async def test_create_bad_category_ids_type(self, client):
        r = await _mk_asset(client, name="x", category_ids="nope")
        assert r.status == 400

    async def test_create_unknown_category_rejected(self, client):
        r = await _mk_asset(client, name="x", category_ids=[9999])
        assert r.status == 400

    async def test_list_filtered_by_category(self, client):
        c = await _mk_category(client, "c")
        tagged = (await (await _mk_asset(client, name="t", category_ids=[c["id"]])).json())["asset"]
        await _mk_asset(client, name="plain")
        rows = await (await client.get(f"/comfytv/assets?category={c['id']}")).json()
        assert [a["id"] for a in rows["assets"]] == [tagged["id"]]
        none_rows = await (await client.get("/comfytv/assets?category=none")).json()
        assert [a["name"] for a in none_rows["assets"]] == ["plain"]

    async def test_patch_replaces_tags(self, client):
        c1 = await _mk_category(client, "a")
        c2 = await _mk_category(client, "b")
        asset = (await (await _mk_asset(client, name="x", category_ids=[c1["id"]])).json())["asset"]
        r = await client.patch(f"/comfytv/assets/{asset['id']}", json={"category_ids": [c2["id"]]})
        assert (await r.json())["asset"]["category_ids"] == [c2["id"]]

    async def test_delete_asset(self, client):
        asset = (await (await _mk_asset(client, name="x")).json())["asset"]
        r = await client.delete(f"/comfytv/assets/{asset['id']}")
        assert r.status == 200
        r = await client.delete(f"/comfytv/assets/{asset['id']}")
        assert r.status == 404


class TestTagRoutes:
    async def test_add_and_remove_tag(self, client):
        c = await _mk_category(client, "c")
        asset = (await (await _mk_asset(client, name="x")).json())["asset"]

        r = await client.post(f"/comfytv/assets/{asset['id']}/categories/{c['id']}")
        assert (await r.json())["asset"]["category_ids"] == [c["id"]]

        r = await client.delete(f"/comfytv/assets/{asset['id']}/categories/{c['id']}")
        assert (await r.json())["asset"]["category_ids"] == []

    async def test_add_tag_unknown_asset(self, client):
        c = await _mk_category(client, "c")
        r = await client.post(f"/comfytv/assets/9999/categories/{c['id']}")
        assert r.status == 404
