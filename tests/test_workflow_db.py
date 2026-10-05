"""Unit tests for runners/workflow_db.py — preset application, GUI/api join,
subgraph composite-id walking, CRUD."""

from __future__ import annotations

import json

from ComfyTV.runners import workflow_db as wdb


# ─── _label_from_stem ────────────────────────────────────────────────────────

class TestLabelFromStem:
    def test_preserves_case_and_format(self):
        assert wdb._label_from_stem("Simple TVWorkflow - V7.3-4") == "Simple TVWorkflow - V7.3-4"

    def test_underscores_and_dashes_kept_verbatim(self):
        assert wdb._label_from_stem("flux_canny_edit") == "flux_canny_edit"
        assert wdb._label_from_stem("flux-fill-outpaint") == "flux-fill-outpaint"

    def test_empty(self):
        assert wdb._label_from_stem("") == ""

    def test_single_word(self):
        assert wdb._label_from_stem("sd15") == "sd15"

    def test_strips_surrounding_whitespace(self):
        assert wdb._label_from_stem("  My Workflow  ") == "My Workflow"


# ─── _is_gui_format ──────────────────────────────────────────────────────────

class TestIsGuiFormat:
    def test_gui_export_passes(self):
        content = json.dumps({"nodes": [{"id": 1, "type": "X"}], "groups": []})
        assert wdb._is_gui_format(content)

    def test_empty_nodes_array_passes(self):
        assert wdb._is_gui_format(json.dumps({"nodes": []}))

    def test_api_format_fails(self):
        api = json.dumps({"3": {"class_type": "KSampler", "inputs": {}}})
        assert not wdb._is_gui_format(api)

    def test_not_json_fails(self):
        assert not wdb._is_gui_format("not json")

    def test_nodes_not_a_list_fails(self):
        assert not wdb._is_gui_format(json.dumps({"nodes": "abc"}))


# ─── _read_preset ────────────────────────────────────────────────────────────

class TestReadPreset:
    def test_returns_empty_when_sibling_missing(self, tmp_path):
        wf = tmp_path / "foo.json"
        wf.write_text("{}")
        assert wdb._read_preset(wf) == {}

    def test_reads_valid_preset(self, tmp_path):
        wf = tmp_path / "foo.json"
        preset = tmp_path / "foo_preset.json"
        wf.write_text("{}")
        preset.write_text(json.dumps({"label": "Foo"}))
        assert wdb._read_preset(wf) == {"label": "Foo"}

    def test_returns_empty_on_invalid_json(self, tmp_path):
        wf = tmp_path / "foo.json"
        preset = tmp_path / "foo_preset.json"
        wf.write_text("{}")
        preset.write_text("not json")
        assert wdb._read_preset(wf) == {}

    def test_returns_empty_when_preset_is_not_dict(self, tmp_path):
        wf = tmp_path / "foo.json"
        preset = tmp_path / "foo_preset.json"
        wf.write_text("{}")
        preset.write_text(json.dumps(["a", "b"]))
        assert wdb._read_preset(wf) == {}


# ─── _bindings_to_inputs_dict ────────────────────────────────────────────────

class TestBindingsToInputs:
    def _row(self, **kw):
        from ComfyTV.db import WorkflowInputBinding
        defaults = dict(
            workflow_id=1, node_id="3", input_name="seed", from_="option:seed",
            default_value=None, prefix=None, suffix=None, required=False,
            error_msg=None, cast_=None,
        )
        defaults.update(kw)
        return WorkflowInputBinding(**defaults)

    def test_basic_shape(self):
        rows = [self._row()]
        d = wdb._bindings_to_inputs_dict(rows)
        assert d == {"3": {"seed": {"from": "option:seed"}}}

    def test_default_and_cast(self):
        rows = [self._row(default_value="42", cast_="int")]
        d = wdb._bindings_to_inputs_dict(rows)
        assert d["3"]["seed"] == {
            "from": "option:seed", "default": "42", "cast": "int",
        }

    def test_required_and_error(self):
        rows = [self._row(required=True, error_msg="oops")]
        d = wdb._bindings_to_inputs_dict(rows)
        assert d["3"]["seed"]["required"] is True
        assert d["3"]["seed"]["error"] == "oops"

    def test_prefix_suffix(self):
        rows = [self._row(prefix="P ", suffix=" S")]
        d = wdb._bindings_to_inputs_dict(rows)
        assert d["3"]["seed"]["prefix"] == "P "
        assert d["3"]["seed"]["suffix"] == " S"

    def test_multi_inputs_same_node(self):
        rows = [
            self._row(input_name="seed"),
            self._row(input_name="steps", from_="literal:20"),
        ]
        d = wdb._bindings_to_inputs_dict(rows)
        assert set(d["3"].keys()) == {"seed", "steps"}


