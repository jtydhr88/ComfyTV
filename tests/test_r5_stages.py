"""Roadmap-5 sprint: schema + execute coverage for the new stages."""
import json
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")

from test_media_concat import _write_clip  # noqa: E402

NEW_CLASSES = [
    "Video360Stage", "CDLStage", "HistogramEqStage", "AudioDuckStage",
]


@pytest.fixture()
def clip():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'r5-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'r5_clip.mp4'
    if not p.exists():
        _write_clip(p, w=320, h=240, fps=24, seconds=1.5, with_audio=True)
    return media.path_to_view_url(p)


@pytest.fixture()
def voice_clip():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'r5-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'r5_voice.mp4'
    if not p.exists():
        _write_clip(p, w=160, h=120, fps=24, seconds=1.0, with_audio=True)
    return media.path_to_view_url(p)


def _classes():
    from ComfyTV.nodes.stages import (
        video_optics, video_color, audio_edit,
    )
    import inspect
    out = {}
    for mod in (video_optics, video_color, audio_edit):
        for name, obj in inspect.getmembers(mod):
            if inspect.isclass(obj) and hasattr(obj, "define_schema") \
                    and obj.__module__ == mod.__name__:
                out[name] = obj
    return out


def _chain(video):
    from ComfyTV.nodes.stages.fx_chain import FXChainStage
    return FXChainStage.execute(project_id='p1', video=video)


def _unpack(value):
    from ComfyTV.nodes.stages.common import unpack_fx_video
    return unpack_fx_video(value)


def _frames_mean(view_url, n=8):
    from ComfyTV.runners.media import localize
    vals = []
    with av.open(str(localize(view_url))) as c:
        for frame in c.decode(c.streams.video[0]):
            vals.append(float(frame.to_ndarray(format='rgb24').mean()))
            if len(vals) >= n:
                break
    assert vals
    return sum(vals) / len(vals)


@pytest.mark.parametrize("cls_name", NEW_CLASSES)
def test_define_schema(cls_name):
    classes = _classes()
    assert cls_name in classes
    classes[cls_name].define_schema()


class TestVideo360:
    def test_identity_when_same_projection(self, clip):
        cls = _classes()["Video360Stage"]
        out = cls.execute(project_id='p1', proj_in='flat', proj_out='flat',
                          video=clip)
        _url, entries = _unpack(out.values[0])
        assert entries == []

    def test_projection_renders(self, clip):
        cls = _classes()["Video360Stage"]
        v = cls.execute(project_id='p1', proj_in='equirect', proj_out='flat',
                        v360_yaw=30.0, video=clip).values[0]
        _url, entries = _unpack(v)
        assert entries and entries[0]['specs'][0][0] == 'v360'
        out = _chain(v)
        assert out.values[0].startswith('/view?')


class TestCDL:
    def test_neutral_is_identity(self, clip):
        cls = _classes()["CDLStage"]
        out = cls.execute(project_id='p1', video=clip)
        _url, entries = _unpack(out.values[0])
        assert entries == []

    def test_slope_changes_mean(self, clip):
        cls = _classes()["CDLStage"]
        v = cls.execute(project_id='p1', slope_r=0.3, slope_g=0.3,
                        slope_b=0.3, video=clip).values[0]
        out = _chain(v)
        assert _frames_mean(out.values[0]) < _frames_mean(clip) - 5

    def test_cdl_frame_formula(self):
        import torch
        from ComfyTV.runners.video_color_ops import cdl_frame
        img = torch.full((4, 4, 3), 0.25)
        out = cdl_frame(img, [2.0, 1.0, 1.0], [0.0, 0.1, 0.0],
                        [1.0, 1.0, 2.0], 1.0)
        assert out[0, 0, 0].item() == pytest.approx(0.5, abs=1e-5)
        assert out[0, 0, 1].item() == pytest.approx(0.35, abs=1e-5)
        assert out[0, 0, 2].item() == pytest.approx(0.0625, abs=1e-5)

    def test_saturation_zero_is_gray(self):
        import torch
        from ComfyTV.runners.video_color_ops import cdl_frame
        img = torch.rand(8, 8, 3)
        out = cdl_frame(img, [1, 1, 1], [0, 0, 0], [1, 1, 1], 0.0)
        assert (out[..., 0] - out[..., 1]).abs().max() < 1e-5
        assert (out[..., 1] - out[..., 2]).abs().max() < 1e-5


