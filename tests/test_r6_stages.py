"""Roadmap-6 sprint: expression, time magic, select0r/keymix, stylize pack."""
import json
from pathlib import Path

import pytest

av = pytest.importorskip("av")
np = pytest.importorskip("numpy")
torch = pytest.importorskip("torch")

from test_media_concat import _write_clip  # noqa: E402

NEW_CLASSES = [
    "SlitScanStage", "FeedbackFXStage", "StrobeStage", "ExpressionStage",
    "Select0rStage", "ArtFXStage", "GlitchFXStage", "KaleidoscopeStage",
    "WaveWarpStage", "WaterStage", "LightGraffitiStage",
]


@pytest.fixture()
def clip():
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'r6-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / 'r6_clip.mp4'
    if not p.exists():
        _write_clip(p, w=320, h=240, fps=24, seconds=1.5, with_audio=True)
    return media.path_to_view_url(p)


def _solid_clip(name, rgb, seconds=0.5, w=64, h=64, fps=24):
    from ComfyTV.runners import media
    import folder_paths
    src_dir = Path(folder_paths.get_output_directory()) / 'r6-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / name
    if not p.exists():
        with av.open(str(p), 'w') as c:
            s = c.add_stream('libx264', rate=fps)
            s.width, s.height = w, h
            s.pix_fmt = 'yuv420p'
            arr = np.zeros((h, w, 3), dtype=np.uint8)
            arr[..., 0], arr[..., 1], arr[..., 2] = rgb
            for _ in range(int(seconds * fps)):
                f = av.VideoFrame.from_ndarray(arr, format='rgb24')
                for pkt in s.encode(f):
                    c.mux(pkt)
            for pkt in s.encode():
                c.mux(pkt)
    return media.path_to_view_url(p)


def _mask_image(name, value=255):
    from ComfyTV.runners import media
    import folder_paths
    from PIL import Image
    src_dir = Path(folder_paths.get_output_directory()) / 'r6-src'
    src_dir.mkdir(parents=True, exist_ok=True)
    p = src_dir / name
    if not p.exists():
        Image.new('L', (64, 64), value).save(str(p))
    return media.path_to_view_url(p)


def _classes():
    from ComfyTV.nodes.stages import (
        video_timefx, video_artfx, video_keying, expression_stage,
    )
    import inspect
    out = {}
    for mod in (video_timefx, video_artfx, video_keying, expression_stage):
        for name, obj in inspect.getmembers(mod):
            if inspect.isclass(obj) and hasattr(obj, "define_schema") \
                    and obj.__module__ == mod.__name__:
                out[name] = obj
    return out


def _unpack(value):
    from ComfyTV.nodes.stages.common import unpack_fx_video
    return unpack_fx_video(value)


def _decode_frames(view_url, n=999):
    from ComfyTV.runners.media import localize
    frames = []
    with av.open(str(localize(view_url))) as c:
        for frame in c.decode(c.streams.video[0]):
            frames.append(frame.to_ndarray(format='rgb24'))
            if len(frames) >= n:
                break
    assert frames
    return frames


@pytest.mark.parametrize("cls_name", NEW_CLASSES)
def test_define_schema(cls_name):
    classes = _classes()
    assert cls_name in classes
    classes[cls_name].define_schema()


