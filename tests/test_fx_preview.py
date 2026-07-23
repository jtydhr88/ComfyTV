"""API + window tests for the real-filter clip preview endpoint."""
from __future__ import annotations

from fractions import Fraction
from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from test_media_concat import _write_clip  # noqa: E402


def _write_noise_clip(path: Path, *, w=960, h=540, fps=24, seconds=3.0):
    rng = np.random.default_rng(42)
    base = rng.integers(60, 200, (h, w, 3), dtype=np.int16)
    with av.open(str(path), 'w') as out:
        v = out.add_stream('libx264', rate=fps)
        v.width, v.height = w, h
        v.pix_fmt = 'yuv420p'
        for i in range(int(round(seconds * fps))):
            noise = rng.integers(-45, 45, (h, w, 3), dtype=np.int16)
            arr = np.clip(base + noise, 0, 255).astype(np.uint8)
            f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
            f.pts = i
            f.time_base = Fraction(1, fps)
            for pkt in v.encode(f):
                out.mux(pkt)
        for pkt in v.encode():
            out.mux(pkt)


@pytest.fixture()
def noise_clip():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'fxprev-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'noise.mp4'
    if not p.exists():
        _write_noise_clip(p)
    return media.path_to_view_url(p)


@pytest.fixture()
def clip_av():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'fxprev-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'clip_av.mp4'
    if not p.exists():
        _write_clip(p, w=320, h=240, fps=24, seconds=2.0, with_audio=True)
    return media.path_to_view_url(p)


@pytest.fixture()
async def client(reset_db, monkeypatch):
    from ComfyTV import api  # noqa: F401 — registers routes on the stub PromptServer
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_client = TestClient(TestServer(app))
    await test_client.start_server()
    yield test_client
    await test_client.close()


async def _post(client, video, **over):
    body = {
        'node_id': 'ComfyTV.VideoDenoiseStage',
        'params': {'method': 'atadenoise', 'strength': 0.5},
        'video': video,
        't': 1.5,
    }
    body.update(over)
    return await client.post('/comfytv/fx_preview', json=body)


def _decode_frames(view_url):
    from ComfyTV.runners import media
    frames = []
    with av.open(str(media.localize(view_url))) as c:
        for frame in c.decode(c.streams.video[0]):
            frames.append(frame.reformat(format='rgb24').to_ndarray().astype(np.float64))
    return frames


class TestFxPreviewEndpoint:
    async def test_denoise_preview_decodable_windowed_downscaled(self, client, noise_clip):
        r = await _post(client, noise_clip)
        assert r.status == 200
        data = await r.json()
        assert data['url'].startswith('/view?')
        assert data['t1'] - data['t0'] == pytest.approx(1.2, abs=0.01)
        from ComfyTV.runners import media
        info = media.get_video_info(data['url'])
        assert info['duration'] <= 1.2 + 0.2
        assert info['duration'] >= 0.5
        assert info['width'] <= 640
        assert info['height'] <= 640
        assert info['has_audio'] is False

    async def test_window_clamped_low(self, client, noise_clip):
        r = await _post(client, noise_clip, window=0.05)
        assert r.status == 200
        data = await r.json()
        assert data['t1'] - data['t0'] == pytest.approx(0.4, abs=0.01)

    async def test_window_clamped_high(self, client, noise_clip):
        r = await _post(client, noise_clip, window=99)
        assert r.status == 200
        data = await r.json()
        assert data['t1'] - data['t0'] == pytest.approx(3.0, abs=0.1)
        from ComfyTV.runners import media
        assert media.get_video_info(data['url'])['duration'] <= 3.0 + 0.2

    async def test_torch_chain_node_preview(self, client, noise_clip):
        r = await _post(client, noise_clip, node_id='ComfyTV.CDLStage',
                        params={'slope_r': 0.3, 'slope_g': 0.3,
                                'slope_b': 0.3}, window=0.4)
        assert r.status == 200, (await r.json())
        data = await r.json()
        assert data['url'].startswith('/view?')
        f_low = _decode_frames(data['url'])
        assert f_low and float(np.mean(f_low[0])) < 100

    async def test_unknown_node_404(self, client, noise_clip):
        r = await _post(client, noise_clip, node_id='ComfyTV.NopeStage')
        assert r.status == 404

    async def test_non_eligible_node_400(self, client, noise_clip):
        for node_id in ('ComfyTV.VideoTransitionStage', 'ComfyTV.FXChainStage'):
            r = await _post(client, noise_clip, node_id=node_id)
            assert r.status == 400
            assert 'does not support clip preview' in (await r.json())['error']

    async def test_missing_fields_400(self, client, noise_clip):
        r = await _post(client, '')
        assert r.status == 400
        r = await _post(client, noise_clip, node_id='')
        assert r.status == 400
        r = await _post(client, noise_clip, params='nope')
        assert r.status == 400

    async def test_bad_params_rejected_400(self, client, noise_clip):
        r = await _post(client, noise_clip,
                        params={'method': 'atadenoise', 'strength': 0})
        assert r.status == 400

    async def test_params_actually_applied(self, client, noise_clip):
        low = await _post(client, noise_clip,
                          params={'method': 'atadenoise', 'strength': 0.05},
                          window=0.4)
        high = await _post(client, noise_clip,
                           params={'method': 'atadenoise', 'strength': 0.95},
                           window=0.4)
        assert low.status == 200 and high.status == 200
        f_low = _decode_frames((await low.json())['url'])
        f_high = _decode_frames((await high.json())['url'])
        assert f_low and f_high
        n = min(len(f_low), len(f_high))
        diff = np.mean([np.abs(f_low[i] - f_high[i]).mean() for i in range(n)])
        assert diff > 1.0


