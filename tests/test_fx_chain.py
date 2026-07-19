"""FX Chain stage + fx_spec spec-only emission end-to-end tests."""
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
    return 'identity.cube'


def _chain():
    from ComfyTV.nodes.stages.fx_chain import FXChainStage
    return FXChainStage


def _spec_of(out):
    assert out.values[0] == ""
    return out.values[1]


def _curves_spec(preset):
    from ComfyTV.nodes.stages.video_color import VideoCurvesStage
    return _spec_of(VideoCurvesStage.execute(project_id='p1', preset=preset,
                                             video=""))


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


class TestSpecOnly:
    def test_video_stage_emits_spec_without_input(self):
        out_json = _curves_spec('darker')
        data = json.loads(out_json)
        assert data['v'] == 1
        assert data['kind'] == 'ComfyTV.VideoCurvesStage'
        assert data['label'] == 'Video Curves'
        assert data['domain'] == 'video'
        assert data['specs'] == [['curves', 'preset=darker']]

    def test_spec_only_produces_no_ui_output(self):
        from ComfyTV.nodes.stages.video_color import VideoCurvesStage
        out = VideoCurvesStage.execute(project_id='p1', preset='darker',
                                       video="")
        assert out.values[0] == ""
        assert not out.ui

    def test_audio_stage_emits_spec_without_input(self):
        from ComfyTV.nodes.stages.audio_process import AudioDynamicsStage
        out = AudioDynamicsStage.execute(project_id='p1', mode='compressor')
        data = json.loads(_spec_of(out))
        assert data['domain'] == 'audio'
        assert data['specs'][0][0] == 'acompressor'

    def test_wired_video_still_transcodes(self, clip):
        from ComfyTV.nodes.stages.video_color import VideoCurvesStage
        out = VideoCurvesStage.execute(project_id='p1', preset='darker',
                                       video=clip)
        assert out.values[0].startswith('/view?')
        data = json.loads(out.values[1])
        assert data['specs'] == [['curves', 'preset=darker']]
        assert out.ui['output'] == [out.values[0]]
        assert out.values[1] not in out.ui.get('output', [])


class TestChainExecute:
    def test_two_video_specs(self, clip):
        from ComfyTV.nodes.stages.video_enhance import VideoBlurSharpenStage
        s1 = _curves_spec('darker')
        s2 = _spec_of(VideoBlurSharpenStage.execute(
            project_id='p1', mode='gaussian', amount=2.0, video=""))
        out = _chain().execute(project_id='p1', video=clip,
                               fx_specs={'fx_spec0': s1, 'fx_spec1': s2})
        assert out.values[0].startswith('/view?')

    def test_mixed_video_audio_single_pass(self, clip):
        from ComfyTV.nodes.stages.audio_effects import AudioStereoStage
        from ComfyTV.runners.media import localize
        s_v = _curves_spec('darker')
        s_a = _spec_of(AudioStereoStage.execute(project_id='p1', mode='mono'))
        out = _chain().execute(project_id='p1', video=clip,
                               fx_specs={'fx_spec0': s_v, 'fx_spec1': s_a})
        payload = out.values[0]
        assert payload.startswith('/view?')
        with av.open(str(localize(payload))) as c:
            assert c.streams.video
            assert c.streams.audio

    def test_chain_order_permutation_reorders(self, clip):
        s_dark = _curves_spec('darker')
        s_neg = _curves_spec('negative')
        out_ab = _chain().execute(project_id='p1', video=clip,
                                  fx_specs={'fx_spec0': s_dark,
                                            'fx_spec1': s_neg})
        out_ba = _chain().execute(project_id='p1', video=clip,
                                  fx_specs={'fx_spec0': s_dark,
                                            'fx_spec1': s_neg},
                                  chain_order='[2,1]')
        m_ab = _frames_mean(out_ab.values[0])
        m_ba = _frames_mean(out_ba.values[0])
        assert abs(m_ab - m_ba) > 2.0

    def test_stale_ordinals_ignored(self, clip):
        s = _curves_spec('darker')
        out = _chain().execute(project_id='p1', video=clip,
                               fx_specs={'fx_spec2': s},
                               chain_order='[1,9,3]')
        assert out.values[0].startswith('/view?')

    def test_missing_video_rejected(self):
        s = _curves_spec('darker')
        with pytest.raises(RuntimeError, match="upstream video"):
            _chain().execute(project_id='p1', video="",
                             fx_specs={'fx_spec0': s})

    def test_no_specs_rejected(self, clip):
        with pytest.raises(RuntimeError, match="at least one FX"):
            _chain().execute(project_id='p1', video=clip, fx_specs={})

    def test_none_group_rejected(self, clip):
        with pytest.raises(RuntimeError, match="at least one FX"):
            _chain().execute(project_id='p1', video=clip, fx_specs=None)

    def test_invalid_spec_json_names_slot(self, clip):
        s = _curves_spec('darker')
        with pytest.raises(RuntimeError, match="fx_spec slot 2"):
            _chain().execute(project_id='p1', video=clip,
                             fx_specs={'fx_spec0': s,
                                       'fx_spec1': 'not json'})

    def test_wrong_shape_spec_rejected(self, clip):
        with pytest.raises(RuntimeError, match="fx_spec slot 1"):
            _chain().execute(project_id='p1', video=clip,
                             fx_specs={'fx_spec0': '{"domain":"video"}'})


