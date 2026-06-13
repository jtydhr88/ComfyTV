"""Unit tests for runners/local_comfy.py — the resolver, the value-cast
layer, prune/override logic, auto-detect, and result extraction.
"""

from __future__ import annotations

import json
import pytest

from ComfyTV.runners import local_comfy as lc
from ComfyTV.runners.base import RunnerContext


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
        assert annotated.startswith("painter/comfytv-masked-")
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


# ─── _Resolver ───────────────────────────────────────────────────────────────

class TestResolver:
    def _ctx(self, **kw):
        defaults = dict(
            kind="image",
            main_prompt="forest at dawn",
            upstream={"images": [], "videos": [], "audio": [], "texts": []},
            options={"resolution": "1024", "aspect_ratio": "1:1",
                     "duration_s": 4, "seed": 42},
        )
        defaults.update(kw)
        return RunnerContext(**defaults)

    def _r(self, ctx, sizing=None):
        return lc._Resolver({"sizing": sizing or {"base": 512, "snap": 8}}, ctx)

    def test_main_prompt(self):
        r = self._r(self._ctx())
        assert r.resolve("x.y", {"from": "main_prompt"}) == "forest at dawn"

    def test_main_prompt_empty_falls_to_default(self):
        r = self._r(self._ctx(main_prompt=""))
        v = r.resolve("x.y", {"from": "main_prompt", "default": "fallback"})
        assert v == "fallback"

    def test_option_existing(self):
        r = self._r(self._ctx(options={"seed": 7, "aspect_ratio": "1:1",
                                       "resolution": "1024", "duration_s": 4}))
        assert r.resolve("x.y", {"from": "option:seed", "cast": "int"}) == 7

    def test_option_missing_falls_to_default(self):
        r = self._r(self._ctx())
        v = r.resolve("x.y", {"from": "option:missing", "default": "abc"})
        assert v == "abc"

    def test_option_empty_string_falls_to_default(self):
        r = self._r(self._ctx(options={"lyrics": "", "aspect_ratio": "1:1",
                                       "resolution": "1024", "duration_s": 4}))
        v = r.resolve("x.y", {"from": "option:lyrics", "default": "default text"})
        assert v == "default text"

    def test_computed_width_height(self):
        r = self._r(self._ctx())
        assert r.resolve("x.w", {"from": "computed:width"}) == 512
        assert r.resolve("x.h", {"from": "computed:height"}) == 512

    def test_computed_width_caches(self):
        r = self._r(self._ctx())
        a = r.resolve("a", {"from": "computed:width"})
        # mutate options after first call — cached result wins
        r.ctx.options["aspect_ratio"] = "16:9"
        b = r.resolve("b", {"from": "computed:width"})
        assert a == b

    def test_computed_length(self):
        sizing = {"type": "video", "fps": 24, "frames_divisor": 1,
                  "short_side_by_tier": {"720p": 720}}
        r = self._r(self._ctx(), sizing=sizing)
        assert r.resolve("x.l", {"from": "computed:length"}) == 96

    def test_upstream_image_annotated_index0(self):
        r = self._r(self._ctx(upstream={
            "images": ["/view?filename=a.png&subfolder=&type=output"],
            "videos": [], "audio": [], "texts": [],
        }))
        v = r.resolve("x.y", {"from": "upstream_image:annotated"})
        assert v == "a.png [output]"

    def test_upstream_image_indexed(self):
        r = self._r(self._ctx(upstream={
            "images": [
                "/view?filename=a.png&subfolder=&type=output",
                "/view?filename=b.png&subfolder=&type=output",
            ],
            "videos": [], "audio": [], "texts": [],
        }))
        v = r.resolve("x.y", {"from": "upstream_image:annotated[1]"})
        assert v == "b.png [output]"

    def test_upstream_text_value(self):
        r = self._r(self._ctx(upstream={
            "images": [], "videos": [], "audio": [], "texts": ["hello"],
        }))
        v = r.resolve("x.y", {"from": "upstream_text:value"})
        assert v == "hello"

    def test_upstream_audio_string_unwrap(self):
        # audio bucket may be a single string instead of list — resolver
        # should normalise it.
        r = self._r(self._ctx(upstream={
            "images": [], "videos": [],
            "audio": "/view?filename=song.mp3&subfolder=&type=output",
            "texts": [],
        }))
        v = r.resolve("x.y", {"from": "upstream_audio:annotated"})
        assert v == "song.mp3 [output]"

    def test_upstream_out_of_bounds_falls_to_default(self):
        r = self._r(self._ctx(upstream={
            "images": [], "videos": [], "audio": [], "texts": [],
        }))
        v = r.resolve("x.y", {"from": "upstream_image:annotated[2]", "default": "x.png"})
        assert v == "x.png"

    def test_upstream_image_masked(self, monkeypatch):
        calls = []
        monkeypatch.setattr(
            lc, "_composite_masked_image",
            lambda url, mask: calls.append((url, mask)) or "painter/combined.png [input]",
        )
        r = self._r(self._ctx(
            upstream={"images": ["/view?filename=a.png&subfolder=&type=output"],
                      "videos": [], "audio": [], "texts": []},
            options={"mask_data": "painter/m.png [input]"},
        ))
        v = r.resolve("x.y", {"from": "upstream_image:masked[0]"})
        assert v == "painter/combined.png [input]"
        assert calls == [("/view?filename=a.png&subfolder=&type=output",
                          "painter/m.png [input]")]

    def test_upstream_image_masked_caches_composite(self, monkeypatch):
        calls = []
        monkeypatch.setattr(
            lc, "_composite_masked_image",
            lambda url, mask: calls.append(url) or "painter/combined.png [input]",
        )
        r = self._r(self._ctx(
            upstream={"images": ["/view?filename=a.png&subfolder=&type=output"],
                      "videos": [], "audio": [], "texts": []},
            options={"mask_data": "painter/m.png [input]"},
        ))
        r.resolve("a", {"from": "upstream_image:masked[0]"})
        r.resolve("b", {"from": "upstream_image:masked[0]"})
        assert len(calls) == 1

    def test_upstream_image_masked_empty_mask_hits_required(self):
        r = self._r(self._ctx(
            upstream={"images": ["/view?filename=a.png&subfolder=&type=output"],
                      "videos": [], "audio": [], "texts": []},
            options={},
        ))
        with pytest.raises(RuntimeError, match="paint a mask first"):
            r.resolve("x.y", {"from": "upstream_image:masked[0]",
                              "required": True, "error": "paint a mask first"})

    def test_masked_on_non_image_kind_raises(self):
        r = self._r(self._ctx(upstream={
            "images": [], "videos": ["/view?filename=v.mp4&type=output"],
            "audio": [], "texts": [],
        }))
        with pytest.raises(RuntimeError, match="only valid for upstream_image"):
            r.resolve("x.y", {"from": "upstream_video:masked[0]"})

    def test_literal(self):
        r = self._r(self._ctx())
        assert r.resolve("x.y", {"from": "literal:abc.safetensors"}) == "abc.safetensors"

    def test_literal_with_colon_in_value(self):
        # Only first colon splits, second one survives in the literal value.
        r = self._r(self._ctx())
        assert r.resolve("x.y", {"from": "literal:foo:bar"}) == "foo:bar"

    def test_unknown_source_raises(self):
        r = self._r(self._ctx())
        with pytest.raises(RuntimeError, match="unknown `from`"):
            r.resolve("x.y", {"from": "made_up_source"})

    def test_required_empty_raises(self):
        r = self._r(self._ctx(main_prompt=""))
        with pytest.raises(RuntimeError, match="required but empty"):
            r.resolve("x.y", {"from": "main_prompt", "required": True})

    def test_required_empty_uses_error_msg(self):
        r = self._r(self._ctx(main_prompt=""))
        with pytest.raises(RuntimeError, match="needs a prompt"):
            r.resolve("x.y", {"from": "main_prompt", "required": True,
                              "error": "needs a prompt"})

    def test_prefix_suffix(self):
        r = self._r(self._ctx())
        v = r.resolve("x.y", {"from": "main_prompt", "prefix": "[A] ", "suffix": " [B]"})
        assert v == "[A] forest at dawn [B]"

    def test_prefix_skipped_for_non_string(self):
        r = self._r(self._ctx(options={"seed": 7, "aspect_ratio": "1:1",
                                       "resolution": "1024", "duration_s": 4}))
        # cast=int after prefix would have failed if prefix had been applied.
        v = r.resolve("x.y", {"from": "option:seed", "prefix": "ZZ", "cast": "int"})
        assert v == 7

    def test_random_int_default_with_cast(self):
        r = self._r(self._ctx())
        v = r.resolve("x.y", {"from": "option:missing", "default": "random_int31",
                              "cast": "int"})
        assert isinstance(v, int)
        assert 0 <= v < 2**31


