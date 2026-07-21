"""FX serial chain: envelope-carrying video values + FX Chain single render."""
import json
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from test_media_concat import _write_clip  # noqa: E402


@pytest.fixture()
def clip():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'fx-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'fx_chain_clip.mp4'
    if not p.exists():
        _write_clip(p, w=320, h=240, fps=24, seconds=1.5, with_audio=True)
    return media.path_to_view_url(p)


@pytest.fixture()
def lut_file():
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
    return 'identity.cube'


def _chain():
    from ComfyTV.nodes.stages.fx_chain import FXChainStage
    return FXChainStage


def _unpack(value):
    from ComfyTV.nodes.stages.common import unpack_fx_video
    return unpack_fx_video(value)


def _darker(video):
    from ComfyTV.nodes.stages.video_color import VideoCurvesStage
    return VideoCurvesStage.execute(project_id='p1', preset='darker',
                                    video=video).values[0]


def _frames_mean(view_url, n=12):
    from ComfyTV.runners.media import localize
    vals = []
    with av.open(str(localize(view_url))) as c:
        for frame in c.decode(c.streams.video[0]):
            vals.append(float(frame.to_ndarray(format='rgb24').mean()))
            if len(vals) >= n:
                break
    assert vals
    return sum(vals) / len(vals)


def _stream_tags(view_url):
    from ComfyTV.runners.media import localize
    with av.open(str(localize(view_url))) as c:
        cc = c.streams.video[0].codec_context
        return int(cc.colorspace), int(cc.color_primaries)


class TestDeliveryColorspace:
    def test_avfilter_tail_converts_and_tags(self, clip):
        out = _chain().execute(project_id='p1', out_colorspace='bt2020',
                               video=_darker(clip))
        url = out.values[0]
        assert url.startswith('/view?')
        assert _stream_tags(url) == (9, 9)
        assert _frames_mean(url) > 0

    def test_torch_tail_gets_extra_pass(self, clip):
        from ComfyTV.nodes.stages.video_keying import ColorSuppressStage
        v = ColorSuppressStage.execute(project_id='p1', green=1.0,
                                       video=clip).values[0]
        out = _chain().execute(project_id='p1', out_colorspace='bt601-6-625',
                               video=v)
        assert _stream_tags(out.values[0])[0] == 5

    def test_default_stays_bt709(self, clip):
        out = _chain().execute(project_id='p1', video=_darker(clip))
        assert _stream_tags(out.values[0]) == (1, 1)

    def test_unknown_target_falls_back_to_bt709(self, clip):
        out = _chain().execute(project_id='p1', out_colorspace='nope',
                               video=_darker(clip))
        assert _stream_tags(out.values[0]) == (1, 1)


def _vcodec_name(view_url):
    from ComfyTV.runners.media import localize
    with av.open(str(localize(view_url))) as c:
        return c.streams.video[0].codec_context.name


class TestDeliveryParams:
    def test_size_short_side(self, clip):
        from ComfyTV.runners.fx_chain_exec import run_fx_chain
        from ComfyTV.runners.media import get_video_info
        _url, entries = _unpack(_darker(clip))
        out = run_fx_chain(clip, entries, delivery={'size': 120})
        info = get_video_info(out)
        assert (info['width'], info['height']) == (160, 120)

    def test_fps_conversion(self, clip):
        from ComfyTV.runners.fx_chain_exec import run_fx_chain
        from ComfyTV.runners.media import get_video_info
        _url, entries = _unpack(_darker(clip))
        out = run_fx_chain(clip, entries, delivery={'fps': 12})
        info = get_video_info(out)
        assert info['fps'] == pytest.approx(12, abs=0.5)
        assert info['duration'] == pytest.approx(1.5, abs=0.2)

    def test_hevc_codec(self, clip):
        out = _chain().execute(project_id='p1', out_codec='hevc',
                               video=_darker(clip))
        assert _vcodec_name(out.values[0]) == 'hevc'
        assert _stream_tags(out.values[0]) == (1, 1)

    def test_prores_mov(self, clip):
        from ComfyTV.runners.media import localize
        out = _chain().execute(project_id='p1', out_codec='prores',
                               video=_darker(clip))
        url = out.values[0]
        assert str(localize(url)).endswith('.mov')
        assert _vcodec_name(url) == 'prores'
        with av.open(str(localize(url))) as c:
            first = next(c.decode(c.streams.video[0]))
            assert first.format.name == 'yuv422p10le'

    def test_torch_tail_gets_delivery(self, clip):
        from ComfyTV.nodes.stages.video_keying import ColorSuppressStage
        from ComfyTV.runners.fx_chain_exec import run_fx_chain
        from ComfyTV.runners.media import get_video_info
        v = ColorSuppressStage.execute(project_id='p1', green=1.0,
                                       video=clip).values[0]
        _url, entries = _unpack(v)
        out = run_fx_chain(clip, entries, delivery={'size': 120,
                                                    'codec': 'hevc'})
        assert get_video_info(out)['height'] == 120
        assert _vcodec_name(out) == 'hevc'

    def test_draft_quality_renders(self, clip):
        out = _chain().execute(project_id='p1', out_quality='draft',
                               out_size='480', video=_darker(clip))
        from ComfyTV.runners.media import get_video_info
        assert get_video_info(out.values[0])['height'] == 480

    def test_default_delivery_unchanged(self, clip):
        from ComfyTV.runners.media import get_video_info
        out = _chain().execute(project_id='p1', video=_darker(clip))
        info = get_video_info(out.values[0])
        assert (info['width'], info['height']) == (320, 240)
        assert _vcodec_name(out.values[0]) == 'h264'


