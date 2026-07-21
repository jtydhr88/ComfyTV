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
    from ComfyTV.nodes import stages
    return getattr(stages, name)


def _afx(name):
    from ComfyTV.nodes import stages
    return getattr(stages, name)


class TestColorBranches:
    def test_temperature_only(self, clip):
        _vfx('VideoColorStage').execute(project_id='p1', temperature=8000, video=clip)

    def test_no_video_rejected(self):
        with pytest.raises(RuntimeError, match="upstream video"):
            _vfx('VideoColorStage').execute(project_id='p1', exposure=1.0)


class TestCurvesBranches:
    def test_bad_points_json_is_identity(self, clip):
        out = _vfx('VideoCurvesStage').execute(project_id='p1',
                                               master_pts='not json',
                                               video=clip)
        assert out.values[0] == clip

    def test_single_point_is_identity(self, clip):
        out = _vfx('VideoCurvesStage').execute(project_id='p1',
                                               master_pts='[[0.5,0.5]]',
                                               video=clip)
        assert out.values[0] == clip

    def test_points_collapsing_to_one_is_identity(self, clip):
        out = _vfx('VideoCurvesStage').execute(project_id='p1',
                                               master_pts='[[1.2,0.3],[1.5,0.9]]',
                                               video=clip)
        assert out.values[0] == clip


class TestLUTBranches:
    def test_no_file_is_identity(self, clip):
        out = _vfx('VideoLUTStage').execute(project_id='p1', video=clip)
        assert out.values[0] == clip

    def test_missing_file(self, clip):
        with pytest.raises(RuntimeError, match="not found"):
            _vfx('VideoLUTStage').execute(project_id='p1',
                                          lut_file='nope.cube', video=clip)

    def test_identity_cube(self, clip):
        import folder_paths
        d = Path(folder_paths.get_input_directory()) / 'comfytv/luts'
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

    def test_adopted_lut_in_legacy_dir_resolves(self, clip):
        import folder_paths
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common import unpack_fx_video
        d = Path(folder_paths.get_input_directory()) / 'comfytv-luts'
        d.mkdir(parents=True, exist_ok=True)
        cube = d / 'legacy.cube'
        lines = ['LUT_3D_SIZE 2']
        for b in (0.0, 1.0):
            for g in (0.0, 1.0):
                for r in (0.0, 1.0):
                    lines.append(f'{r:.1f} {g:.1f} {b:.1f}')
        cube.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        storage.register_resource('lut', 'legacy.cube', 'comfytv-luts',
                                  size=cube.stat().st_size, sha256='t')
        out = _vfx('VideoLUTStage').execute(project_id='p1',
                                            lut_file='legacy.cube', video=clip)
        _url, entries = unpack_fx_video(out.values[0])
        assert 'comfytv-luts' in entries[-1]['specs'][0][1]


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

    def test_non_hex_color(self, clip):
        with pytest.raises(RuntimeError, match="bad color"):
            _vfx('VideoChromaKeyStage').execute(project_id='p1',
                                                key_color='#GGHHII', video=clip)