class TestExpression:
    def test_basic_math(self):
        from ComfyTV.runners.expression import SafeExpression
        e = SafeExpression("sin(t*2)*10 + frame/fps")
        v = e.evaluate(frame=24, t=1.0, duration=5.0, fps=24.0)
        import math
        assert abs(v - (math.sin(2.0) * 10 + 1.0)) < 1e-9

    def test_step_functions(self):
        from ComfyTV.runners.expression import SafeExpression
        e = SafeExpression("smoothstep(t, 0, 1)")
        assert e.evaluate(0, 0.0, 1, 24) == 0.0
        assert e.evaluate(0, 1.0, 1, 24) == 1.0
        assert abs(e.evaluate(0, 0.5, 1, 24) - 0.5) < 1e-9
        e2 = SafeExpression("boxstep(t, 0.5)")
        assert e2.evaluate(0, 0.4, 1, 24) == 0.0
        assert e2.evaluate(0, 0.6, 1, 24) == 1.0

    def test_noise_deterministic(self):
        from ComfyTV.runners.expression import SafeExpression
        a = SafeExpression("noise(t*3)", seed=5)
        b = SafeExpression("noise(t*3)", seed=5)
        c = SafeExpression("noise(t*3)", seed=6)
        va = [a.evaluate(0, t / 10, 1, 24) for t in range(10)]
        vb = [b.evaluate(0, t / 10, 1, 24) for t in range(10)]
        vc = [c.evaluate(0, t / 10, 1, 24) for t in range(10)]
        assert va == vb
        assert va != vc
        assert all(0.0 <= v <= 1.0 for v in va)

    def test_conditional_and_compare(self):
        from ComfyTV.runners.expression import SafeExpression
        e = SafeExpression("10 if t > 0.5 else -10")
        assert e.evaluate(0, 0.6, 1, 24) == 10
        assert e.evaluate(0, 0.4, 1, 24) == -10

    @pytest.mark.parametrize("bad", [
        "__import__('os')",
        "().__class__",
        "lambda: 1",
        "[1,2][0]",
        "'abc'",
        "unknown_fn(1)",
        "open('x')",
        "t.__class__",
    ])
    def test_rejects_unsafe(self, bad):
        from ComfyTV.runners.expression import SafeExpression
        with pytest.raises(RuntimeError):
            SafeExpression(bad)

    def test_zero_division_and_nan(self):
        from ComfyTV.runners.expression import SafeExpression
        assert SafeExpression("1/t").evaluate(0, 0.0, 1, 24) == 0.0

    def test_keyframes_output(self):
        from ComfyTV.runners.expression import expression_keyframes
        raw = expression_keyframes("t*2", field='scale', duration=1.0,
                                   rate=10.0)
        keys = json.loads(raw)
        assert len(keys) == 11
        assert keys[0]['t'] == 0.0
        assert keys[5]['scale'] == pytest.approx(1.0, abs=1e-4)
        assert all(k['interp'] == 'linear' for k in keys)

    def test_stage_execute(self):
        cls = _classes()["ExpressionStage"]
        out = cls.execute(project_id='p1', expression="t*4", field='y',
                          duration=2.0, rate=5.0)
        keys = json.loads(out.values[0])
        assert keys[-1]['y'] == pytest.approx(8.0, abs=1e-3)


class TestSlitScan:
    def test_map_mode_needs_image(self, clip):
        cls = _classes()["SlitScanStage"]
        with pytest.raises(RuntimeError, match="retime image"):
            cls.execute(project_id='p1', mode='map', video=clip)

    def test_horizontal_render(self, clip):
        cls = _classes()["SlitScanStage"]
        out = cls.execute(project_id='p1', mode='horizontal', gain=6.0,
                          filter_mode='linear', video=clip)
        frames = _decode_frames(out.values[0], n=4)
        assert frames[0].shape == (240, 320, 3)

    def test_window_cap(self, clip):
        from ComfyTV.runners.time_fx import slitscan_video
        with pytest.raises(RuntimeError, match="window too large"):
            slitscan_video(clip, gain=240.0, offset=60.0)


class TestFeedback:
    def _img(self, v=0.5):
        return torch.full((32, 48, 3), float(v))

    def test_vertigo_feedback_blend(self):
        from ComfyTV.runners.time_fx import build_feedback_fn
        fn = build_feedback_fn({'mode': 'vertigo', 'zoom': 0.1,
                                'feedback_mix': 0.75})
        a = fn(self._img(1.0), 0.0)
        assert a.shape == (32, 48, 3)
        b = fn(torch.zeros(32, 48, 3), 1 / 24)
        assert float(b.mean()) > 0.5

    def test_echo_first_frame_identity(self):
        from ComfyTV.runners.time_fx import build_feedback_fn
        fn = build_feedback_fn({'mode': 'echo'})
        img = self._img(0.6)
        out = fn(img, 0.0)
        assert torch.allclose(out, img, atol=1e-5)

    def test_nervous_deterministic(self):
        from ComfyTV.runners.time_fx import build_feedback_fn

        def run():
            fn = build_feedback_fn({'mode': 'nervous', 'seed': 3,
                                    'style': 'shuffle'})
            outs = []
            for i in range(8):
                outs.append(fn(torch.full((8, 8, 3), i / 10.0), i / 24))
            return torch.stack(outs)

        assert torch.equal(run(), run())

    def test_nervous_scratch_walks(self):
        from ComfyTV.runners.time_fx import build_feedback_fn
        fn = build_feedback_fn({'mode': 'nervous', 'style': 'scratch',
                                'seed': 9})
        for i in range(12):
            out = fn(torch.full((8, 8, 3), i / 12.0), i / 24)
            assert out.shape == (8, 8, 3)