class TestHistogramEq:
    def test_zero_strength_identity(self, clip):
        cls = _classes()["HistogramEqStage"]
        out = cls.execute(project_id='p1', strength=0.0, video=clip)
        _url, entries = _unpack(out.values[0])
        assert entries == []

    def test_equalize_renders(self, clip):
        cls = _classes()["HistogramEqStage"]
        v = cls.execute(project_id='p1', strength=1.0, video=clip).values[0]
        out = _chain(v)
        assert out.values[0].startswith('/view?')

    def test_flat_image_stays_flat(self):
        import torch
        from ComfyTV.runners.video_color_ops import histeq_frame
        img = torch.full((16, 16, 3), 0.5)
        out = histeq_frame(img, strength=1.0)
        assert torch.isfinite(out).all()
        assert (out >= 0).all() and (out <= 1).all()


class TestAudioDuck:
    def test_duck_renders(self, clip, voice_clip):
        cls = _classes()["AudioDuckStage"]
        out = cls.execute(project_id='p1', video=clip,
                          sidechain_video=voice_clip)
        url = out.values[0]
        from ComfyTV.runners.media import localize
        with av.open(str(localize(url))) as c:
            assert c.streams.audio
            dur = float(c.duration or 0) / 1_000_000
        assert dur > 0.5

    def test_duck_no_mixback(self, clip, voice_clip):
        cls = _classes()["AudioDuckStage"]
        out = cls.execute(project_id='p1', video=clip,
                          sidechain_video=voice_clip, mix_back=False)
        assert out.values[0].startswith('/view?')


class TestHueCorrectDomains:
    def test_sat_vs_sat_desaturates(self):
        import torch
        from ComfyTV.runners.video_color_ops import (
            build_hue_luts, hue_correct_frame,
        )
        img = torch.tensor([[[0.9, 0.1, 0.1]]], dtype=torch.float32)
        luts = build_hue_luts({'sat_sat': [[0.0, 0.0], [1.0, 0.0]]})
        out = hue_correct_frame(img, luts)
        assert (out[0, 0, 0] - out[0, 0, 1]).abs() < 0.02

    def test_lum_vs_lum_brightens(self):
        import torch
        from ComfyTV.runners.video_color_ops import (
            build_hue_luts, hue_correct_frame,
        )
        img = torch.full((2, 2, 3), 0.25)
        luts = build_hue_luts({'lum_lum': [[0.0, 2.0], [1.0, 2.0]]})
        out = hue_correct_frame(img, luts)
        assert out.mean().item() == pytest.approx(0.5, abs=0.02)


class TestProcedural:
    def test_perlin_deterministic_and_bounded(self):
        from ComfyTV.runners.procedural import perlin3, perm_table
        ys, xs = np.mgrid[0:32, 0:32].astype(np.float64) / 8.0
        p1 = perm_table(7)
        a = perlin3(xs, ys, np.float64(0.3), p1)
        b = perlin3(xs, ys, np.float64(0.3), perm_table(7))
        c = perlin3(xs, ys, np.float64(0.3), perm_table(8))
        assert np.allclose(a, b)
        assert not np.allclose(a, c)
        assert np.abs(a).max() <= 1.0
        assert a.std() > 0.05

    def test_fbm_turbulence_nonnegative(self):
        from ComfyTV.runners.procedural import fbm3, perm_table
        ys, xs = np.mgrid[0:32, 0:32].astype(np.float64) / 8.0
        v = fbm3(xs, ys, 0.0, perm_table(3), octaves=4, turbulence=True)
        assert (v >= 0).all()

    def test_cellular_bounds(self):
        from ComfyTV.runners.procedural import cellular2
        ys, xs = np.mgrid[0:32, 0:32].astype(np.float64) / 6.0
        v = cellular2(xs, ys, 0.2, 5)
        assert (v >= 0).all() and (v <= 1).all()
        assert v.std() > 0.05

    @pytest.mark.parametrize("kind", ['perlin', 'turbulence', 'cellular',
                                      'plasma'])
    def test_pattern_kinds_render(self, kind):
        from ComfyTV.nodes.stages.video_generate import PatternStage
        out = PatternStage.execute(
            project_id='p1', kind=kind, width=96, height=64, fps=12,
            duration=0.5, noise_scale=24, noise_octaves=3, seed=3)
        assert out.values[0].startswith('/view?')
        assert _frames_mean(out.values[0]) > 1