class TestAnnotateBranches:
    def test_fillborders_oversized_clamped(self, clip):
        from ComfyTV.nodes.stages import video_masking
        video_masking.AnnotateStage.execute(project_id='p1', mode='fillborders',
                                       border_px=512, video=clip)

    def test_box_bad_color_falls_back(self, clip):
        from ComfyTV.nodes.stages import video_masking
        video_masking.AnnotateStage.execute(project_id='p1', mode='box',
                                       color='not-a-color', video=clip)


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

    def test_frames_payload_shape(self, cut_clip):
        import json
        out = _vfx('SceneDetectStage').execute(project_id='p1', threshold=0.3,
                                               min_gap_s=0.5, video=cut_clip)
        assert len(out.values) == 1
        data = json.loads(out.values[0])
        assert set(data) == {'images', 'cuts'}
        assert len(data['images']) == len(data['cuts']) + 1

    def test_clips_mode_matches_picker_contract(self, cut_clip):
        import json
        from ComfyTV.runners import media
        out = _vfx('SceneDetectStage').execute(project_id='p1', threshold=0.3,
                                               min_gap_s=0.5, output='clips',
                                               video=cut_clip)
        assert len(out.values) == 2
        data = json.loads(out.values[0])
        clips = data['clips']
        assert len(clips) == len(data['cuts']) + 1
        assert clips[0]['start'] == 0.0
        for i, c in enumerate(clips):
            assert c['index'] == i + 1
            assert c['image_url'].startswith('/view?')
            assert c['end'] > c['start']
            assert c['label'] == f"{i + 1} · {c['start']:.2f}–{c['end']:.2f}s"
            assert media.get_video_info(c['image_url'])['duration'] > 0
        assert out.values[1] == clips[0]['image_url']
        assert out.ui['picked'] == [clips[0]['image_url']]
        assert out.ui['picked_index'] == [1]

    def test_selected_index_picks_clip(self, cut_clip):
        import json
        out = _vfx('SceneDetectStage').execute(project_id='p1', threshold=0.3,
                                               min_gap_s=0.5, output='clips',
                                               selected_index=2, video=cut_clip)
        clips = json.loads(out.values[0])['clips']
        assert len(clips) >= 2
        assert out.values[1] == clips[1]['image_url']
        assert out.ui['picked_index'] == [2]

    def test_selected_index_clamps_to_last(self, cut_clip):
        import json
        out = _vfx('SceneDetectStage').execute(project_id='p1', threshold=0.3,
                                               min_gap_s=0.5, output='clips',
                                               selected_index=99, video=cut_clip)
        clips = json.loads(out.values[0])['clips']
        assert out.values[1] == clips[-1]['image_url']
        assert out.ui['picked_index'] == [len(clips)]
        low = _vfx('SceneDetectStage').execute(project_id='p1', threshold=0.3,
                                               min_gap_s=0.5, output='clips',
                                               selected_index=0, video=cut_clip)
        assert low.ui['picked_index'] == [1]

    def test_reselect_hits_cache(self, cut_clip, monkeypatch):
        from ComfyTV.nodes.stages import video_analysis
        monkeypatch.setattr(video_analysis, '_SCENE_CACHE', {})
        calls = {'scan': 0, 'trim': 0}
        real_scan = video_analysis.scene_detect
        real_trim = video_analysis.trim_video

        def scan(*a, **k):
            calls['scan'] += 1
            return real_scan(*a, **k)

        def trim(*a, **k):
            calls['trim'] += 1
            return real_trim(*a, **k)

        monkeypatch.setattr(video_analysis, 'scene_detect', scan)
        monkeypatch.setattr(video_analysis, 'trim_video', trim)
        first = video_analysis.SceneDetectStage.execute(
            project_id='p1', threshold=0.3, min_gap_s=0.5, output='clips',
            selected_index=1, video=cut_clip)
        after_first = dict(calls)
        assert after_first['scan'] == 1
        assert after_first['trim'] >= 1
        second = video_analysis.SceneDetectStage.execute(
            project_id='p1', threshold=0.3, min_gap_s=0.5, output='clips',
            selected_index=2, video=cut_clip)
        assert calls == after_first
        assert second.values[0] == first.values[0]
        assert second.values[1] != first.values[1]

    def test_cache_recomputes_when_clip_file_missing(self, cut_clip, monkeypatch):
        import json
        from ComfyTV.nodes.stages import video_analysis
        from ComfyTV.runners import media
        monkeypatch.setattr(video_analysis, '_SCENE_CACHE', {})
        calls = {'scan': 0}
        real_scan = video_analysis.scene_detect

        def scan(*a, **k):
            calls['scan'] += 1
            return real_scan(*a, **k)

        monkeypatch.setattr(video_analysis, 'scene_detect', scan)
        out = video_analysis.SceneDetectStage.execute(
            project_id='p1', threshold=0.3, min_gap_s=0.5, output='clips',
            video=cut_clip)
        clips = json.loads(out.values[0])['clips']
        media.view_url_to_path(clips[0]['image_url']).unlink()
        video_analysis.SceneDetectStage.execute(
            project_id='p1', threshold=0.3, min_gap_s=0.5, output='clips',
            video=cut_clip)
        assert calls['scan'] == 2

    def test_precise_mode_frame_accurate(self, cut_clip, monkeypatch):
        import json
        from ComfyTV.nodes.stages import video_analysis
        from ComfyTV.runners import media
        monkeypatch.setattr(video_analysis, '_SCENE_CACHE', {})
        out = video_analysis.SceneDetectStage.execute(
            project_id='p1', threshold=0.3, min_gap_s=0.5, output='clips',
            cut_mode='precise', video=cut_clip)
        clips = json.loads(out.values[0])['clips']
        assert len(clips) == 2
        frame_s = 1.0 / 12.0
        for c in clips:
            info = media.get_video_info(c['image_url'])
            expected = c['end'] - c['start']
            assert abs(info['duration'] - expected) <= frame_s + 1e-6
        means = []
        for c in clips:
            src = media.view_url_to_path(c['image_url'])
            with av.open(str(src)) as inp:
                frame = next(inp.decode(inp.streams.video[0]))
                means.append(float(frame.to_ndarray(format='rgb24').mean()))
        assert means[0] < 100
        assert means[1] > 150

    def test_clips_mode_no_cuts_rejected(self, clip):
        with pytest.raises(RuntimeError, match="no cuts"):
            _vfx('SceneDetectStage').execute(project_id='p1', threshold=1.0,
                                             output='clips', video=clip)


