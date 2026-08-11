from __future__ import annotations

import json
from urllib.parse import unquote

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

GUI = json.dumps({"nodes": [{"id": 1, "type": "X"}], "groups": []})
GUI_V2 = json.dumps({"nodes": [{"id": 1, "type": "X"}, {"id": 2, "type": "Y"}]})
API_ONLY = json.dumps({"1": {"class_type": "X", "inputs": {}}})


@pytest.fixture()
def workflows_dir(tmp_path, monkeypatch):
    from ComfyTV.runners.workflow_db import seed as wdb_seed
    wdir = tmp_path / "ctv-workflows"
    monkeypatch.setattr(wdb_seed, "_WORKFLOWS_DIR", wdir)
    return wdir


@pytest.fixture()
async def client(reset_db, workflows_dir):
    from ComfyTV import api  # noqa: F401 — registers routes on the stub PromptServer
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


def _native_item(path: str) -> dict:
    return {"path": path, "name": path.rsplit("/", 1)[-1].rsplit(".", 1)[0],
            "mtime": 1.0, "size": 10, "is_linked": False, "linked_id": None}


async def _start_remote(files: dict[str, str], native: list[dict]) -> TestServer:
    app = web.Application()

    async def list_native(request):
        return web.json_response({"workflows": native})

    async def userdata(request):
        rel = unquote(request.match_info["file"])
        content = files.get(rel)
        if content is None:
            return web.Response(status=404)
        return web.Response(text=content, content_type="application/json")

    app.router.add_get("/comfytv/workflows/native", list_native)
    app.router.add_get("/userdata/{file}", userdata)
    srv = TestServer(app)
    await srv.start_server()
    return srv


async def _register_server(client, srv: TestServer) -> int:
    resp = await client.post("/comfytv/servers", json={
        "label": "rig", "host": str(srv.host), "port": srv.port,
    })
    assert resp.status == 200
    return (await resp.json())["server"]["id"]


async def _pull(client, sid: int, kind: str, path: str):
    return await client.post(
        f"/comfytv/servers/{sid}/pull_workflow", json={"kind": kind, "path": path},
    )


class TestServerNativeWorkflows:
    async def test_relays_remote_listing(self, client):
        srv = await _start_remote({}, [_native_item("a.json"), _native_item("sub/b.json")])
        try:
            sid = await _register_server(client, srv)
            resp = await client.get(
                f"/comfytv/servers/{sid}/native_workflows?kind=image")
            assert resp.status == 200
            data = await resp.json()
        finally:
            await srv.close()
        assert [w["path"] for w in data["workflows"]] == ["a.json", "sub/b.json"]
        assert all(w["pulled"] is False for w in data["workflows"])

    async def test_unknown_server_404(self, client):
        resp = await client.get("/comfytv/servers/999/native_workflows?kind=image")
        assert resp.status == 404

    async def test_unreachable_remote_502(self, client):
        srv = await _start_remote({}, [])
        sid = await _register_server(client, srv)
        await srv.close()
        resp = await client.get(
            f"/comfytv/servers/{sid}/native_workflows?kind=image")
        assert resp.status == 502


class TestPullWorkflow:
    async def test_pull_imports_graph_workflow(self, client, workflows_dir):
        srv = await _start_remote(
            {"workflows/sub/foo.json": GUI}, [_native_item("sub/foo.json")])
        try:
            sid = await _register_server(client, srv)
            resp = await _pull(client, sid, "image", "sub/foo.json")
            assert resp.status == 200
            data = await resp.json()
            assert data["ok"] is True
            assert data["kind"] == "image"
            assert data["label"] == "foo"
            target = workflows_dir / "image" / "foo.json"
            assert target.read_text(encoding="utf-8") == GUI

            listing = await client.get(
                f"/comfytv/servers/{sid}/native_workflows?kind=image")
            rows = (await listing.json())["workflows"]
        finally:
            await srv.close()
        assert rows[0]["pulled"] is True
        assert rows[0]["pulled_label"] == "foo"

    async def test_repull_overwrites_same_file(self, client, workflows_dir):
        files = {"workflows/foo.json": GUI}
        srv = await _start_remote(files, [_native_item("foo.json")])
        try:
            sid = await _register_server(client, srv)
            assert (await _pull(client, sid, "image", "foo.json")).status == 200
            files["workflows/foo.json"] = GUI_V2
            resp = await _pull(client, sid, "image", "foo.json")
            assert resp.status == 200
            data = await resp.json()
        finally:
            await srv.close()
        assert data["label"] == "foo"
        kind_dir = workflows_dir / "image"
        assert sorted(p.name for p in kind_dir.glob("*.json")) == ["foo.json"]
        assert (kind_dir / "foo.json").read_text(encoding="utf-8") == GUI_V2

    async def test_stem_collision_keeps_existing_file(self, client, workflows_dir):
        kind_dir = workflows_dir / "image"
        kind_dir.mkdir(parents=True, exist_ok=True)
        (kind_dir / "foo.json").write_text(GUI_V2, encoding="utf-8")

        srv = await _start_remote(
            {"workflows/foo.json": GUI}, [_native_item("foo.json")])
        try:
            sid = await _register_server(client, srv)
            resp = await _pull(client, sid, "image", "foo.json")
            assert resp.status == 200
            data = await resp.json()
        finally:
            await srv.close()
        assert (kind_dir / "foo.json").read_text(encoding="utf-8") == GUI_V2
        assert (kind_dir / "foo-2.json").read_text(encoding="utf-8") == GUI
        assert data["label"] != ""

    async def test_api_format_rejected(self, client):
        srv = await _start_remote(
            {"workflows/api.json": API_ONLY}, [_native_item("api.json")])
        try:
            sid = await _register_server(client, srv)
            resp = await _pull(client, sid, "image", "api.json")
        finally:
            await srv.close()
        assert resp.status == 400

    async def test_missing_remote_file_502(self, client):
        srv = await _start_remote({}, [])
        try:
            sid = await _register_server(client, srv)
            resp = await _pull(client, sid, "image", "gone.json")
        finally:
            await srv.close()
        assert resp.status == 502

    async def test_traversal_path_rejected(self, client):
        srv = await _start_remote({}, [])
        try:
            sid = await _register_server(client, srv)
            resp = await _pull(client, sid, "image", "../secret.json")
        finally:
            await srv.close()
        assert resp.status == 400

    async def test_unknown_kind_rejected(self, client):
        srv = await _start_remote({}, [])
        try:
            sid = await _register_server(client, srv)
            resp = await _pull(client, sid, "nope", "foo.json")
        finally:
            await srv.close()
        assert resp.status == 400