class TestStrobe:
    def test_pattern_black(self):
        from ComfyTV.runners.time_fx import build_strobe_fn
        fn = build_strobe_fn({'interval': 1, 'strobe_mode': 'black'})
        outs = [float(fn(torch.ones(4, 4, 3), i / 24).mean())
                for i in range(6)]
        assert outs == [1.0, 0.0, 1.0, 0.0, 1.0, 0.0]

    def test_hold_keeps_last_frame(self):
        from ComfyTV.runners.time_fx import build_strobe_fn
        fn = build_strobe_fn({'interval': 1, 'strobe_mode': 'hold'})
        a = fn(torch.full((4, 4, 3), 0.3), 0.0)
        b = fn(torch.full((4, 4, 3), 0.9), 1 / 24)
        assert float(a.mean()) == pytest.approx(0.3)
        assert float(b.mean()) == pytest.approx(0.3)

    def test_invert_and_white(self):
        from ComfyTV.runners.time_fx import build_strobe_fn
        fn = build_strobe_fn({'interval': 1, 'strobe_mode': 'white',
                              'invert': True})
        a = fn(torch.zeros(4, 4, 3), 0.0)
        b = fn(torch.zeros(4, 4, 3), 1 / 24)
        assert float(a.mean()) == 1.0
        assert float(b.mean()) == 0.0


class TestArtFX:
    def _ramp(self):
        x = torch.linspace(0, 1, 64).view(1, 64, 1).expand(48, 64, 3)
        return x.contiguous()

    def test_cartoon_quantizes(self):
        from ComfyTV.runners.stylize_fx import cartoon_frame
        out = cartoon_frame(torch.full((32, 32, 3), 0.5), threshold=0.5,
                            levels=4)
        vals = set(round(v, 4) for v in out.flatten().tolist())
        assert vals == {0.5}

    def test_cartoon_edges_black(self):
        from ComfyTV.runners.stylize_fx import cartoon_frame
        img = torch.zeros(32, 32, 3)
        img[:, 16:] = 1.0
        out = cartoon_frame(img, threshold=0.3, levels=8)
        assert float(out[16, 16].mean()) == 0.0

    def test_emboss_grayscale(self):
        from ComfyTV.runners.stylize_fx import emboss_frame
        out = emboss_frame(self._ramp())
        assert torch.allclose(out[..., 0], out[..., 1])
        assert torch.allclose(out[..., 1], out[..., 2])

    def test_charcoal_flat_is_white(self):
        from ComfyTV.runners.stylize_fx import charcoal_frame
        out = charcoal_frame(torch.full((32, 32, 3), 0.5))
        assert float(out.mean()) > 0.99

    def test_halftone_range(self):
        from ComfyTV.runners.stylize_fx import halftone_frame
        out = halftone_frame(self._ramp(), dot_radius=3.0)
        assert float(out.min()) >= 0.0
        assert float(out.max()) <= 1.0


class TestGlitch:
    def test_deterministic(self):
        from ComfyTV.runners.stylize_fx import glitch_frame
        img = torch.rand(48, 64, 3, generator=torch.Generator()
                         .manual_seed(1))
        a = glitch_frame(img, 3, seed=7, chance=1.0)
        b = glitch_frame(img, 3, seed=7, chance=1.0)
        c = glitch_frame(img, 4, seed=7, chance=1.0)
        assert torch.equal(a, b)
        assert not torch.equal(a, c)

    def test_stage_identity_when_zero_chance(self, clip):
        cls = _classes()["GlitchFXStage"]
        out = cls.execute(project_id='p1', chance=0.0, video=clip)
        _url, entries = _unpack(out.values[0])
        assert entries == []


