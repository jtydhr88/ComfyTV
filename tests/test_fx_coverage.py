"""Branch coverage for the FX stages and the LUT endpoints — exercises the
method/effect variants and error paths the smoke tests don't reach."""
from fractions import Fraction
from pathlib import Path

import pytest
from aiohttp import web, FormData
from aiohttp.test_utils import TestClient, TestServer

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from test_media_concat import _write_clip  # noqa: E402


@pytest.fixture()
def clip():
    import folder_paths
    from ComfyTV.runners import media
    d = Path(folder_paths.get_output_directory()) / 'cov-src'
    d.mkdir(parents=True, exist_ok=True)
    p = d / 'clip.mp4'
    if not p.exists():
        _write_clip(p, w=96, h=96, fps=12, seconds=0.6, with_audio=True)
    return media.path_to_view_url(p)


@pytest.fixture()
def cut_clip():
    import folder_paths
    from ComfyTV.runners import media
    d = Path(folder_paths.get_output_directory()) / 'cov-src'
    d.mkdir(parents=True, exist_ok=True)
    p = d / 'cuts.mp4'
    if not p.exists():
        with av.open(str(p), 'w') as out:
            v = out.add_stream('libx264', rate=12)
            v.width, v.height = 96, 96
            v.pix_fmt = 'yuv420p'
            rng = np.random.default_rng(3)
            a = rng.integers(0, 60, (96, 96, 3), dtype=np.uint8)
            b = rng.integers(180, 255, (96, 96, 3), dtype=np.uint8)
            for i in range(24):
                arr = a if i < 12 else b
                f = av.VideoFrame.from_ndarray(arr, format='rgb24').reformat(format='yuv420p')
                f.pts = i
                f.time_base = Fraction(1, 12)
                for pkt in v.encode(f):
                    out.mux(pkt)
            for pkt in v.encode():
                out.mux(pkt)
    return media.path_to_view_url(p)


def _vfx(name):
    from ComfyTV.nodes.stages import video_fx
    return getattr(video_fx, name)


def _afx(name):
    from ComfyTV.nodes.stages import audio_fx
    return getattr(audio_fx, name)


class TestColorBranches:
    def test_temperature_only(self, clip):
        _vfx('VideoColorStage').execute(project_id='p1', temperature=8000, video=clip)

    def test_no_video(self):
        with pytest.raises(RuntimeError, match="upstream video"):
            _vfx('VideoColorStage').execute(project_id='p1', exposure=1.0)


class TestCurvesBranches:
    def test_bad_points_json_rejected(self, clip):
        with pytest.raises(RuntimeError, match="no curve"):
            _vfx('VideoCurvesStage').execute(project_id='p1',
                                             master_pts='not json', video=clip)

    def test_single_point_ignored(self, clip):
        with pytest.raises(RuntimeError, match="no curve"):
            _vfx('VideoCurvesStage').execute(project_id='p1',
                                             master_pts='[[0.5,0.5]]', video=clip)


class TestLUTBranches:
    def test_no_file(self, clip):
        with pytest.raises(RuntimeError, match="pick or upload"):
            _vfx('VideoLUTStage').execute(project_id='p1', video=clip)

    def test_missing_file(self, clip):
        with pytest.raises(RuntimeError, match="not found"):
            _vfx('VideoLUTStage').execute(project_id='p1',
                                          lut_file='nope.cube', video=clip)

    def test_identity_cube(self, clip):
        import folder_paths
        d = Path(folder_paths.get_input_directory()) / 'comfytv-luts'
        d.mkdir(parents=True, exist_ok=True)
        cube = d / 'identity.cube'
        if not cube.exists():
            lines = ['LUT_3D_SIZE 2']
            for b in (0.0, 1.0):
                for g in (0.0, 1.0):
                    for r in (0.0, 1.0):
                        lines.append(f'{r:.1f} {g:.1f} {b:.1f}')
            cube.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        _vfx('VideoLUTStage').execute(project_id='p1',
                                      lut_file='identity.cube', video=clip)


