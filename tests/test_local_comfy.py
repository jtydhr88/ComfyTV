"""Unit tests for runners/local_comfy.py — the resolver, the value-cast
layer, prune/override logic, auto-detect, and result extraction.
"""

from __future__ import annotations

import pytest

from ComfyTV.runners import local_comfy as lc


# ─── _cast ───────────────────────────────────────────────────────────────────

class TestCast:
    def test_none_passes_value_through(self):
        assert lc._cast("hello", None) == "hello"
        assert lc._cast(42, None) == 42
        assert lc._cast(None, None) is None

    def test_int(self):
        assert lc._cast("20", "int") == 20
        assert lc._cast(3.7, "int") == 3
        assert lc._cast(True, "int") == 1

    def test_float(self):
        assert lc._cast("1.5", "float") == 1.5
        assert lc._cast(2, "float") == 2.0

    def test_str(self):
        assert lc._cast(42, "str") == "42"
        assert lc._cast(None, "str") == "None"

    def test_bool_truthy_strings(self):
        for s in ("true", "True", "1", "yes", "on", " ON ", "TRUE"):
            assert lc._cast(s, "bool") is True, s

    def test_bool_falsy_strings(self):
        for s in ("false", "False", "0", "no", "off", ""):
            assert lc._cast(s, "bool") is False, s

    def test_bool_real_bool(self):
        assert lc._cast(True, "bool") is True
        assert lc._cast(False, "bool") is False

    def test_unknown_cast_raises(self):
        with pytest.raises(RuntimeError, match="unknown cast"):
            lc._cast(1, "weird")


# ─── _resolve_default ────────────────────────────────────────────────────────

class TestResolveDefault:
    def test_passthrough(self):
        assert lc._resolve_default("hello") == "hello"
        assert lc._resolve_default(None) is None
        assert lc._resolve_default(42) == 42

    def test_random_int31(self):
        v = lc._resolve_default("random_int31")
        assert isinstance(v, int)
        assert 0 <= v < 2**31


# ─── _aspect_ratio_value ─────────────────────────────────────────────────────

class TestAspectRatio:
    def test_square(self):
        assert lc._aspect_ratio_value("1:1") == 1.0

    def test_wide(self):
        assert lc._aspect_ratio_value("16:9") == pytest.approx(16 / 9)

    def test_tall(self):
        assert lc._aspect_ratio_value("9:16") == pytest.approx(9 / 16)

    def test_bad_returns_one(self):
        assert lc._aspect_ratio_value("garbage") == 1.0
        assert lc._aspect_ratio_value("1:0") == 1.0
        assert lc._aspect_ratio_value(None) == 1.0  # type: ignore[arg-type]


# ─── _resolve_wh ─────────────────────────────────────────────────────────────