class TestKaleidoscope:
    def test_single_segment_identity(self):
        from ComfyTV.runners.stylize_fx import build_kaleido_fn
        fn = build_kaleido_fn({'segments': 1})
        img = torch.rand(32, 48, 3, generator=torch.Generator()
                         .manual_seed(2))
        out = fn(img, 0.0)
        assert float((out - img).abs().mean()) < 0.05

    def test_fold_symmetry(self):
        from ComfyTV.runners.stylize_fx import build_kaleido_fn
        fn = build_kaleido_fn({'segments': 4, 'center_x': 0.5,
                               'center_y': 0.5})
        img = torch.rand(64, 64, 3, generator=torch.Generator()
                         .manual_seed(3))
        out = fn(img, 0.0)
        upper = out[24, 32]
        lower = out[40, 32]
        assert torch.allclose(upper, lower, atol=0.05)


class TestWaveWarp:
    def test_zero_amplitude_stage_identity(self, clip):
        cls = _classes()["WaveWarpStage"]
        out = cls.execute(project_id='p1', amplitude=0.0, video=clip)
        _url, entries = _unpack(out.values[0])
        assert entries == []

    def test_parabolic_edges_stable(self):
        from ComfyTV.runners.stylize_fx import wave_warp_frame
        img = torch.rand(48, 64, 3, generator=torch.Generator()
                         .manual_seed(4))
        out = wave_warp_frame(img, 0.3, amplitude=20.0, axis='horizontal',
                              envelope='parabolic')
        assert torch.allclose(out[:, 0], img[:, 0], atol=1e-4)
        assert torch.allclose(out[:, -1], img[:, -1], atol=1e-4)
        assert not torch.allclose(out[:, 32], img[:, 32], atol=1e-3)


class TestWater:
    def test_stage_identity_without_sources(self, clip):
        cls = _classes()["WaterStage"]
        out = cls.execute(project_id='p1', rain=False, swirl=False,
                          video=clip)
        _url, entries = _unpack(out.values[0])
        assert entries == []

    def test_rain_perturbs_over_time(self):
        from ComfyTV.runners.stylize_fx import build_water_fn
        fn = build_water_fn({'rain': True, 'rain_every': 1,
                             'amplitude': 0.8, 'seed': 5})
        img = torch.rand(48, 64, 3, generator=torch.Generator()
                         .manual_seed(5))
        outs = [fn(img, i / 24) for i in range(6)]
        assert not torch.allclose(outs[-1], img, atol=1e-3)


class TestLightGraffiti:
    def test_accumulates_light(self):
        from ComfyTV.runners.stylize_fx import build_light_graffiti_fn
        fn = build_light_graffiti_fn({'threshold': 0.9,
                                      'sum_threshold': 2.5})
        dark = torch.zeros(16, 16, 3)
        lit = dark.clone()
        lit[8, 8] = 1.0
        fn(lit, 0.0)
        out = fn(dark, 1 / 24)
        assert float(out[8, 8].mean()) == pytest.approx(1.0)
        assert float(out[0, 0].mean()) == 0.0

    def test_decay_fades(self):
        from ComfyTV.runners.stylize_fx import build_light_graffiti_fn
        fn = build_light_graffiti_fn({'threshold': 0.9,
                                      'sum_threshold': 2.5, 'decay': 0.5})
        lit = torch.zeros(16, 16, 3)
        lit[8, 8] = 1.0
        fn(lit, 0.0)
        dark = torch.zeros(16, 16, 3)
        out1 = fn(dark, 1 / 24)
        out2 = fn(dark, 2 / 24)
        assert float(out2[8, 8].mean()) < float(out1[8, 8].mean())