class TestLumaMaps:
    def test_all_kinds_normalized(self):
        from ComfyTV.runners.luma_maps import LUMA_MAP_KINDS, luma_map
        for kind in LUMA_MAP_KINDS:
            m = luma_map(kind, 64, 48)
            assert m.shape == (48, 64), kind
            assert m.min() == pytest.approx(0.0, abs=1e-5), kind
            assert m.max() == pytest.approx(1.0, abs=1e-5), kind

    def test_transition_builtin_luma(self, clip, voice_clip):
        from ComfyTV.nodes.stages.video_timeline import VideoTransitionStage
        out = VideoTransitionStage.execute(
            project_id='p1', luma_map='clock', duration=0.5,
            video_a=clip, video_b=voice_clip)
        assert out.values[0].startswith('/view?')


class TestShapeMask:
    def test_chain_stencil(self, clip):
        classes = _classes()
        from ComfyTV.nodes.stages.video_masking import ShapeMaskStage
        v = ShapeMaskStage.execute(
            project_id='p1', map_kind='radial', threshold=0.4,
            video=clip).values[0]
        _url, entries = _unpack(v)
        assert entries and entries[0]['op'] == 'shape_mask'
        out = _chain(v)
        assert _frames_mean(out.values[0]) < _frames_mean(clip)

    def test_matte_output_gray(self, clip):
        from ComfyTV.nodes.stages.video_masking import ShapeMaskStage
        v = ShapeMaskStage.execute(
            project_id='p1', map_kind='linear_x', output='matte',
            video=clip).values[0]
        out = _chain(v)
        from ComfyTV.runners.media import localize
        with av.open(str(localize(out.values[0]))) as c:
            frame = next(c.decode(c.streams.video[0]))
            arr = frame.to_ndarray(format='rgb24').astype(np.float32)
        assert abs(arr[..., 0].mean() - arr[..., 1].mean()) < 3

    def test_side_image_local_render(self, clip):
        from PIL import Image
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.nodes.stages.video_masking import ShapeMaskStage
        d = Path(folder_paths.get_output_directory()) / 'r5-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'shape_map.png'
        if not p.exists():
            arr = np.tile(np.linspace(0, 255, 64, dtype=np.uint8), (48, 1))
            Image.fromarray(arr, mode='L').save(p)
        out = ShapeMaskStage.execute(
            project_id='p1', threshold=0.5, video=clip,
            shape_image=media.path_to_view_url(p))
        assert out.values[0].startswith('/view?')