class TestEnvelope:
    def test_fx_stage_requires_video(self):
        from ComfyTV.nodes.stages.video_color import VideoCurvesStage
        with pytest.raises(RuntimeError, match="upstream video"):
            VideoCurvesStage.execute(project_id='p1', preset='darker',
                                     video="")

    def test_passthrough_wraps_spec_into_video_value(self, clip):
        from ComfyTV.nodes.stages.video_color import VideoCurvesStage
        out = VideoCurvesStage.execute(project_id='p1', preset='darker',
                                       video=clip)
        url, entries = _unpack(out.values[0])
        assert url == clip
        assert len(entries) == 1
        assert entries[0]['kind'] == 'ComfyTV.VideoCurvesStage'
        assert entries[0]['specs'] == [['curves', 'preset=darker']]
        assert out.ui == {'output': [clip]}

    def test_unpack_passes_plain_urls_through(self, clip):
        assert _unpack(clip) == (clip, [])
        assert _unpack('') == ('', [])
        assert _unpack('{not json') == ('{not json', [])

    def test_localize_strips_envelope(self, clip):
        from ComfyTV.nodes.stages.common import pack_fx_video
        from ComfyTV.runners.media import localize
        wrapped = pack_fx_video(clip, [])
        assert localize(wrapped) == localize(clip)