# ─── _auto_detect_result ─────────────────────────────────────────────────────

class TestAutoDetectResult:
    def test_saveimage_image_kind_is_batch(self):
        wf = {"9": {"class_type": "SaveImage", "inputs": {}}}
        assert lc._auto_detect_result(wf, "image") == {
            "type": "ui_save_batch", "node": "9",
        }

    def test_saveimage_inpaint_kind_is_url(self):
        wf = {"9": {"class_type": "SaveImage", "inputs": {}}}
        assert lc._auto_detect_result(wf, "inpaint") == {
            "type": "ui_save_url", "node": "9",
        }

    def test_save_video(self):
        wf = {"5": {"class_type": "SaveVideo", "inputs": {}}}
        assert lc._auto_detect_result(wf, "video") == {
            "type": "ui_save_url", "node": "5",
        }

    def test_save_audio_mp3(self):
        wf = {"7": {"class_type": "SaveAudioMP3", "inputs": {}}}
        assert lc._auto_detect_result(wf, "audio") == {
            "type": "ui_save_url", "node": "7",
        }

    def test_no_save_node_raises(self):
        wf = {"1": {"class_type": "KSampler", "inputs": {}}}
        with pytest.raises(RuntimeError, match="No save-class node"):
            lc._auto_detect_result(wf, "image")

    def test_skips_non_dict_entries(self):
        wf = {
            "_meta": "not a node",
            "9": {"class_type": "SaveImage", "inputs": {}},
        }
        assert lc._auto_detect_result(wf, "image")["node"] == "9"


