import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from ComfyTV.api import view_patch


def _core_like_view(base):
    async def view(request):
        filename = request.rel_url.query.get('filename', '')
        if not filename or filename[0] == '/' or '..' in filename:
            return web.Response(status=400)
        p = base / filename
        if p.is_file():
            return web.FileResponse(p)
        return web.Response(status=404)
    return view


def _routes_with_view(base):
    routes = web.RouteTableDef()
    routes.get('/view')(_core_like_view(base))
    return routes


@pytest.fixture()
async def client(tmp_path, monkeypatch):
    import folder_paths
    monkeypatch.setattr(folder_paths, 'get_directory_by_type', lambda t: str(tmp_path / t))
    inp = tmp_path / 'input'
    inp.mkdir()
    (inp / 'clip..._00001_.mp4').write_bytes(b'\x00' * 64)
    (inp / 'note...txt').write_text('x')
    (inp / 'plain.mp4').write_bytes(b'\x00' * 8)
    routes = _routes_with_view(inp)
    assert view_patch.install(routes)
    app = web.Application()
    app.router.add_routes(routes)
    c = TestClient(TestServer(app))
    await c.start_server()
    yield c
    await c.close()


async def test_dotdot_inside_basename_is_served(client):
    r = await client.get('/view', params={'filename': 'clip..._00001_.mp4', 'type': 'input'})
    assert r.status == 200
    assert r.headers['Content-Type'].startswith('video/mp4')
    assert len(await r.read()) == 64


async def test_range_requests_still_work(client):
    r = await client.get('/view', params={'filename': 'clip..._00001_.mp4', 'type': 'input'},
                         headers={'Range': 'bytes=0-9'})
    assert r.status == 206
    assert len(await r.read()) == 10


@pytest.mark.parametrize('name', ['..', '../clip..._00001_.mp4', 'sub/../clip..._00001_.mp4',
                                  '..\\clip..._00001_.mp4'])
async def test_traversal_still_rejected(client, name):
    r = await client.get('/view', params={'filename': name, 'type': 'input'})
    assert r.status == 400


async def test_non_media_falls_through_to_core(client):
    r = await client.get('/view', params={'filename': 'note...txt', 'type': 'input'})
    assert r.status == 400


async def test_missing_dotdot_file_falls_through_to_core(client):
    r = await client.get('/view', params={'filename': 'nope...mp4', 'type': 'input'})
    assert r.status == 400


async def test_plain_names_untouched(client):
    r = await client.get('/view', params={'filename': 'plain.mp4', 'type': 'input'})
    assert r.status == 200
    r = await client.get('/view', params={'filename': 'zzz.mp4', 'type': 'input'})
    assert r.status == 404


def test_install_is_idempotent(tmp_path):
    routes = _routes_with_view(tmp_path)
    assert view_patch.install(routes)
    first = routes._items[0].handler
    assert view_patch.install(routes)
    assert routes._items[0].handler is first
    assert len(routes._items) == 1


def test_install_without_view_route():
    assert view_patch.install(web.RouteTableDef()) is False