class TestSelect0r:
    def test_center_selected(self):
        from ComfyTV.runners.keying import select0r_math, select0r_params
        p = select0r_params(key_color='#00FF00', space='rgb',
                            shape='ellipsoid', edge='hard')
        img = torch.zeros(4, 4, 3)
        img[..., 1] = 1.0
        img[0, 0] = torch.tensor([1.0, 0.0, 0.0])
        _pre, alpha = select0r_math(img, p)
        assert float(alpha[2, 2]) == 1.0
        assert float(alpha[0, 0]) == 0.0

    def test_invert(self):
        from ComfyTV.runners.keying import select0r_math, select0r_params
        p = select0r_params(key_color='#00FF00', edge='hard', invert=True)
        img = torch.zeros(2, 2, 3)
        img[..., 1] = 1.0
        _pre, alpha = select0r_math(img, p)
        assert float(alpha.max()) == 0.0

    def test_hci_hue_wrap(self):
        from ComfyTV.runners.keying import select0r_math, select0r_params
        p = select0r_params(key_color='#FF0000', space='hci', edge='hard',
                            delta_1=0.08, delta_2=1.0, delta_3=1.0)
        img = torch.zeros(1, 2, 3)
        img[0, 0] = torch.tensor([1.0, 0.02, 0.0])
        img[0, 1] = torch.tensor([1.0, 0.0, 0.02])
        _pre, alpha = select0r_math(img, p)
        assert float(alpha[0, 0]) == 1.0
        assert float(alpha[0, 1]) == 1.0

    def test_edge_soft_monotonic(self):
        from ComfyTV.runners.keying import select0r_math, select0r_params
        p = select0r_params(key_color='#808080', space='rgb', edge='skiny',
                            delta_1=0.5, delta_2=0.5, delta_3=0.5)
        img = torch.tensor([[[0.5, 0.5, 0.5], [0.6, 0.6, 0.6],
                             [0.8, 0.8, 0.8]]])
        _pre, alpha = select0r_math(img, p)
        a = alpha.flatten().tolist()
        assert a[0] > a[1] > a[2]

    def test_stage_emits_torch_spec(self, clip):
        cls = _classes()["Select0rStage"]
        out = cls.execute(project_id='p1', key_color='#00FF00', video=clip)
        _url, entries = _unpack(out.values[0])
        assert entries and entries[-1]['op'] == 'select0r'
        assert entries[-1]['engine'] == 'torch'


class TestKeyMixOps:
    def test_unknown_op_raises(self):
        from ComfyTV.runners.keying import keymix_videos
        with pytest.raises(RuntimeError, match="unknown alpha op"):
            keymix_videos('a', 'b', 'm', alpha_op='divide')

    def test_subtract_removes_a(self):
        from ComfyTV.runners.keying import keymix_videos
        a = _solid_clip('white.mp4', (255, 255, 255))
        b = _solid_clip('black.mp4', (0, 0, 0))
        mask = _mask_image('mask_white.png', 255)
        url = keymix_videos(a, b, mask, alpha_op='subtract')
        frames = _decode_frames(url, n=3)
        assert frames[0].mean() < 20

    def test_over_keeps_a(self):
        from ComfyTV.runners.keying import keymix_videos
        a = _solid_clip('white.mp4', (255, 255, 255))
        b = _solid_clip('black.mp4', (0, 0, 0))
        mask = _mask_image('mask_white.png', 255)
        url = keymix_videos(a, b, mask, alpha_op='over')
        frames = _decode_frames(url, n=3)
        assert frames[0].mean() > 230


class TestGateWeave:
    def test_zero_amount_identity(self):
        from ComfyTV.runners.video_stylize_ops import gate_weave_shift
        img = torch.rand(16, 16, 3, generator=torch.Generator()
                         .manual_seed(6))
        out = gate_weave_shift(img, 0.5, amount_x=0.0, amount_y=0.0)
        assert torch.equal(out, img)

    def test_deterministic_and_moving(self):
        from ComfyTV.runners.video_stylize_ops import gate_weave_shift
        img = torch.rand(32, 32, 3, generator=torch.Generator()
                         .manual_seed(7))
        a1 = gate_weave_shift(img, 0.2, amount_x=4.0, amount_y=4.0, seed=3)
        a2 = gate_weave_shift(img, 0.2, amount_x=4.0, amount_y=4.0, seed=3)
        b = gate_weave_shift(img, 0.5, amount_x=4.0, amount_y=4.0, seed=3)
        assert torch.equal(a1, a2)
        assert not torch.equal(a1, b)