# ─── _apply_prunes ───────────────────────────────────────────────────────────

class TestApplyPrunes:
    def _ctx(self, **kw):
        defaults = dict(
            kind="image", main_prompt="x",
            upstream={"images": [], "videos": [], "audio": [], "texts": []},
            options={},
        )
        defaults.update(kw)
        return RunnerContext(**defaults)

    def test_no_rules(self):
        wf = {"3": {"class_type": "LoadImage", "inputs": {"image": "x.png"}}}
        pruned = lc._apply_prunes(wf, {}, self._ctx())
        assert pruned == set()
        assert "3" in wf

    def test_prune_drops_nodes_when_upstream_missing(self):
        wf = {
            "load_ref2": {"class_type": "LoadImage", "inputs": {}},
            "scale_ref2": {"class_type": "ImageScale", "inputs": {}},
            "pos": {"class_type": "Qwen", "inputs": {"image2": ["load_ref2", 0]}},
        }
        cfg = {"prune_when_missing": [{
            "when": "upstream_image:annotated[1]",
            "drop_nodes": ["load_ref2", "scale_ref2"],
            "drop_inputs": [{"node": "pos", "input": "image2"}],
        }]}
        pruned = lc._apply_prunes(wf, cfg, self._ctx())
        assert pruned == {"load_ref2", "scale_ref2"}
        assert "load_ref2" not in wf
        assert "image2" not in wf["pos"]["inputs"]

    def test_prune_not_triggered_when_upstream_present(self):
        wf = {"load_ref2": {"class_type": "LoadImage", "inputs": {}}}
        cfg = {"prune_when_missing": [{
            "when": "upstream_image:annotated[1]",
            "drop_nodes": ["load_ref2"],
        }]}
        ctx = self._ctx(upstream={
            "images": ["/view?filename=a.png", "/view?filename=b.png"],
            "videos": [], "audio": [], "texts": [],
        })
        pruned = lc._apply_prunes(wf, cfg, ctx)
        assert pruned == set()
        assert "load_ref2" in wf

    def test_prune_skips_missing_node(self):
        cfg = {"prune_when_missing": [{
            "when": "upstream_image:annotated[1]",
            "drop_nodes": ["does_not_exist"],
        }]}
        pruned = lc._apply_prunes({}, cfg, self._ctx())
        assert pruned == set()  # we tried but nothing was there

    def test_bad_when_warned_and_skipped(self):
        cfg = {"prune_when_missing": [{"when": "garbage"}]}
        pruned = lc._apply_prunes({}, cfg, self._ctx())
        assert pruned == set()


