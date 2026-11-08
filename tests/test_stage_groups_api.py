from __future__ import annotations

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
async def client(reset_db):
    from ComfyTV import api  # noqa: F401 — registers routes on the stub PromptServer
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_client = TestClient(TestServer(app))
    await test_client.start_server()
    yield test_client
    await test_client.close()


DATA = {
    "nodes": [{"id": 1, "type": "ComfyTV.TextStage"}, {"id": 2, "type": "ComfyTV.ImageStage"}],
    "links": [[1, 1, 0, 2, 0, "COMFYTV_TEXT"]],
}


async def _mk(client, name="storyboard", data=None):
    return await client.post("/comfytv/stage_groups", json={"name": name, "data": data or DATA})


class TestStageGroupRoutes:
    async def test_create_list_rename_delete(self, client):
        group = (await (await _mk(client)).json())["group"]
        assert group["name"] == "storyboard"
        assert group["data"] == DATA
        assert group["created_at"]

        listed = (await (await client.get("/comfytv/stage_groups")).json())["groups"]
        assert [g["id"] for g in listed] == [group["id"]]

        r = await client.patch(f"/comfytv/stage_groups/{group['id']}", json={"name": "shots"})
        assert (await r.json())["group"]["name"] == "shots"

        r = await client.delete(f"/comfytv/stage_groups/{group['id']}")
        assert r.status == 200
        r = await client.delete(f"/comfytv/stage_groups/{group['id']}")
        assert r.status == 404

    async def test_same_name_overwrites(self, client):
        first = (await (await _mk(client)).json())["group"]
        data = {"nodes": [{"id": 5, "type": "ComfyTV.CropStage"}], "links": []}
        second = (await (await _mk(client, data=data)).json())["group"]
        assert second["id"] == first["id"]
        assert second["data"] == data

    async def test_create_requires_name_and_nodes(self, client):
        assert (await client.post("/comfytv/stage_groups", json={"data": DATA})).status == 400
        assert (await _mk(client, data={"nodes": []})).status == 400
        r = await client.post("/comfytv/stage_groups", json={"name": "x", "data": "nope"})
        assert r.status == 400

    async def test_rename_clash_and_unknown(self, client):
        await _mk(client, name="a")
        b = (await (await _mk(client, name="b")).json())["group"]
        assert (await client.patch(f"/comfytv/stage_groups/{b['id']}", json={"name": "a"})).status == 404
        assert (await client.patch("/comfytv/stage_groups/9999", json={"name": "x"})).status == 404
        assert (await client.patch("/comfytv/stage_groups/abc", json={"name": "x"})).status == 404