class TestResolveWH:
    def test_image_square_default(self):
        w, h = lc._resolve_wh({"base": 512, "snap": 8}, {"aspect_ratio": "1:1"})
        assert (w, h) == (512, 512)

    def test_image_wide(self):
        w, h = lc._resolve_wh({"base": 512, "snap": 8}, {"aspect_ratio": "16:9"})
        # 512 * 16/9 ≈ 910.2 → snapped to multiple of 8 → 904
        assert w == 904
        assert h == 512

    def test_image_tall(self):
        w, h = lc._resolve_wh({"base": 512, "snap": 8}, {"aspect_ratio": "9:16"})
        assert w == 512
        # 512 / (9/16) ≈ 910.2 → 904
        assert h == 904

    def test_tier_map_matches_resolution_options(self):
        from ComfyTV.nodes.stages.common.constants import RESOLUTIONS
        assert list(lc._SHORT_SIDE_BY_TIER.keys()) == list(RESOLUTIONS)

    def test_image_resolution_tier_changes_short_side(self):
        w, h = lc._resolve_wh(
            {"type": "image", "base": 512, "snap": 8},
            {"resolution": "1K", "aspect_ratio": "16:9"},
        )
        assert (w, h) == (1816, 1024)

    def test_image_resolution_tier_2k(self):
        w, h = lc._resolve_wh(
            {"type": "image", "base": 512, "snap": 8},
            {"resolution": "2K", "aspect_ratio": "1:1"},
        )
        assert (w, h) == (2048, 2048)

    def test_image_low_tier(self):
        w, h = lc._resolve_wh(
            {"type": "image", "base": 1024, "snap": 8},
            {"resolution": "480P", "aspect_ratio": "1:1"},
        )
        assert (w, h) == (480, 480)

    def test_image_no_resolution_falls_back_to_base(self):
        w, h = lc._resolve_wh(
            {"type": "image", "base": 768, "snap": 8},
            {"aspect_ratio": "1:1"},
        )
        assert (w, h) == (768, 768)

    def test_image_preset_tier_map_overrides_builtin(self):
        sizing = {
            "type": "image", "snap": 8,
            "short_side_by_tier": {"1K": 640},
        }
        w, h = lc._resolve_wh(sizing, {"resolution": "1K", "aspect_ratio": "1:1"})
        assert (w, h) == (640, 640)

    def test_video_tier_lookup(self):
        sizing = {
            "type": "video",
            "snap": 16,
            "short_side_by_tier": {"480p": 480, "720p": 720},
        }
        w, h = lc._resolve_wh(sizing, {"resolution": "720p", "aspect_ratio": "1:1"})
        assert (w, h) == (720, 720)

    def test_video_unknown_tier_falls_back_to_first(self):
        sizing = {
            "type": "video",
            "snap": 16,
            "short_side_by_tier": {"480p": 480, "720p": 720},
        }
        w, h = lc._resolve_wh(sizing, {"resolution": "unknown", "aspect_ratio": "1:1"})
        assert (w, h) == (480, 480)

    def test_floor_clamp(self):
        # Tiny base + giant aspect — must still respect the floor.
        w, h = lc._resolve_wh({"base": 1, "snap": 1}, {"aspect_ratio": "1:1"})
        assert w >= 16 and h >= 16


# ─── _resolve_length ─────────────────────────────────────────────────────────

class TestResolveLength:
    def test_basic(self):
        # 4 sec * 24 fps = 96. div=1 → no snap → 96
        assert lc._resolve_length({"fps": 24, "frames_divisor": 1}, {"duration_s": 4}) == 96

    def test_snap_to_divisor_plus_one(self):
        # 4 sec * 25 fps = 100. (100 - 1) % 8 = 99 % 8 = 3 → 100 + (8-3) = 105
        assert lc._resolve_length({"fps": 25, "frames_divisor": 8}, {"duration_s": 4}) == 105

    def test_already_aligned(self):
        # 25 fps, div=8: raw=100, (100-1)%8=3, return 100+(8-3)=105
        # Try a raw value already at div+1: duration_s would need to make raw=9, 17, etc.
        # fps=8, duration_s=1 → raw=8, (8-1)%8=7 → 8+(8-7)=9 ✓
        assert lc._resolve_length({"fps": 8, "frames_divisor": 8}, {"duration_s": 1}) == 9

    def test_no_options(self):
        # duration_s default 4
        assert lc._resolve_length({"fps": 24, "frames_divisor": 1}, {}) == 96


# ─── _view_url_to_annotated ──────────────────────────────────────────────────