# ─── _apply_overrides ────────────────────────────────────────────────────────

class TestApplyOverrides:
    def _ctx(self, **kw):
        defaults = dict(
            kind="image", main_prompt="hello",
            upstream={"images": [], "videos": [], "audio": [], "texts": []},
            options={"seed": 99, "aspect_ratio": "1:1", "resolution": "1024",
                     "duration_s": 4},
        )
        defaults.update(kw)
        return RunnerContext(**defaults)

    def test_writes_resolved_values(self):
        wf = {"3": {"class_type": "KSampler",
                    "inputs": {"seed": 0, "steps": 20}}}
        cfg = {"inputs": {"3": {"seed": {"from": "option:seed", "cast": "int"}}}}
        resolver = lc._Resolver(cfg, self._ctx())
        lc._apply_overrides(wf, cfg, resolver)
        assert wf["3"]["inputs"]["seed"] == 99

    def test_missing_node_is_skipped_not_raised(self):

        wf = {"3": {"class_type": "X", "inputs": {"seed": 0}}}
        cfg = {"inputs": {
            "NOT_A_NODE": {"x": {"from": "main_prompt"}},
            "3": {"seed": {"from": "option:seed", "cast": "int"}},
        }}
        resolver = lc._Resolver(cfg, self._ctx())
        lc._apply_overrides(wf, cfg, resolver)  # no raise
        assert wf["3"]["inputs"]["seed"] == 99
        assert "NOT_A_NODE" not in wf

    def test_missing_node_silenced_when_pruned(self):
        wf = {}
        cfg = {"inputs": {"gone_node": {"x": {"from": "main_prompt"}}}}
        resolver = lc._Resolver(cfg, self._ctx())
        # No raise — gone_node was pruned.
        lc._apply_overrides(wf, cfg, resolver, pruned_nodes={"gone_node"})

    def test_creates_inputs_dict_when_missing(self):
        wf = {"3": {"class_type": "X"}}  # no inputs key
        cfg = {"inputs": {"3": {"x": {"from": "literal:abc"}}}}
        resolver = lc._Resolver(cfg, self._ctx())
        lc._apply_overrides(wf, cfg, resolver)
        assert wf["3"]["inputs"]["x"] == "abc"


# ─── _view_url + _save_files_from ────────────────────────────────────────────

class TestSaveFilesFrom:
    def test_images_key(self):
        out = {"images": [{"filename": "a.png", "subfolder": "", "type": "output"}]}
        files = lc._save_files_from(out)
        assert files == [{"filename": "a.png", "subfolder": "", "type": "output"}]

    def test_audio_key(self):
        out = {"audio": [{"filename": "a.mp3", "subfolder": "", "type": "output"}]}
        assert lc._save_files_from(out)[0]["filename"] == "a.mp3"

    def test_videos_key(self):
        out = {"videos": [{"filename": "a.mp4", "subfolder": "", "type": "output"}]}
        assert lc._save_files_from(out)[0]["filename"] == "a.mp4"

    def test_gifs_key(self):
        out = {"gifs": [{"filename": "a.gif", "subfolder": "", "type": "output"}]}
        assert lc._save_files_from(out)[0]["filename"] == "a.gif"

    def test_empty(self):
        assert lc._save_files_from({}) == []
        assert lc._save_files_from(None) == []  # type: ignore[arg-type]

    def test_non_dict(self):
        assert lc._save_files_from("nope") == []  # type: ignore[arg-type]

    def test_first_nonempty_wins(self):
        # both images (empty) and audio (present) — audio wins because images is empty.
        out = {"images": [], "audio": [{"filename": "a.mp3"}]}
        assert lc._save_files_from(out)[0]["filename"] == "a.mp3"


class TestViewUrl:
    def test_basic(self):
        url = lc._view_url("a.png", "sub", "output")
        assert "filename=a.png" in url
        assert "subfolder=sub" in url
        assert "type=output" in url
        assert url.startswith("/view?")


# ─── _split_runner_id ────────────────────────────────────────────────────────