class TestOptics:
    def test_lens_identity_grid(self):
        import torch
        from ComfyTV.runners.optics import build_lens_grid, sample_with_grid
        img = torch.rand(48, 64, 3)
        grid = build_lens_grid(48, 64, k1=0.0, k2=0.0)
        out = sample_with_grid(img, grid)
        assert (out - img).abs().max() < 1e-4

    def test_lens_barrel_moves_pixels(self):
        import torch
        from ComfyTV.runners.optics import build_lens_distort_fn
        img = torch.zeros(64, 64, 3)
        img[28:36, 28:36] = 1.0
        img[2:6, 2:6] = 1.0
        fn = build_lens_distort_fn({'k1': 0.4, 'direction': 'undistort'})
        out = fn(img, 0.0)
        assert (out[30:34, 30:34] > 0.5).all()
        assert (out - img).abs().mean() > 0.001

    def test_lens_distort_roundtrip(self):
        import torch
        from ComfyTV.runners.optics import build_lens_distort_fn
        img = torch.rand(1, 1, 3).repeat(64, 64, 1)
        ys = torch.linspace(0, 1, 64).unsqueeze(1).repeat(1, 64)
        img[..., 0] = ys
        fwd = build_lens_distort_fn({'k1': 0.2, 'direction': 'undistort'})
        inv = build_lens_distort_fn({'k1': 0.2, 'direction': 'distort'})
        out = inv(fwd(img, 0), 0)
        center = (slice(16, 48), slice(16, 48))
        assert (out[center] - img[center]).abs().mean() < 0.02

    def test_chroma_ab_splits_channels(self):
        import torch
        from ComfyTV.runners.optics import build_chroma_ab_fn
        img = torch.zeros(64, 64, 3)
        img[:, 40:44] = 1.0
        fn = build_chroma_ab_fn({'amount': 0.03})
        out = fn(img, 0.0)
        assert (out[..., 0] - out[..., 2]).abs().max() > 0.1

    def test_lens_flare_adds_light(self):
        import torch
        from ComfyTV.runners.optics import build_lens_flare_fn
        img = torch.zeros(48, 64, 3)
        fn = build_lens_flare_fn({'pos_x': 0.7, 'pos_y': 0.3,
                                  'intensity': 1.0})
        out = fn(img, 0.0)
        assert out.max() > 0.5
        assert out.mean() > 0.001

    def test_optics_nodes_chain(self, clip):
        from ComfyTV.nodes.stages.video_optics import (
            ChromaticAberrationStage, LensDistortStage, LensFlareStage,
        )
        v = LensDistortStage.execute(project_id='p1', k1=0.3,
                                     video=clip).values[0]
        v = ChromaticAberrationStage.execute(project_id='p1', amount=0.02,
                                             video=v).values[0]
        v = LensFlareStage.execute(project_id='p1', intensity=1.0,
                                   video=v).values[0]
        _url, entries = _unpack(v)
        assert [e['op'] for e in entries] == \
            ['lens_distort', 'chroma_ab', 'lens_flare']
        out = _chain(v)
        assert out.values[0].startswith('/view?')
        assert _frames_mean(out.values[0]) > _frames_mean(clip)


class TestZDefocus:
    def test_focus_zone_stays_sharp(self):
        import torch
        from ComfyTV.runners.zdefocus import build_zdefocus_fn
        img = torch.zeros(64, 64, 3)
        img[:, ::4] = 1.0
        depth = torch.zeros(64, 64)
        depth[:, 32:] = 1.0

        def depth_for(i, t):
            return depth

        fn = build_zdefocus_fn(depth_for, focus_depth=0.0, focus_range=0.2,
                               max_radius=10)
        out = fn(img, 0.0)
        left_diff = (out[:, :24] - img[:, :24]).abs().mean()
        right_diff = (out[:, 40:] - img[:, 40:]).abs().mean()
        assert left_diff < 0.01
        assert right_diff > 0.05

    def test_node_with_depth_image(self, clip):
        from PIL import Image
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.nodes.stages.video_optics import ZDefocusStage
        d = Path(folder_paths.get_output_directory()) / 'r5-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'depth_ramp.png'
        if not p.exists():
            arr = np.tile(np.linspace(0, 255, 320, dtype=np.uint8), (240, 1))
            Image.fromarray(arr, mode='L').save(p)
        out = ZDefocusStage.execute(
            project_id='p1', focus_depth=0.2, max_radius=8, layers=5,
            video=clip, depth_image=media.path_to_view_url(p))
        assert out.values[0].startswith('/view?')

    def test_node_requires_depth(self, clip):
        from ComfyTV.nodes.stages.video_optics import ZDefocusStage
        with pytest.raises(RuntimeError, match="depth"):
            ZDefocusStage.execute(project_id='p1', video=clip)

    def test_occlusion_order_with_inverted_depth(self):
        import torch
        from ComfyTV.runners.zdefocus import build_zdefocus_fn
        img = torch.zeros(64, 64, 3)
        img[24:40, 24:40] = 1.0
        depth = torch.zeros(64, 64)
        depth[24:40, 24:40] = 0.5

        def depth_for(i, t):
            return depth

        fn = build_zdefocus_fn(depth_for, focus_depth=0.0, focus_range=0.1,
                               max_radius=8, layers=6, invert_depth=True)
        out = fn(img, 0.0)
        assert out[30:34, 30:34].mean().item() > 0.4


