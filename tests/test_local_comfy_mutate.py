from __future__ import annotations

from datetime import datetime

import pytest

from ComfyTV.runners import local_comfy as lc
from ComfyTV.runners.base import RunnerContext


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

    def _h3_workflow(self):
        return {
            "load2": {"class_type": "LoadImage", "inputs": {}},
            "scale2": {"class_type": "ImageScale", "inputs": {"image": ["load2", 0]}},
            "clip": {"class_type": "CLIPLoader", "inputs": {}},
            "h3": {"class_type": "MiniMaxH3ReferenceToVideo", "inputs": {
                "clip": ["clip", 0],
                "ref_images.ref_image_0": ["clip", 0],
                "ref_images.ref_image_1": ["scale2", 0],
            }},
            "save": {"class_type": "SaveVideo", "inputs": {"video": ["h3", 0]}},
        }

    def test_drop_upstream_of_gcs_exclusive_chain(self, comfy_nodes):
        class _Save:
            OUTPUT_NODE = True
        comfy_nodes.NODE_CLASS_MAPPINGS["SaveVideo"] = _Save
        wf = self._h3_workflow()
        cfg = {"prune_when_missing": [{
            "when": "upstream_image:value[1]",
            "drop_upstream_of": [{"node": "h3", "input": "ref_images.ref_image_1"}],
        }]}
        pruned = lc._apply_prunes(wf, cfg, self._ctx())
        assert pruned == {"load2", "scale2"}
        assert "ref_images.ref_image_1" not in wf["h3"]["inputs"]
        assert set(wf) == {"clip", "h3", "save"}

    def test_drop_upstream_of_not_triggered_when_present(self, comfy_nodes):
        class _Save:
            OUTPUT_NODE = True
        comfy_nodes.NODE_CLASS_MAPPINGS["SaveVideo"] = _Save
        wf = self._h3_workflow()
        cfg = {"prune_when_missing": [{
            "when": "upstream_image:value[1]",
            "drop_upstream_of": [{"node": "h3", "input": "ref_images.ref_image_1"}],
        }]}
        ctx = self._ctx(upstream={
            "images": ["/view?filename=a.png", "/view?filename=b.png"],
            "videos": [], "audio": [], "texts": [],
        })
        pruned = lc._apply_prunes(wf, cfg, ctx)
        assert pruned == set()
        assert set(wf) == {"load2", "scale2", "clip", "h3", "save"}

    def test_drop_upstream_of_video_with_paired_audio(self, comfy_nodes):
        class _Save:
            OUTPUT_NODE = True
        comfy_nodes.NODE_CLASS_MAPPINGS["SaveVideo"] = _Save
        wf = {
            "loadvid": {"class_type": "LoadVideo", "inputs": {}},
            "getaud": {"class_type": "GetVideoComponents", "inputs": {"video": ["loadvid", 0]}},
            "h3": {"class_type": "MiniMaxH3ReferenceToVideo", "inputs": {
                "ref_videos.ref_video_0": ["getaud", 0],
                "ref_video_audios.ref_video_audio_0": ["getaud", 1],
            }},
            "save": {"class_type": "SaveVideo", "inputs": {"video": ["h3", 0]}},
        }
        cfg = {"prune_when_missing": [{
            "when": "upstream_video:value[0]",
            "drop_upstream_of": [
                {"node": "h3", "input": "ref_videos.ref_video_0"},
                {"node": "h3", "input": "ref_video_audios.ref_video_audio_0"},
            ],
        }]}
        pruned = lc._apply_prunes(wf, cfg, self._ctx())
        assert pruned == {"loadvid", "getaud"}
        assert wf["h3"]["inputs"] == {}
        assert set(wf) == {"h3", "save"}

    def test_gc_keeps_hinted_result_without_output_class(self, comfy_nodes):
        wf = {
            "deadload": {"class_type": "LoadImage", "inputs": {}},
            "gen": {"class_type": "SomethingCustom", "inputs": {
                "img": ["deadload", 0],
            }},
        }
        cfg = {
            "result": {"node": "gen"},
            "prune_when_missing": [{
                "when": "upstream_image:value[0]",
                "drop_upstream_of": [{"node": "gen", "input": "img"}],
            }],
        }
        pruned = lc._apply_prunes(wf, cfg, self._ctx())
        assert pruned == {"deadload"}
        assert set(wf) == {"gen"}