# ─── _node_widget_meta ───────────────────────────────────────────────────────

class TestNodeWidgetMeta:
    def test_returns_empty_for_unknown(self, comfy_nodes):
        assert wdb._node_widget_meta("Unknown") == []

    def test_simple_int_widget(self, comfy_nodes):
        class Foo:
            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {"seed": ("INT", {"min": 0, "max": 100})}}
        comfy_nodes.NODE_CLASS_MAPPINGS["Foo"] = Foo
        meta = wdb._node_widget_meta("Foo")
        assert meta == [{"name": "seed", "type": "INT", "options": {"min": 0, "max": 100}}]

    def test_combo_widget(self, comfy_nodes):
        class Foo:
            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {"sampler": (["euler", "ddim"], {})}}
        comfy_nodes.NODE_CLASS_MAPPINGS["Foo"] = Foo
        meta = wdb._node_widget_meta("Foo")
        assert meta[0]["type"] == "COMBO"
        assert meta[0]["options"]["values"] == ["euler", "ddim"]

    def test_combo_widget_v3_io_type(self, comfy_nodes):
        class Foo:
            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {
                    "language": ("COMBO", {"options": ["en", "zh"], "default": "en"}),
                }}
        comfy_nodes.NODE_CLASS_MAPPINGS["Foo"] = Foo
        meta = wdb._node_widget_meta("Foo")
        assert meta[0]["name"] == "language"
        assert meta[0]["type"] == "COMBO"
        assert meta[0]["options"]["values"] == ["en", "zh"]
        assert meta[0]["options"]["default"] == "en"

    def test_link_input_skipped(self, comfy_nodes):
        class Foo:
            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {
                    "model": ("MODEL",),
                    "steps": ("INT", {}),
                }}
        comfy_nodes.NODE_CLASS_MAPPINGS["Foo"] = Foo
        meta = wdb._node_widget_meta("Foo")
        names = [m["name"] for m in meta]
        assert "model" not in names
        assert "steps" in names

    def test_boolean_and_string(self, comfy_nodes):
        class Foo:
            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {
                    "enabled": ("BOOLEAN", {}),
                    "text":    ("STRING", {"multiline": True}),
                }}
        comfy_nodes.NODE_CLASS_MAPPINGS["Foo"] = Foo
        meta = wdb._node_widget_meta("Foo")
        types_ = {m["name"]: m["type"] for m in meta}
        assert types_ == {"enabled": "BOOLEAN", "text": "STRING"}

    def test_optional_section_included(self, comfy_nodes):
        class Foo:
            @classmethod
            def INPUT_TYPES(cls):
                return {
                    "required": {"a": ("INT", {})},
                    "optional": {"b": ("FLOAT", {})},
                }
        comfy_nodes.NODE_CLASS_MAPPINGS["Foo"] = Foo
        meta = wdb._node_widget_meta("Foo")
        names = [m["name"] for m in meta]
        assert names == ["a", "b"]

    def test_input_types_raises_handled(self, comfy_nodes):
        class Foo:
            @classmethod
            def INPUT_TYPES(cls):
                raise RuntimeError("boom")
        comfy_nodes.NODE_CLASS_MAPPINGS["Foo"] = Foo
        assert wdb._node_widget_meta("Foo") == []

    def test_class_without_input_types(self, comfy_nodes):
        class Foo:
            pass
        comfy_nodes.NODE_CLASS_MAPPINGS["Foo"] = Foo
        assert wdb._node_widget_meta("Foo") == []


# ─── _extract_gui_view ───────────────────────────────────────────────────────