ELIGIBLE = [
    ("video_color", "VideoColorStage", {"exposure": 0.5}),
    ("video_color", "VideoCurvesStage", {"preset": "darker"}),
    ("video_color", "VideoLUTStage", {"lut_file": "identity.cube"}),
    ("video_enhance", "VideoBlurSharpenStage", {"mode": "gaussian", "amount": 2.0}),
    ("video_enhance", "VideoDenoiseStage", {"method": "atadenoise",
                                            "strength": 0.3}),
    ("video_enhance", "VideoDeinterlaceStage", {"method": "bwdif"}),
    ("video_stylize", "VideoStylizeStage", {"effect": "vignette", "strength": 0.5}),
    ("video_color", "ColorFXStage", {"mode": "chromashift", "shift_rh": 4.0}),
    ("audio_process", "AudioDynamicsStage", {"mode": "compressor"}),
    ("audio_process", "AudioEQStage",
     {"bands": '[{"type":"peak","f":1000,"g":6,"q":1.5}]'}),
    ("audio_process", "AudioDenoiseStage", {"method": "afftdn", "strength": 0.3}),
    ("audio_effects", "AudioModulationStage", {"mode": "tremolo"}),
    ("audio_effects", "AudioStereoStage", {"mode": "widen"}),
    ("audio_effects", "AudioTimePitchStage", {"mode": "speed", "tempo": 1.5}),
    ("audio_process", "AudioRepairStage", {"method": "declick"}),
    ("audio_effects", "AudioSaturateStage", {"mode": "softclip"}),
]


@pytest.mark.parametrize("mod_name,cls_name,kwargs", ELIGIBLE)
def test_eligible_spec_roundtrips_through_chain(clip, lut_file, mod_name,
                                                cls_name, kwargs):
    import importlib
    mod = importlib.import_module(f"ComfyTV.nodes.stages.{mod_name}")
    cls = getattr(mod, cls_name)
    out = cls.execute(project_id='p1', **kwargs)
    spec = _spec_of(out)
    data = json.loads(spec)
    assert data['kind'] == f"ComfyTV.{cls_name}"
    assert data['domain'] in ('video', 'audio')
    assert data['specs']
    chained = _chain().execute(project_id='p1', video=clip,
                               fx_specs={'fx_spec0': spec})
    assert chained.values[0].startswith('/view?')