class TestSerialChain:
    def test_video_wire_accumulates_entries(self, clip):
        from ComfyTV.nodes.stages.video_color import VideoColorStage
        v1 = _darker(clip)
        v2 = VideoColorStage.execute(project_id='p1', exposure=0.5,
                                     video=v1).values[0]
        url, entries = _unpack(v2)
        assert url == clip
        assert [e['kind'] for e in entries] == [
            'ComfyTV.VideoCurvesStage', 'ComfyTV.VideoColorStage']
        assert entries[1]['params']['exposure'] == 0.5

    def test_three_deep_chain_stays_ordered(self, clip):
        from ComfyTV.nodes.stages.video_color import VideoColorStage
        from ComfyTV.nodes.stages.video_stylize import VideoStylizeStage
        v1 = _darker(clip)
        v2 = VideoColorStage.execute(project_id='p1', exposure=0.5,
                                     video=v1).values[0]
        v3 = VideoStylizeStage.execute(project_id='p1', effect='sepia',
                                       video=v2).values[0]
        _url, entries = _unpack(v3)
        assert [e['kind'] for e in entries] == [
            'ComfyTV.VideoCurvesStage', 'ComfyTV.VideoColorStage',
            'ComfyTV.VideoStylizeStage']

    def test_chain_renders_merged_entries_once(self, clip):
        from ComfyTV.nodes.stages.video_color import VideoColorStage
        v2 = VideoColorStage.execute(project_id='p1', exposure=-1.0,
                                     video=_darker(clip)).values[0]
        out = _chain().execute(project_id='p1', video=v2)
        url = out.values[0]
        assert url.startswith('/view?')
        assert _frames_mean(url) < _frames_mean(clip)

    def test_torch_only_chain_renders(self, clip):
        from ComfyTV.nodes.stages.video_keying import ColorSuppressStage
        v = ColorSuppressStage.execute(project_id='p1', green=1.0,
                                       output='matte', video=clip).values[0]
        _url, entries = _unpack(v)
        assert entries[0]['engine'] == 'torch'
        out = _chain().execute(project_id='p1', video=v)
        assert out.values[0].startswith('/view?')
        assert abs(_frames_mean(out.values[0]) - _frames_mean(clip)) > 20

    def test_mixed_avfilter_torch_chain(self, clip):
        from ComfyTV.nodes.stages.video_keying import ColorSuppressStage
        v = ColorSuppressStage.execute(project_id='p1', green=1.0,
                                       video=_darker(clip)).values[0]
        _url, entries = _unpack(v)
        assert [e.get('engine', 'avfilter') for e in entries] == \
            ['avfilter', 'torch']
        out = _chain().execute(project_id='p1', video=v)
        assert _frames_mean(out.values[0]) < _frames_mean(clip)

    def test_keyer_matte_in_chain(self, clip):
        from ComfyTV.nodes.stages.video_keying import KeyerStage
        v = KeyerStage.execute(project_id='p1', mode='luminance',
                               center=0.5, video=clip).values[0]
        out = _chain().execute(project_id='p1', video=v)
        from ComfyTV.runners.media import localize
        with av.open(str(localize(out.values[0]))) as c:
            frame = next(c.decode(c.streams.video[0]))
            arr = frame.to_ndarray(format='rgb24')
        assert abs(int(arr[..., 0].mean()) - int(arr[..., 1].mean())) <= 2

    def test_pik_in_chain_uses_pick_color(self, clip):
        from ComfyTV.nodes.stages.video_keying import PIKStage
        v = PIKStage.execute(project_id='p1', screen='green',
                             output='premult', video=clip).values[0]
        _url, entries = _unpack(v)
        assert entries[0]['op'] == 'pik'
        out = _chain().execute(project_id='p1', video=v)
        assert out.values[0].startswith('/view?')

    def test_keying_passthrough_without_sides(self, clip):
        from ComfyTV.nodes.stages.video_keying import KeyerStage, PIKStage
        for stage in (KeyerStage, PIKStage):
            out = stage.execute(project_id='p1', video=clip)
            url, entries = _unpack(out.values[0])
            assert url == clip
            assert entries[0]['engine'] == 'torch'
            assert out.ui == {'output': [clip]}

    def test_keyer_with_mask_still_renders_locally(self, clip):
        import folder_paths
        from PIL import Image
        from ComfyTV.nodes.stages.video_keying import KeyerStage
        from ComfyTV.runners import media
        mask_path = Path(folder_paths.get_output_directory()) / 'fx-src' \
            / 'white_mask.png'
        if not mask_path.exists():
            Image.new('L', (32, 32), 255).save(mask_path)
        mask_url = media.path_to_view_url(mask_path)
        out = KeyerStage.execute(project_id='p1', mode='luminance',
                                 video=clip, in_mask=mask_url)
        assert out.values[0] != clip
        assert out.values[0].startswith('/view?')

    def test_local_render_bakes_pending_chain(self, clip):
        from ComfyTV.nodes.stages.video_compose import VideoTransformStage
        track = json.dumps([{'t': 0.0, 'x': 0.0, 'y': 0.0,
                             'scale': 1.0, 'rotation': 0.0,
                             'interp': 'linear'}])
        out = VideoTransformStage.execute(project_id='p1',
                                          video=_darker(clip), track=track)
        assert out.values[0].startswith('/view?')
        assert _frames_mean(out.values[0]) < _frames_mean(clip) - 1.0

    def test_glow_in_chain_brightens(self, clip):
        from ComfyTV.nodes.stages.video_stylize import GlowStage
        v = GlowStage.execute(project_id='p1', threshold=0.1, gain=2.0,
                              video=clip).values[0]
        _url, entries = _unpack(v)
        assert entries[0]['op'] == 'glow'
        out = _chain().execute(project_id='p1', video=v)
        assert _frames_mean(out.values[0]) > _frames_mean(clip)

    def test_god_rays_in_chain_renders(self, clip):
        from ComfyTV.nodes.stages.video_stylize import GodRaysStage
        v = GodRaysStage.execute(project_id='p1', scale=1.4,
                                 video=clip).values[0]
        assert _unpack(v)[1][0]['op'] == 'god_rays'
        out = _chain().execute(project_id='p1', video=v)
        assert out.values[0].startswith('/view?')

    def test_old_film_in_chain_renders(self, clip):
        from ComfyTV.nodes.stages.video_stylize import OldFilmStage
        v = OldFilmStage.execute(project_id='p1', video=clip).values[0]
        assert _unpack(v)[1][0]['op'] == 'old_film'
        out = _chain().execute(project_id='p1', video=v)
        assert out.values[0].startswith('/view?')
        assert abs(_frames_mean(out.values[0]) - _frames_mean(clip)) > 0.1

    def test_transform_passthrough_without_track(self, clip):
        from ComfyTV.nodes.stages.video_compose import VideoTransformStage
        out = VideoTransformStage.execute(project_id='p1', pos_x=160.0,
                                          video=clip)
        url, entries = _unpack(out.values[0])
        assert url == clip
        assert entries[0]['engine'] == 'torch'
        assert entries[0]['op'] == 'transform'
        assert entries[0]['params']['pos_x'] == 160.0

    def test_transform_in_chain_shifts_frame(self, clip):
        from ComfyTV.nodes.stages.video_compose import VideoTransformStage
        v = VideoTransformStage.execute(project_id='p1', pos_x=160.0,
                                        video=clip).values[0]
        out = _chain().execute(project_id='p1', video=v)
        assert _frames_mean(out.values[0]) < _frames_mean(clip) * 0.75

    def test_transform_with_track_renders_locally(self, clip):
        from ComfyTV.nodes.stages.video_compose import VideoTransformStage
        track = json.dumps([{'t': 0.0, 'x': 10.0, 'y': 0.0,
                             'scale': 1.0, 'rotation': 0.0,
                             'interp': 'linear'}])
        out = VideoTransformStage.execute(project_id='p1', video=clip,
                                          track=track)
        assert out.values[0] != clip
        assert out.values[0].startswith('/view?')

    def test_chain_applies_fps_multiplier(self, clip):
        from ComfyTV.nodes.stages.video_enhance import VideoDeinterlaceStage
        from ComfyTV.runners.media import get_video_info
        v = VideoDeinterlaceStage.execute(project_id='p1', method='bwdif',
                                          rate='field', video=clip).values[0]
        out = _chain().execute(project_id='p1', video=v)
        assert round(get_video_info(out.values[0])['fps']) == 48

    def test_neutral_stage_is_identity_in_chain(self, clip):
        from ComfyTV.nodes.stages.video_color import VideoColorStage
        v = VideoColorStage.execute(project_id='p1',
                                    video=_darker(clip)).values[0]
        _url, entries = _unpack(v)
        assert [e['kind'] for e in entries] == ['ComfyTV.VideoCurvesStage']
        out = _chain().execute(project_id='p1', video=v)
        assert _frames_mean(out.values[0]) < _frames_mean(clip)

    def test_chain_matches_per_node_renders(self, clip):
        from ComfyTV.nodes.stages.video_color import VideoColorStage
        from ComfyTV.runners.media_filter import filter_video
        v1 = VideoColorStage.execute(project_id='p1', exposure=1.4,
                                     video=clip).values[0]
        v2 = VideoColorStage.execute(project_id='p1', exposure=-0.4,
                                     temperature=4050, video=v1).values[0]
        out = _chain().execute(project_id='p1', video=v2)
        pass_a = filter_video(clip, [('exposure', 'exposure=1.4:black=0.0')])
        pass_b = filter_video(pass_a,
                              [('exposure', 'exposure=-0.4:black=0.0'),
                               ('colortemperature', 'temperature=4050:mix=1')])
        assert abs(_frames_mean(out.values[0]) - _frames_mean(pass_b)) < 3.0

    def test_wire_order_defines_chain_order(self, clip):
        from ComfyTV.nodes.stages.video_color import VideoCurvesStage
        def curves(preset, video):
            return VideoCurvesStage.execute(project_id='p1', preset=preset,
                                            video=video).values[0]
        dark_then_neg = curves('negative', curves('darker', clip))
        neg_then_dark = curves('darker', curves('negative', clip))
        m_ab = _frames_mean(_chain().execute(
            project_id='p1', video=dark_then_neg).values[0])
        m_ba = _frames_mean(_chain().execute(
            project_id='p1', video=neg_then_dark).values[0])
        assert abs(m_ab - m_ba) > 2.0


