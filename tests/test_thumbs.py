"""Image thumbnail service + endpoint tests."""
from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
from PIL import Image


@pytest.fixture()
def image_path(reset_db):
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'thumb-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'big.png'
    Image.new('RGB', (2048, 1024), (200, 40, 40)).save(p)
    return p


@pytest.fixture()
def image_url(image_path):
    from ComfyTV.runners import media
    return media.path_to_view_url(image_path)


@pytest.fixture()
def video_path(image_path):
    import av
    import numpy as np
    p = image_path.with_name('clip-real.mp4')
    with av.open(str(p), 'w') as out:
        stream = out.add_stream('libx264', rate=8)
        stream.width, stream.height = 640, 320
        stream.pix_fmt = 'yuv420p'
        rgb = np.zeros((320, 640, 3), dtype=np.uint8)
        rgb[..., 0] = 250
        for _ in range(4):
            frame = av.VideoFrame.from_ndarray(rgb, format='rgb24')
            out.mux(stream.encode(frame))
        out.mux(stream.encode(None))
    return p


@pytest.fixture()
def video_url(video_path):
    from ComfyTV.runners import media
    return media.path_to_view_url(video_path)


class TestSnapSize:
    def test_snaps_to_allowed_sizes(self):
        from ComfyTV.runners.thumbs import snap_size
        assert snap_size(1) == 256
        assert snap_size(256) == 256
        assert snap_size(257) == 512
        assert snap_size(512) == 512
        assert snap_size(1024) == 1024
        assert snap_size(9999) == 1024


class TestResolveThumb:
    def test_large_image_gets_webp_thumb(self, image_url):
        from ComfyTV.runners.thumbs import resolve_thumb
        dest = resolve_thumb(image_url, 512)
        assert dest.suffix == '.webp'
        with Image.open(dest) as im:
            assert im.size == (512, 256)

    def test_cache_is_reused(self, image_url):
        from ComfyTV.runners.thumbs import resolve_thumb
        first = resolve_thumb(image_url, 512)
        mtime = first.stat().st_mtime_ns
        assert resolve_thumb(image_url, 512) == first
        assert first.stat().st_mtime_ns == mtime

    def test_sizes_get_distinct_thumbs(self, image_url):
        from ComfyTV.runners.thumbs import resolve_thumb
        assert resolve_thumb(image_url, 256) != resolve_thumb(image_url, 512)

    def test_small_image_returns_original(self, image_path, reset_db):
        from ComfyTV.runners import media
        from ComfyTV.runners.thumbs import resolve_thumb
        small = image_path.with_name('small.png')
        Image.new('RGB', (300, 200), (0, 0, 0)).save(small)
        url = media.path_to_view_url(small)
        assert resolve_thumb(url, 256) == small

    def test_non_media_returns_original(self, image_path, reset_db):
        from ComfyTV.runners import media
        from ComfyTV.runners.thumbs import resolve_thumb
        doc = image_path.with_name('notes.txt')
        doc.write_bytes(b'plain text')
        url = media.path_to_view_url(doc)
        assert resolve_thumb(url, 256) == doc

    def test_corrupt_video_raises_not_found(self, image_path, reset_db):
        from ComfyTV.runners import media
        from ComfyTV.runners.thumbs import resolve_thumb
        clip = image_path.with_name('clip.mp4')
        clip.write_bytes(b'not really a video')
        url = media.path_to_view_url(clip)
        with pytest.raises(FileNotFoundError):
            resolve_thumb(url, 256)

    def test_missing_file_raises(self, reset_db):
        from ComfyTV.runners.thumbs import resolve_thumb
        with pytest.raises(FileNotFoundError):
            resolve_thumb('/view?filename=nope.png&type=output', 256)

    def test_alpha_is_preserved(self, image_path, reset_db):
        from ComfyTV.runners import media
        from ComfyTV.runners.thumbs import resolve_thumb
        rgba = image_path.with_name('alpha.png')
        Image.new('RGBA', (1600, 1600), (10, 20, 30, 128)).save(rgba)
        dest = resolve_thumb(media.path_to_view_url(rgba), 256)
        with Image.open(dest) as im:
            assert im.mode == 'RGBA'
            assert im.getpixel((0, 0))[3] < 255

    def test_video_first_frame_gets_webp_thumb(self, video_url):
        from ComfyTV.runners.thumbs import resolve_thumb
        dest = resolve_thumb(video_url, 512)
        assert dest.suffix == '.webp'
        with Image.open(dest) as im:
            assert im.size == (512, 256)
            r, g, b = im.getpixel((256, 128))
            assert r > 200 and g < 80 and b < 80

    def test_video_thumb_cache_is_reused(self, video_url):
        from ComfyTV.runners.thumbs import resolve_thumb
        first = resolve_thumb(video_url, 512)
        mtime = first.stat().st_mtime_ns
        assert resolve_thumb(video_url, 512) == first
        assert first.stat().st_mtime_ns == mtime

    def test_source_change_makes_new_thumb(self, image_path, image_url):
        import os
        from ComfyTV.runners.thumbs import resolve_thumb
        first = resolve_thumb(image_url, 512)
        st = image_path.stat()
        os.utime(image_path, ns=(st.st_atime_ns, st.st_mtime_ns + 1_000_000))
        second = resolve_thumb(image_url, 512)
        assert second != first


@pytest.fixture()
async def client(reset_db):
    from ComfyTV import api  # noqa: F401 — registers routes on the stub

    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)

    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


class TestThumbRoute:
    async def test_serves_webp_thumb(self, client, image_url):
        resp = await client.get('/comfytv/thumb',
                                params={'url': image_url, 'max': '256'})
        assert resp.status == 200
        assert resp.headers['Content-Type'] == 'image/webp'
        assert 'max-age' in resp.headers.get('Cache-Control', '')

    async def test_missing_url_is_400(self, client):
        resp = await client.get('/comfytv/thumb')
        assert resp.status == 400

    async def test_bad_max_is_400(self, client, image_url):
        resp = await client.get('/comfytv/thumb',
                                params={'url': image_url, 'max': 'huge'})
        assert resp.status == 400

    async def test_missing_file_is_404(self, client):
        resp = await client.get(
            '/comfytv/thumb',
            params={'url': '/view?filename=nope.png&type=output'})
        assert resp.status == 404

    async def test_escaping_url_is_403(self, client):
        resp = await client.get(
            '/comfytv/thumb',
            params={'url': '/view?filename=../../secrets.png&type=output'})
        assert resp.status in (403, 404)