class TestChainIntegration:
    @pytest.mark.parametrize("entry", [
        {'op': 'strobe', 'params': {'interval': 2, 'strobe_mode': 'black'}},
        {'op': 'feedback', 'params': {'mode': 'echo'}},
        {'op': 'artfx', 'params': {'mode': 'cartoon'}},
        {'op': 'kaleido', 'params': {'segments': 6}},
        {'op': 'wave_warp', 'params': {'amplitude': 10.0}},
        {'op': 'glitch', 'params': {'chance': 1.0, 'seed': 3}},
        {'op': 'water', 'params': {'rain': True, 'amplitude': 0.5}},
        {'op': 'light_graffiti', 'params': {'threshold': 0.8}},
        {'op': 'select0r', 'params': {'key_color': '#00FF00'}},
    ])
    def test_torch_ops_render(self, clip, entry):
        from ComfyTV.runners.fx_chain_exec import run_fx_chain
        spec = {'engine': 'torch', 'domain': 'video', 'specs': [], **entry}
        url = run_fx_chain(clip, [spec])
        frames = _decode_frames(url, n=2)
        assert frames[0].shape == (240, 320, 3)

    def test_old_film_weave_param_flows(self, clip):
        from ComfyTV.runners.fx_chain_exec import run_fx_chain
        spec = {'engine': 'torch', 'domain': 'video', 'specs': [],
                'op': 'old_film',
                'params': {'weave_x': 6.0, 'weave_y': 6.0, 'lines_num': 0,
                           'delta': 0, 'every': 0}}
        url = run_fx_chain(clip, [spec])
        frames = _decode_frames(url, n=2)
        assert frames[0].shape == (240, 320, 3)


BACKLOG_CLASSES = [
    "Card3DStage", "RegrainStage", "Video360StabilizeStage",
    "ContactSheetStage", "STMapGenStage",
]


def _classes_b():
    from ComfyTV.nodes.stages import (
        video_optics, video_stylize, video_analysis,
    )
    import inspect
    out = {}
    for mod in (video_optics, video_stylize, video_analysis):
        for name, obj in inspect.getmembers(mod):
            if inspect.isclass(obj) and hasattr(obj, "define_schema") \
                    and obj.__module__ == mod.__name__:
                out[name] = obj
    return out


@pytest.mark.parametrize("cls_name", BACKLOG_CLASSES)
def test_backlog_define_schema(cls_name):
    classes = _classes_b()
    assert cls_name in classes
    classes[cls_name].define_schema()


class TestLensModels:
    @pytest.mark.parametrize("model", ["pf_barrel", "3de_classic",
                                       "3de_radial", "panotools"])
    def test_zero_coeffs_identity(self, model):
        from ComfyTV.runners.optics import build_lens_grid
        grid = build_lens_grid(32, 48, model=model, direction="undistort")
        xs = torch.linspace(-1, 1, 48)
        assert torch.allclose(grid[16, :, 0], xs, atol=1e-4)

    @pytest.mark.parametrize("model", ["pf_barrel", "3de_classic",
                                       "3de_radial", "panotools"])
    def test_roundtrip(self, model):
        from ComfyTV.runners.optics import (
            _poly_forward, _newton_invert_2d,
        )
        fwd = _poly_forward(model, {"k1": 0.15, "k2": -0.05,
                                    "squeeze": 1.0})
        x = torch.linspace(-0.6, 0.6, 9)
        y = torch.linspace(-0.4, 0.4, 9)
        xi, yi = _newton_invert_2d(fwd, x, y)
        xr, yr = fwd(xi, yi)
        assert float((xr - x).abs().max()) < 1e-4
        assert float((yr - y).abs().max()) < 1e-4

    def test_stmap_generation(self):
        import cv2
        from ComfyTV.runners.optics import lens_stmap_image
        from ComfyTV.runners.media import localize
        url = lens_stmap_image(64, 32, {"model": "nuke_k1k2", "k1": 0.0})
        arr = cv2.imread(str(localize(url)), cv2.IMREAD_UNCHANGED)
        assert arr.dtype.name == "uint16"
        assert arr.shape == (32, 64, 3)
        r = arr[..., 2].astype(float) / 65535.0
        assert r[16, 0] < 0.05
        assert r[16, -1] > 0.95
        assert abs(r[16, 32] - 0.5) < 0.02