class TestChainExecute:
    def test_missing_video_rejected(self):
        with pytest.raises(RuntimeError, match="upstream video"):
            _chain().execute(project_id='p1', video="")

    def test_plain_video_without_fx_rejected(self, clip):
        with pytest.raises(RuntimeError, match="no FX upstream"):
            _chain().execute(project_id='p1', video=clip)

    def test_envelope_with_invalid_entries_rejected(self, clip):
        bad = json.dumps({'__fxvideo__': {'url': clip, 'chain': [{'x': 1}]}})
        with pytest.raises(RuntimeError, match="no FX upstream"):
            _chain().execute(project_id='p1', video=bad)

    def test_executor_still_supports_audio_entries(self, clip):
        from ComfyTV.nodes.stages.audio_effects import AudioStereoStage
        from ComfyTV.runners.fx_chain_exec import run_fx_chain
        from ComfyTV.runners.media import localize
        from ComfyTV.nodes.stages.video_color import VideoCurvesStage
        v_entry = _unpack(VideoCurvesStage.execute(
            project_id='p1', preset='darker', video=clip).values[0])[1][0]
        a_entry = json.loads(AudioStereoStage.execute(
            project_id='p1', mode='mono').values[1])
        payload = run_fx_chain(clip, [v_entry, a_entry])
        assert payload.startswith('/view?')
        with av.open(str(localize(payload))) as c:
            assert c.streams.video
            assert c.streams.audio