class TestFaceAndSpot:
    def test_face_blur_renders(self, clip):
        from ComfyTV.nodes.stages.video_masking import FaceBlurStage
        out = FaceBlurStage.execute(project_id='p1', mode='pixelate',
                                    recheck=6, video=clip)
        assert out.values[0].startswith('/view?')

    def test_spot_remover_edge_blend(self, clip):
        from ComfyTV.nodes.stages.video_masking import SpotRemoverStage
        out = SpotRemoverStage.execute(
            project_id='p1', rect_x=0.4, rect_y=0.4, rect_w=0.2, rect_h=0.2,
            video=clip)
        assert out.values[0].startswith('/view?')

    def test_spot_remover_flattens_region(self):
        import torch
        from ComfyTV.runners.face_tools import spot_remove_video  # noqa: F401
        import cv2
        arr = np.zeros((64, 64, 3), dtype=np.uint8)
        arr[28:36, 28:36] = 255
        img = torch.from_numpy(arr.astype(np.float32) / 255.0)
        from ComfyTV.runners import face_tools as ft
        fn_holder = {}

        def fake_process(url, fn, progress=None):
            fn_holder['fn'] = fn
            return '/view?ok'

        orig = ft.torch_process_video if hasattr(ft, 'torch_process_video') \
            else None
        import ComfyTV.runners.media_torch as mt
        real = mt.torch_process_video
        mt.torch_process_video = fake_process
        try:
            ft.spot_remove_video('mem://x', rect=(0.4, 0.4, 0.2, 0.2),
                                 feather=0.0)
        finally:
            mt.torch_process_video = real
        del orig, cv2
        out = fn_holder['fn'](img, 0.0)
        assert out[30, 30].max().item() < 0.2


