"""Media-folder adoption tests."""
import os
import time
from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


def _settled(path: Path) -> None:
    old = time.time() - 60
    os.utime(path, (old, old))


@pytest.fixture()
def media_root(reset_db):
    from ComfyTV.api.assets import media_dir
    root = media_dir()
    for p in sorted(root.rglob('*'), reverse=True):
        if p.is_file():
            p.unlink()
        else:
            p.rmdir()
    return root


class TestAdoptMediaFolder:
    def test_adopts_by_extension(self, media_root):
        from ComfyTV import storage
        from ComfyTV.api.assets import adopt_media_folder
        for name in ('a.mp4', 'b.png', 'c.wav', 'ignore.txt'):
            f = media_root / name
            f.write_bytes(b'x' * 32)
            _settled(f)

        adopted = adopt_media_folder()
        assert sorted(a['name'] for a in adopted) == ['a', 'b', 'c']
        types = {a['name']: a['media_type'] for a in adopted}
        assert types == {'a': 'video', 'b': 'image', 'c': 'audio'}
        assert all(a['source'] == 'folder' for a in adopted)
        assert all(a['payload_url'].startswith('/view?') for a in adopted)
        assert len(storage.list_assets(limit=50)) == 3

    def test_second_scan_is_a_noop(self, media_root):
        from ComfyTV.api.assets import adopt_media_folder
        f = media_root / 'a.mp4'
        f.write_bytes(b'x')
        _settled(f)
        assert len(adopt_media_folder()) == 1
        assert adopt_media_folder() == []

    def test_recurses_subfolders(self, media_root):
        from ComfyTV.api.assets import adopt_media_folder
        sub = media_root / 'shoot1'
        sub.mkdir()
        f = sub / 'take.mov'
        f.write_bytes(b'x')
        _settled(f)
        adopted = adopt_media_folder()
        assert len(adopted) == 1
        assert 'shoot1' in adopted[0]['payload_url']

    def test_skips_files_still_settling(self, media_root):
        from ComfyTV.api.assets import adopt_media_folder
        fresh = media_root / 'copying.mp4'
        fresh.write_bytes(b'x')
        assert adopt_media_folder() == []
        _settled(fresh)
        assert len(adopt_media_folder()) == 1

    def test_ignores_manually_registered_urls(self, media_root):
        from ComfyTV import storage
        from ComfyTV.api.assets import adopt_media_folder, _media_view_url
        f = media_root / 'a.mp4'
        f.write_bytes(b'x')
        _settled(f)
        storage.create_asset(
            name='pre', payload_url=_media_view_url(Path('a.mp4')),
            media_type='video')
        assert adopt_media_folder() == []


@pytest.fixture()
async def client(reset_db):
    from ComfyTV import api  # noqa: F401
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_client = TestClient(TestServer(app))
    await test_client.start_server()
    yield test_client
    await test_client.close()


class TestEndpoint:
    async def test_adopt_endpoint(self, client, media_root):
        f = media_root / 'clip.mp4'
        f.write_bytes(b'x')
        _settled(f)
        res = await client.post('/comfytv/assets/adopt')
        assert res.status == 200
        data = await res.json()
        assert data['ok'] is True
        assert data['adopted'] == 1
        assert data['dir']

        res = await client.post('/comfytv/assets/adopt')
        assert (await res.json())['adopted'] == 0