class TestExtractGuiView:
    def test_missing_file(self):
        assert wdb._extract_gui_view("/nonexistent.json") == {}

    def test_invalid_json(self, tmp_path):
        p = tmp_path / "bad.json"
        p.write_text("not json")
        assert wdb._extract_gui_view(str(p)) == {}

    def test_not_gui_format(self, tmp_path):
        p = tmp_path / "api.json"
        p.write_text(json.dumps({"3": {"class_type": "X"}}))
        assert wdb._extract_gui_view(str(p)) == {}

    def test_basic_extraction(self, write_workflow):
        out = wdb._extract_gui_view(str(write_workflow))
        # SaveImage, LoadImage, Subgraph instance — Note is excluded from gui_nodes.
        types_ = {n["type"] for n in out["gui_nodes"]}
        assert "SaveImage" in types_
        assert "Note" not in types_
        assert len(out["gui_notes"]) == 1
        assert out["gui_notes"][0]["text"] == "hi"
        assert out["gui_groups"][0]["title"] == "Loaders"

    def test_empty_path(self):
        assert wdb._extract_gui_view("") == {}


# ─── _exposed_widgets — top-level + subgraph ─────────────────────────────────

class TestExposedWidgets:
    def _register_classes(self, comfy_nodes):
        class SaveImage:
            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {"filename_prefix": ("STRING", {})}}

        class LoadImage:
            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {"image": (["a.png", "b.png"], {"image_upload": True})}}

        class KSampler:
            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {
                    "model": ("MODEL",),
                    "seed":  ("INT", {"min": 0, "max": 2**31 - 1}),
                    "steps": ("INT", {"min": 1, "max": 100}),
                    "sampler_name": (["euler", "ddim"], {}),
                    "positive": ("CONDITIONING",),
                    "negative": ("CONDITIONING",),
                    "latent_image": ("LATENT",),
                    "cfg":    ("FLOAT", {"min": 1.0, "max": 30.0}),
                    "scheduler": (["normal", "karras"], {}),
                    "denoise": ("FLOAT", {}),
                }}

        class CLIPTextEncode:
            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {
                    "text": ("STRING", {"multiline": True}),
                    "clip": ("CLIP",),
                }}

        comfy_nodes.NODE_CLASS_MAPPINGS.update({
            "SaveImage": SaveImage, "LoadImage": LoadImage,
            "KSampler": KSampler, "CLIPTextEncode": CLIPTextEncode,
        })

    def test_empty_when_api_json_none(self, write_workflow):
        out = wdb._exposed_widgets(1, str(write_workflow), [], None)
        assert out == []

    def test_empty_when_file_missing(self):
        out = wdb._exposed_widgets(1, "/nonexistent", [], {"3": {}})
        assert out == []

    def test_top_level_and_subgraph_walking(self, comfy_nodes, write_workflow,
                                            sample_workflow_doc):
        self._register_classes(comfy_nodes)
        _gui_path, _gui, api = sample_workflow_doc
        out = wdb._exposed_widgets(1, str(write_workflow), [], api)
        node_ids = {row["node_id"] for row in out}
        # SaveImage top-level
        assert "9" in node_ids
        # LoadImage top-level (its `image` widget IS in api_json — keep)
        assert "17" in node_ids
        # Inner subgraph nodes — composite IDs
        assert "47:3" in node_ids       # KSampler
        assert "47:23" in node_ids      # CLIPTextEncode
        # Subgraph wrapper itself (type=sub-abc-id) is NOT listed
        assert "47" not in node_ids
        # Note node skipped
        assert all(row["node_type"] != "Note" for row in out)

    def test_link_input_skipped(self, comfy_nodes, write_workflow,
                                sample_workflow_doc):
        self._register_classes(comfy_nodes)
        _, _, api = sample_workflow_doc
        out = wdb._exposed_widgets(1, str(write_workflow), [], api)
        # KSampler.model is a link — must not appear; KSampler.seed must.
        widget_names = {(r["node_id"], r["widget_name"]) for r in out}
        assert ("47:3", "model") not in widget_names
        assert ("47:3", "seed") in widget_names

    def test_group_title_populated(self, comfy_nodes, write_workflow,
                                   sample_workflow_doc):
        self._register_classes(comfy_nodes)
        _, _, api = sample_workflow_doc
        out = wdb._exposed_widgets(1, str(write_workflow), [], api)
        # The SaveImage / LoadImage at pos [10, 10] / [10, 100] are inside
        # the group "Loaders" (bounding 0,0,500,200). Inner subgraph nodes
        # get the subgraph's display name (or, if missing, the instance's
        # title) as their group_title so the sidebar can render them
        # together visually.
        groups = {r["node_id"]: r["group_title"] for r in out}
        assert groups["9"] == "Loaders"
        assert groups["17"] == "Loaders"
        # Fixture's subgraph def has no `name`, so we fall back to the
        # instance node's title "Inpaint Subgraph".
        assert groups["47:3"] == "Inpaint Subgraph"
        assert groups["47:23"] == "Inpaint Subgraph"

    def test_top_level_emitted_before_subgraph_inner(
            self, comfy_nodes, write_workflow, sample_workflow_doc):
        """Two-pass ordering: every top-level node ships before any
        subgraph inner node, so the sidebar reads "natural" — the user's
        own SaveImage / LoadImage etc. on top, the subgraph block below."""
        self._register_classes(comfy_nodes)
        _, _, api = sample_workflow_doc
        out = wdb._exposed_widgets(1, str(write_workflow), [], api)
        node_ids = [r["node_id"] for r in out]
        last_top = max(
            (i for i, nid in enumerate(node_ids) if ":" not in nid),
            default=-1,
        )
        first_inner = next(
            (i for i, nid in enumerate(node_ids) if ":" in nid),
            len(node_ids),
        )
        # Every top-level row appears BEFORE the first inner row.
        assert last_top < first_inner

    def test_binding_join(self, comfy_nodes, write_workflow, sample_workflow_doc):
        self._register_classes(comfy_nodes)
        _, _, api = sample_workflow_doc
        from ComfyTV.db import WorkflowInputBinding
        b = WorkflowInputBinding(
            workflow_id=1, node_id="47:3", input_name="seed",
            from_="option:seed", default_value="42", cast_="int",
        )
        out = wdb._exposed_widgets(1, str(write_workflow), [b], api)
        seed_row = next(r for r in out if r["node_id"] == "47:3" and r["widget_name"] == "seed")
        assert seed_row["stage_binding"] == "option:seed"
        assert seed_row["override_value"] == "42"
        assert seed_row["cast"] == "int"

    def test_referenced_primitive_outputs_listed(self, comfy_nodes, tmp_path):
        class ResolutionSelector:
            RETURN_TYPES = ("INT", "INT")
            RETURN_NAMES = ("width", "height")

            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {"megapixels": ("FLOAT", {})}}

        class EmptyLatentImage:
            RETURN_TYPES = ("LATENT",)

            @classmethod
            def INPUT_TYPES(cls):
                return {"required": {"width": ("INT", {}), "height": ("INT", {})}}

        comfy_nodes.NODE_CLASS_MAPPINGS.update({
            "ResolutionSelector": ResolutionSelector, "EmptyLatentImage": EmptyLatentImage,
        })
        path = tmp_path / "wf.json"
        path.write_text(json.dumps({"nodes": [
            {"id": 115, "type": "ResolutionSelector", "pos": [0, 0]},
            {"id": 5, "type": "EmptyLatentImage", "pos": [0, 0]},
        ]}))
        api = {
            "115": {"class_type": "ResolutionSelector", "inputs": {"megapixels": 0.4}},
            "5": {"class_type": "EmptyLatentImage", "inputs": {"width": ["115", 0], "height": 512}},
        }
        from ComfyTV.db import WorkflowInputBinding
        b = WorkflowInputBinding(workflow_id=1, node_id="115", input_name="output:0",
                                 from_="computed:width", cast_="int")
        out = wdb._exposed_widgets(1, str(path), [b], api)
        rows = {(r["node_id"], r["widget_name"]): r for r in out}
        assert rows[("115", "output:0")]["widget_type"] == "OUTPUT"
        assert rows[("115", "output:0")]["widget_props"] == {"output_type": "INT", "output_name": "width"}
        assert rows[("115", "output:0")]["stage_binding"] == "computed:width"
        assert ("115", "output:1") not in rows
        assert ("5", "width") not in rows
        assert ("5", "height") in rows