class TestViewUrlAnnotated:
    def test_simple_output(self):
        got = lc._view_url_to_annotated(
            "/view?filename=foo.png&subfolder=&type=output"
        )
        assert got == "foo.png [output]"

    def test_with_subfolder(self):
        got = lc._view_url_to_annotated(
            "/view?filename=img.png&subfolder=runs/run1&type=temp"
        )
        assert got == "runs/run1/img.png [temp]"

    def test_default_type(self):
        got = lc._view_url_to_annotated("/view?filename=x.png&subfolder=")
        assert got.endswith("[output]")

    def test_filename_annotation_overrides_type_param(self):
        got = lc._view_url_to_annotated(
            "/view?filename=z-image-turbo_00087_.png+%5Boutput%5D&type=input"
        )
        assert got == "z-image-turbo_00087_.png [output]"

    def test_filename_annotation_with_subfolder(self):
        got = lc._view_url_to_annotated(
            "/view?filename=a.png+%5Btemp%5D&subfolder=runs&type=input"
        )
        assert got == "runs/a.png [temp]"

    def test_filename_annotation_not_doubled(self):
        got = lc._view_url_to_annotated(
            "/view?filename=b.png+%5Binput%5D&type=input"
        )
        assert got == "b.png [input]"

    def test_rejects_non_view_url(self):
        with pytest.raises(RuntimeError, match="must be a ComfyUI"):
            lc._view_url_to_annotated("http://example.com/x.png")

    def test_rejects_missing_filename(self):
        with pytest.raises(RuntimeError, match="no filename"):
            lc._view_url_to_annotated("/view?filename=&subfolder=x&type=output")

    def test_rejects_unknown_type(self):
        with pytest.raises(RuntimeError, match="unknown type"):
            lc._view_url_to_annotated("/view?filename=x.png&type=bogus")

    def test_rejects_non_string(self):
        with pytest.raises(RuntimeError):
            lc._view_url_to_annotated(None)  # type: ignore[arg-type]


class TestCompositeMaskedImage:
    @pytest.fixture()
    def fs(self, tmp_path, monkeypatch):
        import folder_paths

        def fake_annotated(name):
            base, _, kind = name.rpartition(" [")
            return str(tmp_path / kind.rstrip("]") / base)

        monkeypatch.setattr(folder_paths, "get_annotated_filepath",
                            fake_annotated, raising=False)
        monkeypatch.setattr(folder_paths, "get_input_directory",
                            lambda: str(tmp_path / "input"), raising=False)
        return tmp_path

    def _write_source(self, fs, size=(64, 64), color=(255, 0, 0)):
        from PIL import Image
        out = fs / "output"
        out.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", size, color).save(out / "src.png")
        return "/view?filename=src.png&subfolder=&type=output"

    def _write_mask(self, fs, size=(64, 64), hole=(8, 8, 24, 24)):
        """White opaque PNG with a transparent (painted) rectangle —
        the painter's export format."""
        from PIL import Image
        d = fs / "input" / "painter"
        d.mkdir(parents=True, exist_ok=True)
        m = Image.new("RGBA", size, (255, 255, 255, 255))
        if hole:
            m.paste((0, 0, 0, 0), hole)
        m.save(d / "mask.png")
        return "painter/mask.png [input]"

    def test_composites_alpha_into_source(self, fs):
        from PIL import Image
        url = self._write_source(fs)
        mask = self._write_mask(fs)

        annotated = lc._composite_masked_image(url, mask)
        assert annotated.startswith("comfytv/painter/comfytv-masked-")
        assert annotated.endswith(".png [input]")

        saved = Image.open(fs / "input" / annotated[: -len(" [input]")])
        assert saved.mode == "RGBA"
        assert saved.size == (64, 64)

        assert saved.getpixel((10, 10)) == (255, 0, 0, 0)
        assert saved.getpixel((40, 40)) == (255, 0, 0, 255)

    def test_mask_resized_to_image(self, fs):
        from PIL import Image
        url = self._write_source(fs, size=(128, 128))
        mask = self._write_mask(fs, size=(64, 64), hole=(0, 0, 32, 32))

        annotated = lc._composite_masked_image(url, mask)
        saved = Image.open(fs / "input" / annotated[: -len(" [input]")])
        assert saved.size == (128, 128)
        assert saved.getpixel((10, 10))[3] == 0      # inside scaled hole
        assert saved.getpixel((100, 100))[3] == 255  # outside

    def test_mask_without_alpha_raises(self, fs):
        from PIL import Image
        url = self._write_source(fs)
        d = fs / "input" / "painter"
        d.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (64, 64), (255, 255, 255)).save(d / "mask.png")
        with pytest.raises(RuntimeError, match="no alpha channel"):
            lc._composite_masked_image(url, "painter/mask.png [input]")

    def test_rejects_non_view_source(self, fs):
        mask = self._write_mask(fs)
        with pytest.raises(RuntimeError, match="must be a ComfyUI"):
            lc._composite_masked_image("not-a-url", mask)
