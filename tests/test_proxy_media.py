"""Proxy media service + endpoint tests."""
from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

av = pytest.importorskip("av")

from test_media_concat import _write_clip  # noqa: E402


@pytest.fixture()
def clip_path(reset_db):
    import folder_paths
    from ComfyTV.runners import proxy
    proxy._original.clear()
    src_dir = Path(folder_paths.get_output_directory()) / 'proxy-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'proxy_clip.mp4'
    if not p.exists():
        _write_clip(p, w=640, h=360, fps=24, seconds=1.0, with_audio=True)
    return p


@pytest.fixture()
def clip_url(clip_path):
    from ComfyTV.runners import media
    return media.path_to_view_url(clip_path)


@pytest.fixture()
def force_proxy(monkeypatch):
    from ComfyTV.runners import proxy
    monkeypatch.setattr(proxy, 'PROXY_TRIGGER_BYTES', 1)
    monkeypatch.setattr(proxy, 'PROXY_MAX_EDGE', 320)


class TestThreshold:
    def test_small_clip_is_original(self, clip_url):
        from ComfyTV.runners.proxy import ensure_proxy
        assert ensure_proxy(clip_url)['status'] == 'original'

    def test_original_decision_is_cached(self, clip_url):
        from ComfyTV.runners import proxy
        proxy.ensure_proxy(clip_url)
        assert len(proxy._original) == 1
        assert proxy.ensure_proxy(clip_url)['status'] == 'original'

    def test_missing_or_external_sources_are_original(self, reset_db):
        from ComfyTV.runners.proxy import ensure_proxy
        assert ensure_proxy('/view?filename=nope.mp4&type=output')['status'] \
            == 'original'
        assert ensure_proxy('https://example.com/a.mp4')['status'] == 'original'

    def test_dims(self):
        from ComfyTV.runners.proxy import proxy_dims
        assert proxy_dims(3840, 2160) == (1280, 720)
        assert proxy_dims(2160, 3840) == (720, 1280)
        assert proxy_dims(640, 360) == (640, 360)
        assert proxy_dims(1921, 1080) == (1280, 718)


class TestLifecycle:
    def test_query_only_reports_candidate(self, clip_url, force_proxy):
        from ComfyTV.runners.proxy import ensure_proxy
        assert ensure_proxy(clip_url)['status'] == 'candidate'
        assert ensure_proxy(clip_url)['status'] == 'candidate'

    def test_create_marks_pending_then_build_makes_ready(self, clip_url,
                                                         force_proxy):
        from ComfyTV.runners.proxy import build_proxy, ensure_proxy
        assert ensure_proxy(clip_url, create=True)['status'] == 'pending'
        assert ensure_proxy(clip_url)['status'] == 'pending'

        proxy_url = build_proxy(clip_url)
        ready = ensure_proxy(clip_url)
        assert ready['status'] == 'ready'
        assert ready['proxy_url'] == proxy_url
        assert ready['width'] == 320
        assert ready['height'] == 180
        from ComfyTV.runners.media import localize
        proxy_file = localize(proxy_url)
        with av.open(str(proxy_file)) as c:
            assert c.streams.video[0].width == 320
            assert bool(c.streams.audio)

    def test_build_without_marker_also_works(self, clip_url, force_proxy):
        from ComfyTV.runners.proxy import build_proxy, ensure_proxy
        build_proxy(clip_url)
        assert ensure_proxy(clip_url)['status'] == 'ready'

    def test_repeat_build_reuses_ready_proxy(self, clip_url, force_proxy):
        from ComfyTV.runners.proxy import build_proxy
        first = build_proxy(clip_url)
        assert build_proxy(clip_url) == first

    def test_source_change_invalidates(self, clip_path, clip_url, force_proxy):
        import os
        from ComfyTV.runners.proxy import build_proxy, ensure_proxy
        build_proxy(clip_url)
        assert ensure_proxy(clip_url)['status'] == 'ready'

        st = clip_path.stat()
        os.utime(clip_path, ns=(st.st_atime_ns, st.st_mtime_ns + 10 ** 9))
        assert ensure_proxy(clip_url)['status'] == 'candidate'
        build_proxy(clip_url)
        assert ensure_proxy(clip_url)['status'] == 'ready'

    def test_deleted_proxy_file_regenerates(self, clip_url, force_proxy):
        from ComfyTV.runners.media import localize
        from ComfyTV.runners.proxy import build_proxy, ensure_proxy
        localize(build_proxy(clip_url)).unlink()
        assert ensure_proxy(clip_url)['status'] == 'candidate'
        build_proxy(clip_url)
        assert ensure_proxy(clip_url)['status'] == 'ready'

    def test_failed_needs_retry_flag(self, clip_url, force_proxy):
        from ComfyTV import storage
        from ComfyTV.runners.proxy import build_proxy, ensure_proxy
        from ComfyTV.runners.proxy import PROXY_PROFILE
        from ComfyTV.runners.media import view_url_to_path

        ensure_proxy(clip_url, create=True)
        row = storage.get_proxy(str(view_url_to_path(clip_url)), PROXY_PROFILE)
        storage.set_proxy_status(row['id'], 'failed', error='boom')

        failed = ensure_proxy(clip_url)
        assert failed['status'] == 'failed'
        assert failed['error'] == 'boom'
        assert ensure_proxy(clip_url, create=True)['status'] == 'failed'
        assert ensure_proxy(clip_url, create=True,
                            retry=True)['status'] == 'pending'
        build_proxy(clip_url)
        assert ensure_proxy(clip_url)['status'] == 'ready'

    def test_build_missing_source_raises_and_marks_failed(self, reset_db):
        from ComfyTV.runners.proxy import build_proxy
        with pytest.raises(RuntimeError, match='not found'):
            build_proxy('/view?filename=nope.mp4&type=output')


class TestMakeProxyNode:
    def test_node_builds_proxy(self, clip_url, force_proxy):
        from ComfyTV.nodes.stages.video_edit import MakeProxyStage
        from ComfyTV.runners.proxy import ensure_proxy
        out = MakeProxyStage.execute(video=clip_url)
        url = out.values[0] if hasattr(out, 'values') else out.args[0]
        assert url.startswith('/view?')
        assert ensure_proxy(clip_url)['status'] == 'ready'

    def test_node_rejects_empty_input(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import MakeProxyStage
        with pytest.raises(RuntimeError, match='source video'):
            MakeProxyStage.execute(video='')


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
    async def test_requires_url(self, client):
        res = await client.post('/comfytv/proxy/ensure', json={})
        assert res.status == 400

    async def test_small_clip_reports_original(self, client, clip_url):
        res = await client.post('/comfytv/proxy/ensure',
                                json={'url': clip_url})
        assert res.status == 200
        assert (await res.json())['status'] == 'original'

    async def test_full_flow(self, client, clip_url, force_proxy):
        res = await client.post('/comfytv/proxy/ensure',
                                json={'url': clip_url})
        assert (await res.json())['status'] == 'candidate'
        res = await client.post('/comfytv/proxy/ensure',
                                json={'url': clip_url, 'create': True})
        assert (await res.json())['status'] == 'pending'

        from ComfyTV.runners.proxy import build_proxy
        build_proxy(clip_url)
        res = await client.post('/comfytv/proxy/ensure',
                                json={'url': clip_url})
        data = await res.json()
        assert data['status'] == 'ready'
        assert data['proxy_url'].startswith('/view?')