class TestBlurBranches:
    def test_box(self, clip):
        _vfx('VideoBlurSharpenStage').execute(project_id='p1', mode='box',
                                              amount=3, video=clip)

    def test_bilateral(self, clip):
        _vfx('VideoBlurSharpenStage').execute(project_id='p1', mode='bilateral',
                                              amount=2, edge_preserve=0.2, video=clip)

    def test_zero_amount_rejected(self, clip):
        with pytest.raises(RuntimeError, match="amount"):
            _vfx('VideoBlurSharpenStage').execute(project_id='p1',
                                                  mode='gaussian', amount=0, video=clip)

    def test_unknown_mode(self, clip):
        with pytest.raises(RuntimeError, match="unknown mode"):
            _vfx('VideoBlurSharpenStage').execute(project_id='p1',
                                                  mode='motion', video=clip)


class TestDenoiseBranches:
    @pytest.mark.parametrize("method", ['nlmeans', 'fftdnoiz', 'deband', 'gradfun'])
    def test_methods(self, clip, method):
        _vfx('VideoDenoiseStage').execute(project_id='p1', method=method,
                                          strength=0.3, video=clip)

    def test_unknown(self, clip):
        with pytest.raises(RuntimeError, match="unknown method"):
            _vfx('VideoDenoiseStage').execute(project_id='p1', method='wavelet',
                                              strength=0.3, video=clip)

    def test_zero_strength(self, clip):
        with pytest.raises(RuntimeError, match="strength"):
            _vfx('VideoDenoiseStage').execute(project_id='p1', strength=0, video=clip)


class TestChromaKeyBranches:
    def test_alpha_webm(self, clip):
        from ComfyTV.runners.media_filter import has_encoder
        if not has_encoder('libvpx-vp9'):
            pytest.skip("no libvpx-vp9 encoder in this build")
        out = _vfx('VideoChromaKeyStage').execute(
            project_id='p1', key_color='#00FF00', output='alpha', video=clip)
        assert out is not None

    def test_bad_color(self, clip):
        with pytest.raises(RuntimeError, match="bad color"):
            _vfx('VideoChromaKeyStage').execute(project_id='p1',
                                                key_color='#XY', video=clip)


class TestTransitionBranches:
    def test_missing_inputs(self, clip):
        with pytest.raises(RuntimeError, match="two upstream videos"):
            _vfx('VideoTransitionStage').execute(project_id='p1', video_a=clip)


class TestSceneDetectExecute:
    def test_finds_cut(self, cut_clip):
        _vfx('SceneDetectStage').execute(project_id='p1', threshold=0.3,
                                         min_gap_s=0.5, video=cut_clip)

    def test_no_cuts_rejected(self, clip):
        with pytest.raises(RuntimeError, match="no cuts"):
            _vfx('SceneDetectStage').execute(project_id='p1', threshold=1.0,
                                             video=clip)


class TestInterpolateExecute:
    def test_retime(self, clip):
        _vfx('VideoInterpolateStage').execute(project_id='p1', mode='retime_fps',
                                              target_fps=24, mi_mode='blend',
                                              video=clip)

    def test_slowmo(self, clip):
        _vfx('VideoInterpolateStage').execute(project_id='p1', mode='slowmo',
                                              slow_factor=2.0, mi_mode='blend',
                                              video=clip)


class TestDeinterlaceBranches:
    def test_w3fdif(self, clip):
        _vfx('VideoDeinterlaceStage').execute(project_id='p1', method='w3fdif',
                                              video=clip)

    def test_unknown(self, clip):
        with pytest.raises(RuntimeError, match="unknown method"):
            _vfx('VideoDeinterlaceStage').execute(project_id='p1',
                                                  method='qtgmc', video=clip)


class TestStylizeBranches:
    @pytest.mark.parametrize("effect", ['grain', 'pixelize', 'edge',
                                        'sepia', 'monochrome'])
    def test_effects(self, clip, effect):
        _vfx('VideoStylizeStage').execute(project_id='p1', effect=effect,
                                          strength=0.5, block=4, video=clip)

    def test_unknown(self, clip):
        with pytest.raises(RuntimeError, match="unknown effect"):
            _vfx('VideoStylizeStage').execute(project_id='p1', effect='vhs',
                                              video=clip)