class TestParticles:
    def test_sim_deterministic(self):
        from ComfyTV.runners.particles import ParticleSim
        p = {'rate': 200.0, 'seed': 11, 'warmup': 0.5}
        a = ParticleSim(p, 160, 120, 24)
        b = ParticleSim(dict(p), 160, 120, 24)
        a.advance_to(1.0)
        b.advance_to(1.0)
        assert a.parts['x'].size == b.parts['x'].size > 10
        assert np.allclose(a.parts['x'], b.parts['x'])
        la = a.render_layer(120, 160)
        lb = b.render_layer(120, 160)
        assert np.allclose(la, lb)
        assert la.max() > 0.2

    def test_sim_gravity_pulls_down(self):
        from ComfyTV.runners.particles import ParticleSim
        p = {'rate': 100.0, 'seed': 3, 'warmup': 0.0, 'gravity': 400.0,
             'speed': 0.0, 'lifetime': 5.0, 'e_y0': 0.2}
        sim = ParticleSim(p, 100, 100, 24)
        sim.advance_to(0.0)
        sim.advance_to(0.3)
        assert sim.parts['y'].size > 0
        y_early = sim.parts['y'].mean()
        sim.advance_to(1.5)
        assert sim.parts['y'].mean() > y_early + 5

    def test_particles_chain_render(self, clip):
        from ComfyTV.nodes.stages.video_particles import ParticlesStage
        v = ParticlesStage.execute(
            project_id='p1', rate=150.0, size=10.0, warmup=0.5,
            video=clip).values[0]
        _url, entries = _unpack(v)
        assert entries and entries[0]['op'] == 'particles'
        out = _chain(v)
        assert _frames_mean(out.values[0]) > _frames_mean(clip) + 0.5

    def test_zero_rate_identity(self, clip):
        from ComfyTV.nodes.stages.video_particles import ParticlesStage
        out = ParticlesStage.execute(project_id='p1', rate=0.0, video=clip)
        _url, entries = _unpack(out.values[0])
        assert entries == []

    def test_attractor_pulls(self):
        from ComfyTV.runners.particles import ParticleSim
        base = {'rate': 150.0, 'seed': 5, 'warmup': 0.0, 'gravity': 0.0,
                'speed': 0.0, 'lifetime': 6.0, 'e_x0': 0.2, 'e_y0': 0.5,
                'drag': 0.0, 'turbulence': 0.0}
        free = ParticleSim(dict(base), 200, 100, 24)
        free.advance_to(0.0)
        free.advance_to(2.0)
        pulled = ParticleSim(dict(base, attract_strength=400.0,
                                  attract_x=0.9, attract_y=0.5,
                                  attract_radius=1.5), 200, 100, 24)
        pulled.advance_to(0.0)
        pulled.advance_to(2.0)
        assert pulled.parts['x'].mean() > free.parts['x'].mean() + 5

    def test_floor_bounce_keeps_above(self):
        from ComfyTV.runners.particles import ParticleSim
        p = {'rate': 100.0, 'seed': 2, 'warmup': 0.0, 'gravity': 500.0,
             'speed': 0.0, 'lifetime': 8.0, 'e_y0': 0.1,
             'collide': 'bounce', 'floor_y': 0.5, 'bounce': 0.6,
             'turbulence': 0.0}
        sim = ParticleSim(p, 100, 100, 24)
        sim.advance_to(0.0)
        sim.advance_to(3.0)
        assert sim.parts['y'].size > 0
        assert sim.parts['y'].max() <= 51.0

    def test_sub_on_death_spawns(self):
        from ComfyTV.runners.particles import ParticleSim
        p = {'rate': 40.0, 'seed': 9, 'warmup': 0.0, 'lifetime': 0.3,
             'sub_mode': 'on_death', 'sub_count': 6, 'sub_lifetime': 2.0,
             'turbulence': 0.0}
        sim = ParticleSim(p, 100, 100, 24)
        sim.advance_to(0.0)
        sim.advance_to(1.0)
        assert (sim.parts['kind'] >= 0.5).sum() > 5

    def test_circle_emitter_on_ring(self):
        from ComfyTV.runners.particles import ParticleSim
        p = {'rate': 300.0, 'seed': 4, 'warmup': 0.0, 'speed': 0.0,
             'gravity': 0.0, 'turbulence': 0.0, 'lifetime': 5.0,
             'emitter': 'circle', 'e_x0': 0.5, 'e_y0': 0.5,
             'e_x1': 0.8, 'e_y1': 0.5}
        sim = ParticleSim(p, 200, 200, 24)
        sim.advance_to(0.0)
        sim.advance_to(0.3)
        d = np.hypot(sim.parts['x'] - 100, sim.parts['y'] - 100)
        assert abs(d.mean() - 60) < 2

    def test_size_curve_applies(self):
        from ComfyTV.runners.particles import ParticleSim
        curve = json.dumps([{'t': 0, 'v': 0.1}, {'t': 0.5, 'v': 2.0},
                            {'t': 1, 'v': 0.1}])
        p = {'rate': 60.0, 'seed': 3, 'warmup': 0.0, 'lifetime': 2.0,
             'size_curve': curve, 'turbulence': 0.0}
        sim = ParticleSim(p, 100, 100, 24)
        sim.advance_to(0.0)
        sim.advance_to(1.0)
        frac, sizes, _o, _c = sim.snapshot()
        mid = (frac > 0.4) & (frac < 0.6)
        young = frac < 0.1
        if mid.any() and young.any():
            assert sizes[mid].mean() > sizes[young].mean()

    def test_mask_edge_local_render(self, clip):
        from PIL import Image
        import folder_paths
        from ComfyTV.runners import media
        from ComfyTV.nodes.stages.video_particles import ParticlesStage
        d = Path(folder_paths.get_output_directory()) / 'r5-src'
        d.mkdir(parents=True, exist_ok=True)
        p = d / 'pmask.png'
        if not p.exists():
            arr = np.zeros((240, 320), dtype=np.uint8)
            arr[80:160, 100:220] = 255
            Image.fromarray(arr, mode='L').save(p)
        out = ParticlesStage.execute(
            project_id='p1', rate=200.0, warmup=0.5, video=clip,
            mask_image=media.path_to_view_url(p))
        assert out.values[0].startswith('/view?')

    def test_mask_edge_points_on_border(self):
        from ComfyTV.runners.particles import mask_edge_points
        m = np.zeros((60, 80), dtype=np.float32)
        m[20:40, 30:50] = 1.0
        pts = mask_edge_points(m)
        assert pts is not None and len(pts) > 20
        on_border = ((pts[:, 0] == 30) | (pts[:, 0] == 49)
                     | (pts[:, 1] == 20) | (pts[:, 1] == 39))
        assert on_border.mean() > 0.9

    def test_renderers_render(self, clip):
        from ComfyTV.runners.particles import ParticleSim
        for renderer in ('stretched', 'trail'):
            p = {'rate': 80.0, 'seed': 6, 'warmup': 0.5, 'speed': 200.0,
                 'renderer': renderer}
            sim = ParticleSim(p, 160, 120, 24)
            sim.advance_to(0.5)
            layer = sim.render_layer(120, 160)
            assert layer.max() > 0.1, renderer


