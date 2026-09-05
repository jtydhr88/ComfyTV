from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
from PIL import Image


@pytest.fixture()
def media_dir(reset_db):
    import folder_paths
    d = Path(folder_paths.get_output_directory()) / 'media-info'
    d.mkdir(parents=True, exist_ok=True)
    return d


@pytest.fixture()
def image_path(media_dir):
    p = media_dir / 'still.png'
    Image.new('RGB', (640, 360), (10, 20, 30)).save(p)
    return p


@pytest.fixture()
def video_path(media_dir):
    import av
    import numpy as np
    p = media_dir / 'clip.mp4'
    with av.open(str(p), 'w') as out:
        stream = out.add_stream('libx264', rate=8)
        stream.width, stream.height = 320, 240
        stream.pix_fmt = 'yuv420p'
        rgb = np.zeros((240, 320, 3), dtype=np.uint8)
        for _ in range(8):
            out.mux(stream.encode(av.VideoFrame.from_ndarray(rgb, format='rgb24')))
        out.mux(stream.encode(None))
    return p


@pytest.fixture()
def audio_path(media_dir):
    import av
    import numpy as np
    p = media_dir / 'tone.wav'
    with av.open(str(p), 'w') as out:
        stream = out.add_stream('pcm_s16le', rate=16000)
        stream.layout = 'mono'
        samples = np.zeros((1, 16000), dtype=np.int16)
        frame = av.AudioFrame.from_ndarray(samples, format='s16', layout='mono')
        frame.sample_rate = 16000
        out.mux(stream.encode(frame))
        out.mux(stream.encode(None))
    return p


def _url(p):
    from ComfyTV.runners import media
    return media.path_to_view_url(p)


class TestProbeMedia:
    def test_image(self, image_path):
        from ComfyTV.runners.media_info import probe_media
        info = probe_media(_url(image_path))
        assert info['kind'] == 'image'
        assert info['format'] == 'PNG'
        assert (info['width'], info['height']) == (640, 360)
        assert info['size_bytes'] == image_path.stat().st_size

    def test_video(self, video_path):
        from ComfyTV.runners.media_info import probe_media
        info = probe_media(_url(video_path))
        assert info['kind'] == 'video'
        assert info['format'] == 'MP4'
        assert (info['width'], info['height']) == (320, 240)
        assert info['fps'] == pytest.approx(8.0, abs=0.01)
        assert info['duration_s'] == pytest.approx(1.0, abs=0.2)
        assert info['has_audio'] is False
        assert info['codec'] == 'h264'

    def test_audio(self, audio_path):
        from ComfyTV.runners.media_info import probe_media
        info = probe_media(_url(audio_path))
        assert info['kind'] == 'audio'
        assert info['format'] == 'WAV'
        assert info['sample_rate'] == 16000
        assert info['channels'] == 1
        assert info['duration_s'] == pytest.approx(1.0, abs=0.05)

    def test_model_by_extension(self, media_dir):
        from ComfyTV.runners.media_info import probe_media
        p = media_dir / 'thing.glb'
        p.write_bytes(b'glTF' + b'\0' * 12)
        info = probe_media(_url(p))
        assert info == {'kind': 'model', 'format': 'GLB', 'size_bytes': 16}

    def test_cache_invalidates_on_rewrite(self, image_path):
        import os
        from ComfyTV.runners.media_info import probe_media
        url = _url(image_path)
        first = probe_media(url)
        Image.new('RGB', (64, 64)).save(image_path)
        os.utime(image_path, ns=(1, image_path.stat().st_mtime_ns + 10_000_000))
        second = probe_media(url)
        assert first['width'] == 640
        assert second['width'] == 64


@pytest.fixture()
async def client(reset_db):
    from ComfyTV import api  # noqa: F401
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    c = TestClient(TestServer(app))
    await c.start_server()
    yield c
    await c.close()


class TestEndpoint:
    async def test_requires_url(self, client):
        r = await client.get('/comfytv/media/info')
        assert r.status == 400

    async def test_missing_file_is_404(self, client):
        r = await client.get('/comfytv/media/info', params={'url': '/view?filename=nope.png&type=output'})
        assert r.status == 404

    async def test_remote_url_is_404_without_download(self, client, monkeypatch):
        import urllib.request
        monkeypatch.setattr(urllib.request, 'urlretrieve',
                            lambda *a, **k: pytest.fail('remote url must not be downloaded'))
        r = await client.get('/comfytv/media/info', params={'url': 'https://example.com/clip.mp4'})
        assert r.status == 404

    async def test_escaping_path_is_403(self, client):
        r = await client.get('/comfytv/media/info', params={'url': '/view?filename=../../x.png&type=output'})
        assert r.status == 403

    async def test_returns_probe(self, client, image_path):
        r = await client.get('/comfytv/media/info', params={'url': _url(image_path)})
        assert r.status == 200
        body = await r.json()
        assert body['kind'] == 'image'
        assert body['width'] == 640