class TestScopesBranches:
    @pytest.mark.parametrize("scope", ['waveform_parade', 'histogram'])
    def test_scopes(self, clip, scope):
        _vfx('VideoScopesStage').execute(project_id='p1', scope=scope,
                                         at_seconds=0.2, video=clip)

    def test_unknown(self, clip):
        with pytest.raises(RuntimeError, match="unknown scope"):
            _vfx('VideoScopesStage').execute(project_id='p1', scope='rgbparade',
                                             video=clip)


class TestAudioDynamicsBranches:
    def test_gate(self, clip):
        _afx('AudioDynamicsStage').execute(project_id='p1', mode='gate',
                                           threshold_db=-40, ratio=2, video=clip)

    def test_deesser(self, clip):
        _afx('AudioDynamicsStage').execute(project_id='p1', mode='deesser',
                                           intensity=0.4, video=clip)

    def test_unknown(self, clip):
        with pytest.raises(RuntimeError, match="unknown mode"):
            _afx('AudioDynamicsStage').execute(project_id='p1', mode='expander',
                                               video=clip)

    def test_needs_source(self):
        with pytest.raises(RuntimeError, match="upstream audio or video"):
            _afx('AudioDynamicsStage').execute(project_id='p1')


class TestAudioEQBranches:
    def test_pass_and_shelf_bands(self, clip):
        _afx('AudioEQStage').execute(
            project_id='p1',
            bands='[{"type":"lowpass","f":8000},'
                  '{"type":"lowshelf","f":150,"g":3},'
                  '{"type":"highshelf","f":6000,"g":-2}]',
            video=clip)

    def test_bad_json(self, clip):
        with pytest.raises(RuntimeError, match="no active bands"):
            _afx('AudioEQStage').execute(project_id='p1', bands='oops', video=clip)

    def test_zero_gain_peak_skipped(self, clip):
        with pytest.raises(RuntimeError, match="no active bands"):
            _afx('AudioEQStage').execute(project_id='p1',
                                         bands='[{"type":"peak","f":1000,"g":0}]',
                                         video=clip)


class TestAudioLoudnessBranches:
    def test_dynamic(self, clip):
        _afx('AudioLoudnessStage').execute(project_id='p1', mode='dynamic',
                                           dyn_frame_ms=200, dyn_gauss=7,
                                           video=clip)


class TestAudioDenoiseBranches:
    def test_anlmdn(self, clip):
        _afx('AudioDenoiseStage').execute(project_id='p1', method='anlmdn',
                                          strength=0.3, video=clip)

    def test_silenceremove(self, clip):
        _afx('AudioDenoiseStage').execute(project_id='p1', method='silenceremove',
                                          silence_db=-60, min_silence_s=0.2,
                                          video=clip)

    def test_unknown(self, clip):
        with pytest.raises(RuntimeError, match="unknown method"):
            _afx('AudioDenoiseStage').execute(project_id='p1', method='rnnoise',
                                              video=clip)


@pytest.fixture()
async def client():
    from ComfyTV import api  # noqa: F401 — registers routes on the stub
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


class TestLutRoutes:
    async def test_list(self, client):
        resp = await client.get('/comfytv/luts')
        assert resp.status == 200
        data = await resp.json()
        assert isinstance(data['luts'], list)

    async def test_upload_and_list(self, client):
        fd = FormData()
        fd.add_field('file', b'LUT_3D_SIZE 2\n', filename='route_test.cube')
        resp = await client.post('/comfytv/luts', data=fd)
        assert resp.status == 200
        assert (await resp.json())['name'] == 'route_test.cube'
        resp = await client.get('/comfytv/luts')
        assert 'route_test.cube' in (await resp.json())['luts']

    async def test_upload_bad_extension(self, client):
        fd = FormData()
        fd.add_field('file', b'zzz', filename='evil.exe')
        resp = await client.post('/comfytv/luts', data=fd)
        assert resp.status == 400

    async def test_upload_wrong_field(self, client):
        fd = FormData()
        fd.add_field('other', b'zzz', filename='x.cube')
        resp = await client.post('/comfytv/luts', data=fd)
        assert resp.status == 400
