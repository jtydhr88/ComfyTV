from __future__ import annotations

import pytest

from ComfyTV.runners import local_comfy as lc
from ComfyTV.runners.base import RunnerContext
from ComfyTV.runners._workflow_resolve import KEEP_ORIGINAL


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

    def test_option_missing_numeric_cast_keeps_original(self):
        r = self._r(self._ctx())
        for cast in ("int", "float"):
            v = r.resolve("x.y", {"from": "option:missing", "cast": cast})
            assert v is KEEP_ORIGINAL

    def test_option_missing_str_cast_writes_empty(self):
        r = self._r(self._ctx())
        assert r.resolve("x.y", {"from": "option:missing", "cast": "str"}) == ""
        assert r.resolve("x.y", {"from": "option:missing"}) == ""

    def test_cast_failure_carries_context(self):
        r = self._r(self._ctx(options={"seed": "abc"}))
        with pytest.raises(RuntimeError, match=r"x\.y: cannot cast 'abc' \(from option:seed\) to int"):
            r.resolve("x.y", {"from": "option:seed", "cast": "int"})

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
            "ComfyTV.runners._workflow_resolve._composite_masked_image",
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
            "ComfyTV.runners._workflow_resolve._composite_masked_image",
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

    def test_no_output_node_raises(self):
        wf = {"1": {"class_type": "KSampler", "inputs": {}}}
        with pytest.raises(RuntimeError, match="auto-detect this workflow's result"):
            lc._auto_detect_result(wf, "image")

    def test_skips_non_dict_entries(self):
        wf = {
            "_meta": "not a node",
            "9": {"class_type": "SaveImage", "inputs": {}},
        }
        assert lc._auto_detect_result(wf, "image")["node"] == "9"

    def test_text_previewany_graph_output_first(self):
        wf = {
            "1": {"class_type": "TextGenerate", "inputs": {}},
            "3": {"class_type": "PreviewAny", "inputs": {}},
        }
        assert lc._auto_detect_result(wf, "text") == {
            "type": "graph_output_first", "node": "3",
        }

    def test_text_showtext_detected(self):
        wf = {"4": {"class_type": "ShowText|pysssss", "inputs": {}}}
        assert lc._auto_detect_result(wf, "text") == {
            "type": "graph_output_first", "node": "4",
        }

    def test_savetext_preferred_over_previewany(self):
        wf = {
            "3": {"class_type": "PreviewAny", "inputs": {}},
            "8": {"class_type": "SaveText", "inputs": {}},
        }
        assert lc._auto_detect_result(wf, "text") == {
            "type": "graph_output_first", "node": "8",
        }

    def test_media_save_node_beats_text_node(self):
        wf = {
            "3": {"class_type": "PreviewAny", "inputs": {}},
            "9": {"class_type": "SaveImage", "inputs": {}},
        }
        assert lc._auto_detect_result(wf, "image") == {
            "type": "ui_save_batch", "node": "9",
        }