# ─── _auto_prune_unbound ─────────────────────────────────────────────────────

def _stub_class(required=(), output=False):
    req = tuple(required)

    class C:
        OUTPUT_NODE = output

        @classmethod
        def INPUT_TYPES(cls):
            return {"required": {k: ("X",) for k in req}, "optional": {}}

    return C


class TestAutoPruneUnbound:
    def _ctx(self, **kw):
        defaults = dict(
            kind="video", main_prompt="x",
            upstream={"images": [], "videos": [], "audio": [], "texts": []},
            options={},
        )
        defaults.update(kw)
        return RunnerContext(**defaults)

    def _register(self, comfy_nodes):
        comfy_nodes.NODE_CLASS_MAPPINGS.update({
            "LoadVideo": _stub_class(required=("file",)),
            "GetVideoComponents": _stub_class(required=("video",)),
            "MiniMaxH3ReferenceToVideo": _stub_class(required=("prompt",)),
            "SaveVideo": _stub_class(required=("video",), output=True),
            "LoadImage": _stub_class(required=("image",)),
            "SaveImage": _stub_class(required=("images",), output=True),
        })

    def _h3_video_workflow(self):
        return {
            "301": {"class_type": "LoadVideo", "inputs": {"file": "sample.mp4"}},
            "302": {"class_type": "GetVideoComponents",
                    "inputs": {"video": ["301", 0]}},
            "h3": {"class_type": "MiniMaxH3ReferenceToVideo", "inputs": {
                "prompt": "x",
                "ref_videos.ref_video_0": ["302", 0],
                "ref_video_audios.ref_video_audio_0": ["302", 1],
            }},
            "save": {"class_type": "SaveVideo", "inputs": {"video": ["h3", 0]}},
        }

    def test_unwired_optional_video_drops_loader_chain(self, comfy_nodes):
        self._register(comfy_nodes)
        wf = self._h3_video_workflow()
        cfg = {"inputs": {"301": {"file": {"from": "upstream_video:annotated[0]"}}}}
        pruned = lc._auto_prune_unbound(wf, cfg, self._ctx())
        assert pruned == {"301", "302"}
        assert set(wf) == {"h3", "save"}
        assert wf["h3"]["inputs"] == {"prompt": "x"}

    def test_wired_upstream_left_alone(self, comfy_nodes):
        self._register(comfy_nodes)
        wf = self._h3_video_workflow()
        cfg = {"inputs": {"301": {"file": {"from": "upstream_video:annotated[0]"}}}}
        ctx = self._ctx(upstream={
            "images": [], "videos": ["/view?filename=a.mp4"],
            "audio": [], "texts": [],
        })
        pruned = lc._auto_prune_unbound(wf, cfg, ctx)
        assert pruned == set()
        assert set(wf) == {"301", "302", "h3", "save"}

    def test_required_binding_not_pruned(self, comfy_nodes):
        self._register(comfy_nodes)
        wf = self._h3_video_workflow()
        cfg = {"inputs": {"301": {"file": {
            "from": "upstream_video:annotated[0]", "required": True,
        }}}}
        assert lc._auto_prune_unbound(wf, cfg, self._ctx()) == set()
        assert "301" in wf

    def test_binding_with_default_not_pruned(self, comfy_nodes):
        self._register(comfy_nodes)
        wf = self._h3_video_workflow()
        cfg = {"inputs": {"301": {"file": {
            "from": "upstream_video:annotated[0]", "default": "fallback.mp4",
        }}}}
        assert lc._auto_prune_unbound(wf, cfg, self._ctx()) == set()
        assert "301" in wf

    def test_text_upstream_not_pruned(self, comfy_nodes):
        self._register(comfy_nodes)
        wf = {"7": {"class_type": "LoadVideo", "inputs": {"file": "t"}}}
        cfg = {"inputs": {"7": {"file": {"from": "upstream_text:value[0]"}}}}
        assert lc._auto_prune_unbound(wf, cfg, self._ctx()) == set()

    def test_cascade_reaching_output_node_aborts(self, comfy_nodes):
        self._register(comfy_nodes)
        wf = {
            "load": {"class_type": "LoadImage", "inputs": {"image": "x.png"}},
            "save": {"class_type": "SaveImage", "inputs": {"images": ["load", 0]}},
        }
        cfg = {"inputs": {"load": {"image": {"from": "upstream_image:annotated[0]"}}}}
        assert lc._auto_prune_unbound(wf, cfg, self._ctx()) == set()
        assert set(wf) == {"load", "save"}

    def test_unknown_consumer_class_treated_as_required(self, comfy_nodes):
        self._register(comfy_nodes)
        wf = {
            "load": {"class_type": "LoadVideo", "inputs": {"file": "x.mp4"}},
            "mystery": {"class_type": "SomeCustomThing",
                        "inputs": {"video": ["load", 0]}},
            "h3": {"class_type": "MiniMaxH3ReferenceToVideo", "inputs": {
                "prompt": "x", "ref_videos.ref_video_0": ["mystery", 0],
            }},
            "save": {"class_type": "SaveVideo", "inputs": {"video": ["h3", 0]}},
        }
        cfg = {"inputs": {"load": {"file": {"from": "upstream_video:annotated[0]"}}}}
        pruned = lc._auto_prune_unbound(wf, cfg, self._ctx())
        assert pruned == {"load", "mystery"}
        assert wf["h3"]["inputs"] == {"prompt": "x"}

    def test_gc_sweeps_orphaned_feeders_of_dropped_nodes(self, comfy_nodes):
        self._register(comfy_nodes)
        wf = self._h3_video_workflow()
        wf["upscaler"] = {"class_type": "SomeUpscaler", "inputs": {}}
        wf["301"]["inputs"]["model"] = ["upscaler", 0]
        cfg = {"inputs": {"301": {"file": {"from": "upstream_video:annotated[0]"}}}}
        pruned = lc._auto_prune_unbound(wf, cfg, self._ctx())
        assert pruned == {"301", "302", "upscaler"}
        assert set(wf) == {"h3", "save"}


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

    def test_unwired_optional_media_keeps_widget_value(self):
        wf = {"301": {"class_type": "LoadVideo",
                      "inputs": {"file": "sample.mp4"}}}
        cfg = {"inputs": {"301": {"file": {"from": "upstream_video:annotated[0]"}}}}
        resolver = lc._Resolver(cfg, self._ctx())
        lc._apply_overrides(wf, cfg, resolver)
        assert wf["301"]["inputs"]["file"] == "sample.mp4"

    def test_unwired_optional_text_still_writes_empty(self):
        wf = {"5": {"class_type": "CLIPTextEncode",
                    "inputs": {"text": "template prompt"}}}
        cfg = {"inputs": {"5": {"text": {"from": "upstream_text:value[0]"}}}}
        resolver = lc._Resolver(cfg, self._ctx())
        lc._apply_overrides(wf, cfg, resolver)
        assert wf["5"]["inputs"]["text"] == ""

    def test_unwired_required_media_still_raises(self):
        wf = {"301": {"class_type": "LoadVideo",
                      "inputs": {"file": "sample.mp4"}}}
        cfg = {"inputs": {"301": {"file": {
            "from": "upstream_video:annotated[0]", "required": True,
        }}}}
        resolver = lc._Resolver(cfg, self._ctx())
        with pytest.raises(RuntimeError, match="required but empty"):
            lc._apply_overrides(wf, cfg, resolver)

    def test_wired_optional_media_overrides_widget_value(self):
        wf = {"301": {"class_type": "LoadVideo",
                      "inputs": {"file": "sample.mp4"}}}
        cfg = {"inputs": {"301": {"file": {"from": "upstream_video:annotated[0]"}}}}
        ctx = self._ctx(upstream={
            "images": [], "videos": ["/view?filename=real.mp4"],
            "audio": [], "texts": [],
        })
        resolver = lc._Resolver(cfg, ctx)
        lc._apply_overrides(wf, cfg, resolver)
        assert wf["301"]["inputs"]["file"] == "real.mp4 [output]"

    def test_output_binding_replaces_every_consumer_ref(self):
        wf = {
            "115": {"class_type": "ResolutionSelector",
                    "inputs": {"aspect_ratio": "1:1 (Square)", "megapixels": 0.4, "multiple": 32}},
            "5": {"class_type": "EmptyLatentImage",
                  "inputs": {"width": ["115", 0], "height": ["115", 1]}},
            "6": {"class_type": "ModelSamplingFlux",
                  "inputs": {"width": ["115", 0], "height": ["115", 1]}},
        }
        cfg = {"sizing": {"snap": 16}, "inputs": {"115": {
            "output:0": {"from": "computed:width", "cast": "int"},
            "output:1": {"from": "computed:height", "cast": "int"},
        }}}
        ctx = self._ctx(options={"aspect_ratio": "16:9", "resolution": "720P"})
        lc._apply_overrides(wf, cfg, lc._Resolver(cfg, ctx))
        for nid in ("5", "6"):
            assert wf[nid]["inputs"] == {"width": 1280, "height": 720}
        assert "output:0" not in wf["115"]["inputs"]

    def test_consumer_input_binding_wins_over_output_binding(self):
        wf = {
            "115": {"class_type": "ResolutionSelector", "inputs": {}},
            "5": {"class_type": "EmptyLatentImage",
                  "inputs": {"width": ["115", 0], "height": ["115", 1]}},
        }
        cfg = {"inputs": {
            "5": {"width": {"from": "literal:640", "cast": "int"}},
            "115": {"output:0": {"from": "computed:width", "cast": "int"}},
        }}
        lc._apply_overrides(wf, cfg, lc._Resolver(cfg, self._ctx()))
        assert wf["5"]["inputs"]["width"] == 640
        assert wf["5"]["inputs"]["height"] == ["115", 1]