class TestColorspaceFilter:
    def test_scale_then_colorspace_renders(self, clip_av):
        from ComfyTV.runners import media, media_filter as mf
        out = mf.filter_video(
            clip_av,
            [('scale', "w='min(640,iw)':h='min(640,ih)':"
                       "force_original_aspect_ratio=decrease:"
                       "force_divisible_by=2"),
             ('colorspace', 'all=bt2020:format=yuv420p')],
            start=0.0, end=0.8, keep_audio=False)
        assert media.get_video_info(out)['duration'] > 0.3

    def test_patch_respects_explicit_input_space(self):
        from ComfyTV.runners.media_filter import _patch_colorspace_specs
        specs = [('colorspace', 'iall=bt601-6-625:all=bt709')]
        assert _patch_colorspace_specs(specs, None) == specs
        patched = _patch_colorspace_specs(
            [('colorspace', 'all=bt2020')], None)
        assert patched == [('colorspace', 'iall=bt709:all=bt2020')]


class TestFilterVideoWindow:
    def test_window_trims_and_rebases(self, clip_av):
        from ComfyTV.runners import media, media_filter as mf
        out = mf.filter_video(clip_av, [('gblur', 'sigma=1')],
                              start=0.5, end=1.5, keep_audio=False)
        info = media.get_video_info(out)
        assert 0.8 <= info['duration'] <= 1.25
        with av.open(str(media.localize(out))) as c:
            in_v = c.streams.video[0]
            first = next(c.decode(in_v))
            assert float(first.pts * in_v.time_base) < 0.1

    def test_window_only_uses_null_filter(self, clip_av):
        from ComfyTV.runners import media, media_filter as mf
        out = mf.filter_video(clip_av, start=0.0, end=0.5)
        info = media.get_video_info(out)
        assert 0.3 <= info['duration'] <= 0.75

    def test_window_drops_audio_passthrough(self, clip_av):
        from ComfyTV.runners import media, media_filter as mf
        out = mf.filter_video(clip_av, [('gblur', 'sigma=1')],
                              start=0.2, end=1.0, keep_audio=True)
        assert media.get_video_info(out)['has_audio'] is False

    def test_window_keeps_filtered_audio(self, clip_av):
        from ComfyTV.runners import media, media_filter as mf
        out = mf.filter_video(clip_av, [('scale', '160:120')],
                              audio_specs=[('volume', '0.5')],
                              start=0.5, end=1.5, keep_audio=True)
        info = media.get_video_info(out)
        assert info['has_audio'] is True
        assert 0.8 <= info['duration'] <= 1.3

    def test_bad_window_rejected(self, clip_av):
        from ComfyTV.runners import media_filter as mf
        with pytest.raises(RuntimeError, match="bad window"):
            mf.filter_video(clip_av, [('gblur', 'sigma=1')], start=1.0, end=0.5)

    def test_no_window_behavior_unchanged(self, clip_av):
        from ComfyTV.runners import media, media_filter as mf
        out = mf.filter_video(clip_av, [('gblur', 'sigma=1')])
        info = media.get_video_info(out)
        assert 1.7 <= info['duration'] <= 2.4
        assert info['has_audio'] is True
