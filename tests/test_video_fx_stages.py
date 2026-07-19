"""Schema + execute smoke tests for the Lane A FX stages."""
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from test_media_concat import _write_clip  # noqa: E402

ALL_FX_CLASSES = [
    "VideoColorStage", "VideoCurvesStage", "VideoLUTStage",
    "VideoBlurSharpenStage", "VideoDenoiseStage", "VideoChromaKeyStage",
    "VideoTransitionStage", "VideoStabilizeStage", "SceneDetectStage",
    "VideoInterpolateStage", "VideoDeinterlaceStage", "VideoStylizeStage",
    "VideoScopesStage",
    "AudioDynamicsStage", "AudioEQStage", "AudioLoudnessStage",
    "AudioDenoiseStage",
]


def _classes():
    from ComfyTV.nodes.stages import (
        video_color, video_enhance, video_keying, video_stylize,
        video_timeline, video_analysis, audio_process,
    )
    import inspect
    out = {}
    for mod in (video_color, video_enhance, video_keying, video_stylize,
                video_timeline, video_analysis, audio_process):
        for name, obj in inspect.getmembers(mod):
            if inspect.isclass(obj) and hasattr(obj, "define_schema") \
                    and obj.__module__ == mod.__name__:
                out[name] = obj
    return out


@pytest.mark.parametrize("cls_name", ALL_FX_CLASSES)
def test_define_schema(cls_name):
    classes = _classes()
    assert cls_name in classes, f"{cls_name} missing from the FX stage modules"
    classes[cls_name].define_schema()


def test_meta_registered():
    from ComfyTV.nodes.stages.common.meta import STAGE_META
    for name in ALL_FX_CLASSES:
        assert name in STAGE_META, f"{name} missing from STAGE_META"


@pytest.fixture()
def clip():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'fx-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'fx_clip.mp4'
    if not p.exists():
        _write_clip(p, w=320, h=240, fps=24, seconds=1.5, with_audio=True)
    return media.path_to_view_url(p)


@pytest.fixture()
def clip2():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'fx-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'fx_clip2.mp4'
    if not p.exists():
        _write_clip(p, w=320, h=240, fps=24, seconds=1.0, with_audio=False)
    return media.path_to_view_url(p)


class TestExecute:
    def test_color(self, clip):
        cls = _classes()["VideoColorStage"]
        cls.execute(project_id="p1", exposure=0.5, saturation=0.3,
                    shadows_r=0.1, video=clip)

    def test_color_neutral_rejected(self, clip):
        cls = _classes()["VideoColorStage"]
        with pytest.raises(RuntimeError, match="neutral"):
            cls.execute(project_id="p1", video=clip)

    def test_color_whitepoint_above_one(self, clip):
        cls = _classes()["VideoColorStage"]
        cls.execute(project_id="p1", whitepoint=1.5, video=clip)
        cls.execute(project_id="p1", whitepoint=2.0, blackpoint=-0.2, video=clip)

    def test_color_temperature_clamped(self, clip):
        cls = _classes()["VideoColorStage"]
        cls.execute(project_id="p1", temperature=500, video=clip)
        cls.execute(project_id="p1", temperature=99999, video=clip)

    def test_curves_preset_and_points(self, clip):
        cls = _classes()["VideoCurvesStage"]
        cls.execute(project_id="p1", preset='vintage',
                    master_pts='[[0,0],[0.5,0.6],[1,1]]', video=clip)

    def test_curves_duplicate_x_deduped(self, clip):
        cls = _classes()["VideoCurvesStage"]
        cls.execute(project_id="p1",
                    master_pts='[[0.5,0.2],[0.5,0.8],[1,1]]', video=clip)

    def test_blur(self, clip):
        cls = _classes()["VideoBlurSharpenStage"]
        cls.execute(project_id="p1", mode='gaussian', amount=3.0, video=clip)

    def test_sharpen(self, clip):
        cls = _classes()["VideoBlurSharpenStage"]
        cls.execute(project_id="p1", mode='sharpen', amount=1.2, size=5, video=clip)

    def test_denoise(self, clip):
        cls = _classes()["VideoDenoiseStage"]
        cls.execute(project_id="p1", method='atadenoise', strength=0.4, video=clip)

    def test_chromakey_matte(self, clip):
        cls = _classes()["VideoChromaKeyStage"]
        cls.execute(project_id="p1", key_color='#00FF00', output='matte', video=clip)

    def test_chromakey_matte_without_despill(self, clip):
        cls = _classes()["VideoChromaKeyStage"]
        cls.execute(project_id="p1", key_color='#00FF00', output='matte',
                    despill_mix=0.0, video=clip)

    def test_transition(self, clip, clip2):
        cls = _classes()["VideoTransitionStage"]
        cls.execute(project_id="p1", transition='wipeleft', duration=0.4,
                    video_a=clip, video_b=clip2)

    def test_stabilize(self, clip):
        cls = _classes()["VideoStabilizeStage"]
        cls.execute(project_id="p1", video=clip)

    def test_deinterlace(self, clip):
        cls = _classes()["VideoDeinterlaceStage"]
        cls.execute(project_id="p1", method='bwdif', video=clip)

    def test_stylize_old_film(self, clip):
        cls = _classes()["VideoStylizeStage"]
        cls.execute(project_id="p1", effect='old_film', strength=0.6, video=clip)

    def test_scopes(self, clip):
        cls = _classes()["VideoScopesStage"]
        cls.execute(project_id="p1", scope='vectorscope', video=clip)

    def test_audio_dynamics(self, clip):
        cls = _classes()["AudioDynamicsStage"]
        cls.execute(project_id="p1", mode='compressor', threshold_db=-25.0,
                    ratio=4.0, video=clip)

    def test_audio_eq(self, clip):
        cls = _classes()["AudioEQStage"]
        cls.execute(project_id="p1",
                    bands='[{"type":"peak","f":1000,"g":6,"q":1.5},'
                          '{"type":"highpass","f":80}]',
                    video=clip)

    def test_audio_loudness(self, clip):
        cls = _classes()["AudioLoudnessStage"]
        cls.execute(project_id="p1", mode='ebu_r128', video=clip)

    def test_audio_denoise(self, clip):
        cls = _classes()["AudioDenoiseStage"]
        cls.execute(project_id="p1", method='afftdn', strength=0.5, video=clip)

    def test_no_video_emits_spec_only(self):
        import json
        cls = _classes()["VideoColorStage"]
        out = cls.execute(project_id="p1", exposure=1.0, video="")
        assert out.values[0] == ""
        data = json.loads(out.values[1])
        assert data["kind"] == "ComfyTV.VideoColorStage"
        assert data["specs"][0][0] == "exposure"