class TestTrimVideoPrecise:
    def test_duration_and_audio(self, clip):
        from ComfyTV.runners import media
        url = media.trim_video_precise(clip, 0.1, 0.5)
        info = media.get_video_info(url)
        assert abs(info['duration'] - 0.4) <= (1.0 / 12.0) + 1e-6
        assert info['has_audio']

    def test_bad_range_rejected(self, clip):
        from ComfyTV.runners import media
        with pytest.raises(RuntimeError, match="must be >"):
            media.trim_video_precise(clip, 1.0, 1.0)


class TestSceneSegments:
    def test_bounds_and_end(self):
        from ComfyTV.nodes.stages.video_analysis import _scene_segments
        assert _scene_segments([1.0, 2.5], 4.0) == \
            [(0.0, 1.0), (1.0, 2.5), (2.5, 4.0)]

    def test_end_extends_past_last_cut(self):
        from ComfyTV.nodes.stages.video_analysis import _scene_segments
        segs = _scene_segments([1.0], 0.0)
        assert len(segs) == 2
        assert segs[0] == (0.0, 1.0)
        assert segs[1][1] == pytest.approx(1.05)

    def test_capped_at_48(self):
        from ComfyTV.nodes.stages.video_analysis import _scene_segments
        segs = _scene_segments([float(i) for i in range(1, 60)], 120.0)
        assert len(segs) == 48
        assert segs[0] == (0.0, 1.0)
        assert segs[-1] == (47.0, 48.0)

    def test_degenerate_segment_dropped(self):
        from ComfyTV.nodes.stages.video_analysis import _scene_segments
        segs = _scene_segments([1.0, 1.0005], 2.0)
        assert segs == [(0.0, 1.0), (1.0005, 2.0)]


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

    def test_no_source_emits_spec_only(self):
        import json
        out = _afx('AudioDynamicsStage').execute(project_id='p1')
        assert out.values[0] == ""
        assert json.loads(out.values[1])['domain'] == 'audio'


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

    async def test_serve_lut_file_by_name(self, client):
        fd = FormData()
        fd.add_field('file', b'LUT_3D_SIZE 2\n', filename='serve_test.cube')
        resp = await client.post('/comfytv/luts', data=fd)
        assert resp.status == 200
        resp = await client.get('/comfytv/luts/serve_test.cube')
        assert resp.status == 200
        assert (await resp.read()).startswith(b'LUT_3D_SIZE')

    async def test_serve_lut_from_legacy_subfolder(self, client):
        import folder_paths
        from ComfyTV import storage
        d = Path(folder_paths.get_input_directory()) / 'comfytv-luts'
        d.mkdir(parents=True, exist_ok=True)
        (d / 'route_legacy.cube').write_text('LUT_3D_SIZE 2\n',
                                            encoding='utf-8')
        storage.register_resource('lut', 'route_legacy.cube', 'comfytv-luts',
                                  size=14, sha256='t2')
        resp = await client.get('/comfytv/luts/route_legacy.cube')
        assert resp.status == 200
        assert (await resp.read()).startswith(b'LUT_3D_SIZE')

    async def test_serve_lut_missing_404(self, client):
        resp = await client.get('/comfytv/luts/definitely-missing.cube')
        assert resp.status == 404

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