class TestSplitRunnerId:
    def test_simple(self):
        assert lc._split_runner_id("image/local-sd15") == ("image", "local-sd15")

    def test_slash_in_label(self):
        # First slash only.
        assert lc._split_runner_id("image/Local SD 1.5") == ("image", "Local SD 1.5")

    def test_no_slash_raises(self):
        with pytest.raises(RuntimeError, match="must be 'kind/name'"):
            lc._split_runner_id("nodash")


# ─── _extract_result ─────────────────────────────────────────────────────────

class _FakeExecutor:
    def __init__(self, history_outputs):
        self.history_result = {"outputs": history_outputs}


@pytest.mark.asyncio
class TestExtractResult:
    async def test_ui_save_url(self):
        ex = _FakeExecutor({
            "9": {"images": [
                {"filename": "out.png", "subfolder": "", "type": "output"},
            ]},
        })
        url = await lc._extract_result(ex, {"type": "ui_save_url", "node": "9"})
        assert "filename=out.png" in url

    async def test_ui_save_url_no_files_raises(self):
        ex = _FakeExecutor({"9": {}})
        with pytest.raises(RuntimeError, match="produced no files"):
            await lc._extract_result(ex, {"type": "ui_save_url", "node": "9"})

    async def test_ui_save_url_audio_node(self):
        # Confirm the audio key path inside _save_files_from is reached.
        ex = _FakeExecutor({
            "59": {"audio": [
                {"filename": "song.mp3", "subfolder": "", "type": "output"},
            ]},
        })
        url = await lc._extract_result(ex, {"type": "ui_save_url", "node": "59"})
        assert "filename=song.mp3" in url

    async def test_ui_save_batch(self):
        ex = _FakeExecutor({
            "9": {"images": [
                {"filename": "a.png", "subfolder": "", "type": "output"},
                {"filename": "b.png", "subfolder": "", "type": "output"},
            ]},
        })
        payload = await lc._extract_result(ex, {"type": "ui_save_batch", "node": "9"})
        data = json.loads(payload)
        assert len(data["images"]) == 2
        assert data["images"][0]["label"] == "#1"
        assert "filename=a.png" in data["images"][0]["image_url"]

    async def test_ui_save_batch_aggregates_multiple_save_nodes(self):
        ex = _FakeExecutor({
            "9":  {"images": [{"filename": "a.png", "subfolder": "", "type": "output"}]},
            "10": {"images": [{"filename": "b.png", "subfolder": "", "type": "output"}]},
        })
        payload = await lc._extract_result(ex, {"type": "ui_save_batch", "node": "9"})
        data = json.loads(payload)
        assert len(data["images"]) == 2

    async def test_ui_save_batch_no_files_raises(self):
        ex = _FakeExecutor({"9": {}})
        with pytest.raises(RuntimeError, match="produced no image files"):
            await lc._extract_result(ex, {"type": "ui_save_batch", "node": "9"})

    async def test_missing_node_raises(self):
        with pytest.raises(RuntimeError, match="result.node is required"):
            await lc._extract_result(_FakeExecutor({}), {"type": "ui_save_url"})

    async def test_unsupported_type_raises(self):
        ex = _FakeExecutor({})
        with pytest.raises(RuntimeError, match="unsupported result.type"):
            await lc._extract_result(ex, {"type": "weird", "node": "9"})


# ─── _output_node_ids ────────────────────────────────────────────────────────

class TestOutputNodeIds:
    def test_collects_hinted_plus_output_nodes(self, monkeypatch):
        import nodes as cn

        class _SaveLike:
            OUTPUT_NODE = True

        class _Plain:
            OUTPUT_NODE = False

        monkeypatch.setattr(cn, "NODE_CLASS_MAPPINGS", {
            "SaveImage": _SaveLike,
            "PreviewImage": _SaveLike,
            "KSampler": _Plain,
        })

        prompt = {
            "9":  {"class_type": "SaveImage"},
            "10": {"class_type": "PreviewImage"},
            "3":  {"class_type": "KSampler"},
        }
        ids = lc._output_node_ids(prompt, "9")
        assert ids[0] == "9"          # hint always first
        assert "10" in ids            # second output node included
        assert "3" not in ids         # non-output excluded

    def test_unknown_class_skipped(self, monkeypatch):
        import nodes as cn
        monkeypatch.setattr(cn, "NODE_CLASS_MAPPINGS", {})
        prompt = {"9": {"class_type": "Mystery"}}
        ids = lc._output_node_ids(prompt, "9")
        assert ids == ["9"]
