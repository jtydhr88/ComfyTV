import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
async def client(reset_db):
    from ComfyTV.api import storyboard_editor  # noqa: F401
    from ComfyTV.api._common import routes
    app = web.Application()
    app.add_routes(routes)
    c = TestClient(TestServer(app))
    await c.start_server()
    yield c
    await c.close()


async def test_client_errors_are_400_not_500(client):
    from ComfyTV.runners.animatic import MAX_BOARDS
    r = await client.post("/comfytv/storyboard_editor/animatic", json={"boards": "x"})
    assert r.status == 400 and (await r.json())["error"] == "boards must be an array"
    r = await client.post("/comfytv/storyboard_editor/animatic", json={"boards": []})
    assert r.status == 400 and (await r.json())["error"] == "boards required"
    r = await client.post("/comfytv/storyboard_editor/animatic",
                          json={"boards": [{}] * (MAX_BOARDS + 1)})
    assert r.status == 400
    assert (await r.json())["error"] == f"too many boards ({MAX_BOARDS + 1} > {MAX_BOARDS})"


async def test_validation_errors_from_the_renderer_are_400(client, monkeypatch):
    from ComfyTV.runners import animatic
    monkeypatch.setattr(animatic, "boards_to_animatic",
                        lambda *a, **k: (_ for _ in ()).throw(ValueError("bad duration")))
    r = await client.post("/comfytv/storyboard_editor/animatic", json={"boards": [{"duration_ms": -1}]})
    assert r.status == 400 and (await r.json())["error"] == "bad duration"