class TestRotoPaintUpgrades:
    def test_stroke_lifespan(self, clip):
        from ComfyTV.nodes.stages.video_masking import PaintStrokeStage
        strokes = json.dumps([{
            'mode': 'color', 'color': '#00FF00', 'radius': 60,
            'points': [{'x': 80, 'y': 60}, {'x': 240, 'y': 180}],
            'life_start': 0.0, 'life_end': 0.3,
        }])
        out = PaintStrokeStage.execute(project_id='p1', strokes=strokes,
                                       video=clip)
        from ComfyTV.runners.media import localize
        greens = []
        with av.open(str(localize(out.values[0]))) as c:
            for frame in c.decode(c.streams.video[0]):
                arr = frame.to_ndarray(format='rgb24').astype(np.float32)
                greens.append(arr[..., 1].mean() - arr[..., 0].mean())
        assert greens[0] > greens[-1] + 3

    def test_reveal_stroke(self, clip, voice_clip):
        from ComfyTV.nodes.stages.video_masking import PaintStrokeStage
        strokes = json.dumps([{
            'mode': 'reveal', 'radius': 80,
            'points': [{'x': 100, 'y': 80}, {'x': 200, 'y': 160}],
        }])
        out = PaintStrokeStage.execute(project_id='p1', strokes=strokes,
                                       video=clip, reveal_video=voice_clip)
        assert out.values[0].startswith('/view?')

    def test_reveal_requires_source(self, clip):
        from ComfyTV.nodes.stages.video_masking import PaintStrokeStage
        strokes = json.dumps([{
            'mode': 'reveal', 'radius': 40,
            'points': [{'x': 50, 'y': 50}],
        }])
        with pytest.raises(RuntimeError, match="reveal"):
            PaintStrokeStage.execute(project_id='p1', strokes=strokes,
                                     video=clip)

    def test_per_point_feather(self):
        from ComfyTV.runners.roto import rasterize_mask
        pts = [
            {'x': 40, 'y': 20, 'f': 2.0},
            {'x': 120, 'y': 20, 'f': 30.0},
            {'x': 120, 'y': 100, 'f': 30.0},
            {'x': 40, 'y': 100, 'f': 2.0},
        ]
        m = rasterize_mask(pts, 160, 120)
        left_band = ((m[50:70, 30:50] > 0.05) & (m[50:70, 30:50] < 0.95)).mean()
        right_band = ((m[50:70, 110:130] > 0.05)
                      & (m[50:70, 110:130] < 0.95)).mean()
        assert right_band > left_band


class TestCieScope:
    def test_cie_scope_outputs_image(self, clip):
        from ComfyTV.nodes.stages.video_analysis import VideoScopesStage
        out = VideoScopesStage.execute(project_id='p1', scope='cie',
                                       video=clip)
        assert out.values[0].startswith('/view?')
