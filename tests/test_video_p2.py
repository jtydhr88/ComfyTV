"""Tests for P2 backends: time remap, sequence render, paint strokes."""
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from test_media_concat import _write_clip  # noqa: E402


@pytest.fixture()
def clip():
    import folder_paths
    from ComfyTV.runners import media
    d = Path(folder_paths.get_output_directory()) / 'p2-src'
    d.mkdir(parents=True, exist_ok=True)
    p = d / 'clip.mp4'
    if not p.exists():
        _write_clip(p, w=160, h=120, fps=24, seconds=2.0, with_audio=True)
    return media.path_to_view_url(p)


@pytest.fixture()
def clip_b():
    import folder_paths
    from ComfyTV.runners import media
    d = Path(folder_paths.get_output_directory()) / 'p2-src'
    d.mkdir(parents=True, exist_ok=True)
    p = d / 'clip_b.mp4'
    if not p.exists():
        _write_clip(p, w=160, h=120, fps=24, seconds=1.0, with_audio=False)
    return media.path_to_view_url(p)


class TestTimeRemap:
    def test_constant_double_speed_halves_duration(self, clip):
        from ComfyTV.runners import media
        from ComfyTV.runners.media_remap import time_remap
        out = time_remap(clip, [{'t': 0, 'v': 2.0, 'interp': 'constant'}])
        info = media.get_video_info(out)
        assert 0.8 <= info['duration'] <= 1.3

    def test_ramp_slows_then_speeds(self, clip):
        """0.5x→2x linear ramp: ∫ speed over output = 2s source.
        Output duration is between the pure-slow (4s) and pure-fast (1s)."""
        from ComfyTV.runners import media
        from ComfyTV.runners.media_remap import time_remap
        out = time_remap(clip, [
            {'t': 0.0, 'v': 0.5, 'interp': 'linear'},
            {'t': 2.0, 'v': 2.0, 'interp': 'linear'},
        ])
        dur = media.get_video_info(out)['duration']
        assert 1.0 < dur < 4.0

    def test_output_duration_math(self):
        from ComfyTV.runners.media_remap import _speed_curve, _output_duration
        # constant speed 2.0 over 4s source → 2s output
        c = _speed_curve([{'t': 0, 'v': 2.0, 'interp': 'constant'}])
        assert _output_duration(c, 4.0) == pytest.approx(2.0, abs=0.01)


class TestSequence:
    def test_two_cuts(self, clip, clip_b):
        from ComfyTV.runners import media
        from ComfyTV.runners.media_remap import render_sequence
        out = render_sequence([
            {'url': clip, 'in_s': 0.0, 'out_s': 1.0, 'transition': 'cut'},
            {'url': clip_b, 'in_s': 0.0, 'out_s': 0.0, 'transition': 'cut'},
        ])
        dur = media.get_video_info(out)['duration']
        assert 1.6 <= dur <= 2.4  # 1.0 + 1.0

    def test_xfade_join(self, clip, clip_b):
        from ComfyTV.runners import media
        from ComfyTV.runners.media_remap import render_sequence
        out = render_sequence([
            {'url': clip, 'in_s': 0.0, 'out_s': 1.2, 'transition': 'cut'},
            {'url': clip_b, 'transition': 'wipeleft', 'trans_dur': 0.4},
        ])
        dur = media.get_video_info(out)['duration']
        # 1.2 + 1.0 - 0.4 overlap ≈ 1.8
        assert 1.4 <= dur <= 2.2

    def test_empty_rejected(self):
        from ComfyTV.runners.media_remap import render_sequence
        with pytest.raises(RuntimeError, match="no segments"):
            render_sequence([])


class TestPaint:
    def test_stroke_mask(self):
        from ComfyTV.runners.paint import rasterize_stroke
        m = rasterize_stroke([{'x': 30, 'y': 30, 'p': 1.0},
                              {'x': 70, 'y': 30, 'p': 1.0}], 100, 60,
                             radius=10, hardness=0.5)
        assert m[30, 50] > 0.9      # on the stroke line
        assert m[30, 30] > 0.9
        assert m[55, 50] < 0.01     # far away

    def test_pressure_scales_radius(self):
        from ComfyTV.runners.paint import rasterize_stroke
        soft = rasterize_stroke([{'x': 50, 'y': 30, 'p': 0.3}], 100, 60,
                                radius=20, hardness=0.9)
        hard = rasterize_stroke([{'x': 50, 'y': 30, 'p': 1.0}], 100, 60,
                                radius=20, hardness=0.9)
        assert hard.sum() > soft.sum() * 2

    def test_paint_video_color(self, clip_b):
        pytest.importorskip("torch")
        from ComfyTV.runners import media
        from ComfyTV.runners.paint import paint_video
        out = paint_video(clip_b, [{
            'mode': 'color', 'color': '#FF0000', 'radius': 15,
            'points': [{'x': 40, 'y': 40}, {'x': 100, 'y': 40}],
        }])
        info = media.get_video_info(out)
        assert (info['width'], info['height']) == (160, 120)

    def test_paint_video_clone_and_blur(self, clip_b):
        pytest.importorskip("torch")
        from ComfyTV.runners.paint import paint_video
        paint_video(clip_b, [
            {'mode': 'clone', 'dx': 20, 'dy': 0, 'radius': 12,
             'points': [{'x': 50, 'y': 50}]},
            {'mode': 'blur', 'sigma': 4, 'radius': 12,
             'points': [{'x': 90, 'y': 60}]},
        ])

    def test_no_strokes_rejected(self, clip_b):
        from ComfyTV.runners.paint import paint_video
        with pytest.raises(RuntimeError, match="no strokes"):
            paint_video(clip_b, [])


def _cls(name):
    from ComfyTV.nodes.stages import video_p2
    return getattr(video_p2, name)


class TestStageExecute:
    def test_schemas(self):
        for name in ('TimeRemapStage', 'SequenceStage',
                     'VideoStabilizeV2Stage', 'PaintStrokeStage'):
            _cls(name).define_schema()

    def test_meta(self):
        from ComfyTV.nodes.stages.common.meta import STAGE_META
        for name in ('TimeRemapStage', 'SequenceStage',
                     'VideoStabilizeV2Stage', 'PaintStrokeStage'):
            assert name in STAGE_META

    def test_time_remap_execute(self, clip):
        _cls('TimeRemapStage').execute(
            project_id='p1',
            speed_keys='[{"t":0,"v":1.0,"interp":"linear"},'
                       '{"t":1,"v":2.0,"interp":"linear"}]',
            video=clip)

    def test_time_remap_needs_keys(self, clip):
        with pytest.raises(RuntimeError, match="keyframes"):
            _cls('TimeRemapStage').execute(project_id='p1', video=clip)

    def test_sequence_execute(self, clip, clip_b):
        _cls('SequenceStage').execute(
            project_id='p1',
            segments='[{"slot":"video0","in_s":0,"out_s":1,"transition":"cut"},'
                     '{"slot":"video1","transition":"fade","trans_dur":0.3}]',
            videos={'video0': clip, 'video1': clip_b})

    def test_paint_execute(self, clip_b):
        pytest.importorskip("torch")
        _cls('PaintStrokeStage').execute(
            project_id='p1',
            strokes='[{"mode":"color","color":"#00FF00","radius":10,'
                    '"points":[{"x":50,"y":50}]}]',
            video=clip_b)