def test_audio_stage_emits_spec_without_input():
    from ComfyTV.nodes.stages.audio_process import AudioDynamicsStage
    out = AudioDynamicsStage.execute(project_id='p1', mode='compressor')
    assert out.values[0] == ""
    data = json.loads(out.values[1])
    assert data['domain'] == 'audio'
    assert data['specs'][0][0] == 'acompressor'


VIDEO_ELIGIBLE = [
    ("video_color", "VideoColorStage", {"exposure": 0.5}),
    ("video_color", "VideoCurvesStage", {"preset": "darker"}),
    ("video_color", "VideoLUTStage", {"lut_file": "identity.cube"}),
    ("video_enhance", "VideoBlurSharpenStage", {"mode": "gaussian", "amount": 2.0}),
    ("video_enhance", "VideoDenoiseStage", {"method": "atadenoise",
                                            "strength": 0.3}),
    ("video_enhance", "VideoDeinterlaceStage", {"method": "bwdif"}),
    ("video_stylize", "VideoStylizeStage", {"effect": "vignette", "strength": 0.5}),
    ("video_stylize", "ChromaShiftStage", {"shift_rh": 4.0}),
    ("video_color", "SelectiveColorStage", {"sc_reds": 0.4}),
    ("video_stylize", "PseudocolorStage", {"pseudo_preset": "turbo"}),
    ("video_color", "GrayWorldStage", {}),
    ("video_color", "HueCorrectStage",
     {"curves": '{"sat": [[0.0, 0.5], [1.0, 0.5]]}'}),
    ("video_keying", "DespillStage", {"screen": "green"}),
    ("video_keying", "MatteMorphStage", {"op": "dilate", "size_x": 2}),
]


@pytest.mark.parametrize("mod_name,cls_name,kwargs", VIDEO_ELIGIBLE)
def test_video_stage_roundtrips_through_chain(clip, lut_file, mod_name,
                                              cls_name, kwargs):
    import importlib
    mod = importlib.import_module(f"ComfyTV.nodes.stages.{mod_name}")
    cls = getattr(mod, cls_name)
    out = cls.execute(project_id='p1', video=clip, **kwargs)
    url, entries = _unpack(out.values[0])
    assert url == clip
    assert entries and entries[-1]['kind'] == f"ComfyTV.{cls_name}"
    chained = _chain().execute(project_id='p1', video=out.values[0])
    assert chained.values[0].startswith('/view?')