class TestCard3D:
    def test_identity_defaults(self):
        from ComfyTV.runners.optics import build_card3d_fn
        fn = build_card3d_fn({})
        img = torch.rand(36, 64, 3, generator=torch.Generator()
                         .manual_seed(11))
        out = fn(img, 0.0)
        assert float((out[4:-4, 4:-4] - img[4:-4, 4:-4]).abs().mean()) < 0.02

    def test_rotation_changes_image(self):
        from ComfyTV.runners.optics import build_card3d_fn
        fn = build_card3d_fn({"ry": 35.0})
        img = torch.rand(36, 64, 3, generator=torch.Generator()
                         .manual_seed(12))
        out = fn(img, 0.0)
        assert not torch.allclose(out, img, atol=0.02)

    def test_stage_identity(self, clip):
        cls = _classes_b()["Card3DStage"]
        out = cls.execute(project_id="p1", video=clip)
        _url, entries = _unpack(out.values[0])
        assert entries == []


class TestRegrain:
    def test_deterministic(self):
        from ComfyTV.runners.stylize_fx import build_regrain_fn
        img = torch.full((32, 32, 3), 0.5)
        a = build_regrain_fn({"seed": 3})(img, 0.0)
        b = build_regrain_fn({"seed": 3})(img, 0.0)
        c = build_regrain_fn({"seed": 4})(img, 0.0)
        assert torch.equal(a, b)
        assert not torch.equal(a, c)

    def test_band_response(self):
        from ComfyTV.runners.stylize_fx import build_regrain_fn
        fn = build_regrain_fn({"shadows": 0.0, "midtones": 0.0,
                               "highlights": 1.0, "grain_size": 0.0})
        black = torch.zeros(32, 32, 3)
        assert torch.equal(fn(black, 0.0), black)
        white = torch.full((32, 32, 3), 0.95)
        assert not torch.equal(build_regrain_fn(
            {"shadows": 0.0, "midtones": 0.0, "highlights": 1.0,
             "grain_size": 0.0})(white, 0.0), white)


class TestVideo360Stab:
    def test_yaw_grid_is_horizontal_roll(self):
        import math as m
        from ComfyTV.runners.video360_stab import _rotation_grid
        h, w = 32, 64
        img = torch.rand(h, w, 3, generator=torch.Generator()
                         .manual_seed(13))
        shift = 8
        yaw = shift / w * 2.0 * m.pi
        grid = _rotation_grid(h, w, yaw, 0.0, "cpu", torch.float32)
        src = img.permute(2, 0, 1).unsqueeze(0)
        out = torch.nn.functional.grid_sample(
            src, grid.unsqueeze(0), mode="bilinear",
            padding_mode="border", align_corners=False)
        out = out.squeeze(0).permute(1, 2, 0)
        rolled = torch.roll(img, shifts=-shift, dims=1)
        mid = slice(8, 24)
        assert float((out[mid, 8:-8] - rolled[mid, 8:-8]).abs().mean()) \
            < 0.06

    def test_e2e(self, clip):
        from ComfyTV.runners.video360_stab import stabilize_360_video
        url = stabilize_360_video(clip, smoothing=5)
        frames = _decode_frames(url, n=2)
        assert frames[0].shape == (240, 320, 3)


class TestContactSheet:
    def test_sheet_layout(self, clip):
        from ComfyTV.runners.contact_sheet import contact_sheet_image
        from ComfyTV.runners.media import localize
        from PIL import Image
        url = contact_sheet_image(clip, cols=3, rows=2, sheet_width=600)
        with Image.open(str(localize(url))) as im:
            assert im.width == (600 // 3) * 3 + 2 * 4
            cell_h = round((600 // 3) * 240 / 320)
            assert im.height == cell_h * 2 + 2 * 3

    def test_stage(self, clip):
        cls = _classes_b()["ContactSheetStage"]
        out = cls.execute(project_id="p1", cols=2, rows=2, sheet_width=400,
                          video=clip)
        assert out.values[0].startswith("/view")


class TestBacklogChainOps:
    @pytest.mark.parametrize("entry", [
        {"op": "card3d", "params": {"ry": 25.0}},
        {"op": "regrain", "params": {"shadows": 0.5}},
        {"op": "lens_distort", "params": {"model": "3de_classic",
                                          "k1": 0.1, "direction": "distort"}},
    ])
    def test_render(self, clip, entry):
        from ComfyTV.runners.fx_chain_exec import run_fx_chain
        spec = {"engine": "torch", "domain": "video", "specs": [], **entry}
        url = run_fx_chain(clip, [spec])
        frames = _decode_frames(url, n=2)
        assert frames[0].shape == (240, 320, 3)
