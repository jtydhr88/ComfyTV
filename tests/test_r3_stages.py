"""Schema + execute wiring tests for the roadmap-3 stages
(video_keying / video_stylize / etc.) and the upgraded stages."""
import inspect

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

NEW_CLASSES = [
    "PIKStage", "KeyerStage", "DespillStage", "ColorSuppressStage",
    "KeyMixStage", "MatteMonitorStage", "MatteMorphStage",
    "FrameBlendStage", "ColorFXStage", "KenBurnsStage", "OldFilmStage",
    "AnnotateStage", "AudioReactiveStage", "AudioMeterStage",
]


def _classes():
    from ComfyTV.nodes.stages import (
        video_keying, video_stylize, video_color, video_generate,
        video_masking, audio_reactive,
    )
    out = {}
    for mod in (video_keying, video_stylize, video_color, video_generate,
                video_masking, audio_reactive):
        for name, obj in inspect.getmembers(mod):
            if inspect.isclass(obj) and hasattr(obj, "define_schema") \
                    and obj.__module__ == mod.__name__:
                out[name] = obj
    return out


@pytest.mark.parametrize("cls_name", NEW_CLASSES)
def test_define_schema(cls_name):
    classes = _classes()
    assert cls_name in classes
    classes[cls_name].define_schema()


def test_meta_registered():
    from ComfyTV.nodes.stages.common.meta import STAGE_META
    for name in NEW_CLASSES:
        assert name in STAGE_META


def test_extension_registers_all():
    pytest.importorskip("torch")
    import asyncio
    from ComfyTV.nodes.stages import ComfyTVExtension
    nodes = asyncio.run(ComfyTVExtension().get_node_list())
    names = {c.__name__ for c in nodes}
    for name in NEW_CLASSES:
        assert name in names


def test_pik_passes_args(monkeypatch):
    from ComfyTV.nodes.stages import video_keying
    captured = {}

    def fake(url, **kw):
        captured['url'] = url
        captured.update(kw)
        return 'out.mp4'

    monkeypatch.setattr(video_keying, 'pik_video', fake)
    monkeypatch.setattr(video_keying, '_stage_emit_auto',
                        lambda cls, **kw: {'payload': kw['payload_str']})
    video_keying.PIKStage.execute(
        project_id='p', video='/view?filename=a.mp4&type=output',
        clean_plate='/view?filename=c.png&type=output', screen='blue',
        red_weight=0.7, output='matte')
    assert captured['screen'] == 'blue'
    assert captured['red_weight'] == pytest.approx(0.7)
    assert captured['clean_plate_url'].endswith('c.png&type=output')
    assert captured['output'] == 'matte'


def test_keymix_needs_mask():
    from ComfyTV.nodes.stages import video_keying
    with pytest.raises(RuntimeError, match="mask"):
        video_keying.KeyMixStage.execute(
            project_id='p', video_a='/view?a', video_b='/view?b')


def test_frame_blend_dispatch(monkeypatch):
    from ComfyTV.nodes.stages import video_stylize
    calls = {}
    monkeypatch.setattr(video_stylize, 'frame_blend_video',
                        lambda url, **kw: calls.setdefault('window', kw) or 'o')
    monkeypatch.setattr(video_stylize, 'time_blur_video',
                        lambda url, **kw: calls.setdefault('shutter', kw) or 'o')
    monkeypatch.setattr(video_stylize, '_stage_emit_auto',
                        lambda cls, **kw: {})
    video_stylize.FrameBlendStage.execute(project_id='p', video='/view?v',
                                     mode='window', frame_min=-3,
                                     operation='max')
    video_stylize.FrameBlendStage.execute(project_id='p', video='/view?v',
                                     mode='shutter', shutter=1.0,
                                     divisions=4)
    assert calls['window']['frame_min'] == -3
    assert calls['window']['operation'] == 'max'
    assert calls['shutter']['divisions'] == 4


def test_colorfx_spec_building(monkeypatch):
    from ComfyTV.nodes.stages import video_color
    captured = {}
    monkeypatch.setattr(video_color, 'filter_video',
                        lambda url, specs, **kw: captured.setdefault(
                            'specs', specs) or 'o')
    monkeypatch.setattr(video_color, '_stage_emit_auto', lambda cls, **kw: {})
    video_color.ColorFXStage.execute(project_id='p', video='/view?v',
                                  mode='selectivecolor', sc_reds=0.4,
                                  sc_blues=-0.2)
    name, args = captured['specs'][0]
    assert name == 'selectivecolor'
    assert 'reds=0.4' in args and 'blues=-0.2' in args

    captured.clear()
    video_color.ColorFXStage.execute(project_id='p', video='/view?v',
                                  mode='chromashift', shift_rh=4)
    name, args = captured['specs'][0]
    assert name == 'chromashift'
    assert 'crh=4' in args

    with pytest.raises(RuntimeError, match="zero"):
        video_color.ColorFXStage.execute(project_id='p', video='/view?v',
                                      mode='chromashift')