class TestApplyTextReplacements:
    NOW = datetime(2026, 9, 7, 8, 5, 3)

    def test_date_tokens_match_the_frontend(self):
        wf = {"9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "%date:yyyy-MM-dd%/%date:yy_M_d_hh_mm_ss%_img"}}}
        lc._apply_text_replacements(wf, self.NOW)
        assert wf["9"]["inputs"]["filename_prefix"] == "2026-09-07/26_9_7_08_05_03_img"

    def test_node_widget_lookup_by_type_then_title(self):
        wf = {
            "3": {"class_type": "KSampler", "inputs": {"seed": 42, "model": ["4", 0]}},
            "6": {"class_type": "CLIPTextEncode", "_meta": {"title": "Pos"}, "inputs": {"text": "a/b:c"}},
            "9": {"class_type": "VHS_VideoCombine", "inputs": {"filename_prefix": "%KSampler.seed%_%Pos.text%_%KSampler.model%_%Nope.x%_%width%"}},
        }
        lc._apply_text_replacements(wf, self.NOW)
        assert wf["9"]["inputs"]["filename_prefix"] == "42_a_b_c_%KSampler.model%_%Nope.x%_%width%"

    def test_only_string_filename_prefix_inputs_change(self):
        wf = {
            "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "%date:yyyy%"}},
            "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": ["7", 0]}},
        }
        lc._apply_text_replacements(wf, self.NOW)
        assert wf["6"]["inputs"]["text"] == "%date:yyyy%"
        assert wf["9"]["inputs"]["filename_prefix"] == ["7", 0]