def test_annotate_spec_building(monkeypatch):
    from ComfyTV.nodes.stages import video_masking
    captured = {}
    monkeypatch.setattr(video_masking, 'filter_video',
                        lambda url, specs, **kw: captured.setdefault(
                            'specs', specs) or 'o')
    monkeypatch.setattr(video_masking, '_stage_emit_auto', lambda cls, **kw: {})
    video_masking.AnnotateStage.execute(project_id='p', video='/view?v',
                                   mode='grid', w=0.25, h=0.25)
    name, args = captured['specs'][0]
    assert name == 'drawgrid'
    assert 'w=iw*0.25' in args


def test_time_remap_hold(monkeypatch):
    from ComfyTV.nodes.stages import video_timeline
    captured = {}
    monkeypatch.setattr(video_timeline, 'frame_hold',
                        lambda url, **kw: captured.update(kw) or 'o')
    monkeypatch.setattr(video_timeline, '_stage_emit_auto', lambda cls, **kw: {})
    video_timeline.TimeRemapStage.execute(project_id='p', video='/view?v',
                                    mode='hold', hold_frame=12,
                                    hold_increment=6)
    assert captured['first_frame'] == 12
    assert captured['increment'] == 6


def test_transition_luma_dispatch(monkeypatch):
    from ComfyTV.nodes.stages import video_timeline
    from ComfyTV.runners import video_timeline_ops
    captured = {}
    monkeypatch.setattr(video_timeline_ops, 'luma_wipe_videos',
                        lambda a, b, lm, **kw: captured.update(
                            {'luma': lm, **kw}) or 'o')
    monkeypatch.setattr(video_timeline, '_stage_emit_auto', lambda cls, **kw: {})
    video_timeline.VideoTransitionStage.execute(
        project_id='p', video_a='/view?a', video_b='/view?b',
        luma_image='/view?l.png', duration=0.8, luma_softness=0.2)
    assert captured['luma'] == '/view?l.png'
    assert captured['softness'] == pytest.approx(0.2)


def test_transform_shutter_passthrough(monkeypatch):
    from ComfyTV.nodes.stages import video_compose
    captured = {}
    monkeypatch.setattr(video_compose, 'transform_video',
                        lambda url, **kw: captured.update(kw) or 'o')
    monkeypatch.setattr(video_compose, '_stage_emit_auto', lambda cls, **kw: {})
    video_compose.VideoTransformStage.execute(
        project_id='p', video='/view?v', pos_x=10, motion_blur=1.0,
        shutter=1.5, shutter_type='start')
    assert captured['motion_blur'] == pytest.approx(1.0)
    assert captured['shutter'] == pytest.approx(1.5)
    assert captured['shutter_type'] == 'start'


def test_pattern_new_kinds_passthrough(monkeypatch):
    from ComfyTV.nodes.stages import video_generate
    captured = {}
    monkeypatch.setattr(video_generate, 'generate_pattern_video',
                        lambda kind, **kw: captured.update(
                            {'kind': kind, **kw}) or 'o')
    monkeypatch.setattr(video_generate, '_stage_emit_auto', lambda cls, **kw: {})
    video_generate.PatternStage.execute(project_id='p', kind='checkerboard',
                                   box_size=48)
    assert captured['kind'] == 'checkerboard'
    assert captured['box_size'] == 48


def test_title_typewriter_passthrough(monkeypatch):
    from ComfyTV.nodes.stages import video_text
    captured = {}
    monkeypatch.setattr(video_text, 'title_video',
                        lambda url, text, **kw: captured.update(kw) or 'o')
    monkeypatch.setattr(video_text, '_stage_emit_auto', lambda cls, **kw: {})
    video_text.TitleStage.execute(project_id='p', video='/view?v',
                                 text='hi', typewriter='char',
                                 type_step=0.2)
    assert captured['typewriter'] == 'char'
    assert captured['type_step'] == pytest.approx(0.2)


def test_locales_have_new_nodes():
    import json
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent / 'locales'
    for lang in ('en', 'zh'):
        nd = json.loads((root / lang / 'nodeDefs.json').read_text('utf-8'))
        main = json.loads((root / lang / 'main.json').read_text('utf-8'))
        for cls in NEW_CLASSES:
            assert f'ComfyTV_{cls}' in nd
            assert cls in nd['ComfyTV']
        for pid in ('pik-keyer', 'frame-blend', 'audio-reactive'):
            assert pid in main['presets']['videoChange']
        assert 'ken-burns' in main['presets']['imageEdit']
