"""Unit tests for runners/workflow_db.py — preset application, GUI/api join,
subgraph composite-id walking, CRUD."""

from __future__ import annotations

import json
import pytest

from ComfyTV.runners import workflow_db as wdb


# ─── _humanize ───────────────────────────────────────────────────────────────

class TestHumanize:
    def test_underscores_and_dashes(self):
        assert wdb._humanize("flux_canny_edit") == "Flux Canny Edit"
        assert wdb._humanize("flux-fill-outpaint") == "Flux Fill Outpaint"

    def test_mixed(self):
        assert wdb._humanize("ace_step-v1-song") == "Ace Step V1 Song"

    def test_empty(self):
        assert wdb._humanize("") == ""

    def test_single_word(self):
        assert wdb._humanize("sd15") == "Sd15"


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


# ─── DB-touching: seed_workflows_from_disk + get/upsert/delete ───────────────

class TestSeedAndCRUD:
    def _make_workflow(self, tmp_path, name="sd15", kind="image",
                       preset: dict | None = None) -> tuple[str, str]:
        """Drop a (workflow, optional preset) pair into a temp workflows/<kind>/
        directory under the package's _WORKFLOWS_DIR — caller monkeypatches
        the path. Returns (kind_dir, base_filename)."""
        kind_dir = tmp_path / kind
        kind_dir.mkdir(parents=True, exist_ok=True)
        (kind_dir / f"{name}.json").write_text(json.dumps({"nodes": []}))
        if preset is not None:
            (kind_dir / f"{name}_preset.json").write_text(json.dumps(preset))
        return str(kind_dir), name

    def test_seed_creates_row(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        rows = wdb.list_workflows()
        assert any(r["kind"] == "image" and r["label"] == "Sd15" for r in rows)

    def test_seed_applies_preset_on_new_row(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "fancy", "image", preset={
            "label": "Fancy Workflow",
            "order": 5,
            "description": "test desc",
            "result": {"type": "ui_save_batch", "node": "9"},
            "sizing": {"base": 512, "snap": 8},
            "prune_when_missing": [],
            "inputs": {"3": {"seed": {"from": "option:seed", "default": "random_int31", "cast": "int"}}},
        })
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        cfg = wdb.get_workflow_config("image", "Fancy Workflow")
        assert cfg is not None
        assert cfg["description"] == "test desc"
        assert cfg["result_node"] == "9"
        assert cfg["sizing"] == {"base": 512, "snap": 8}
        assert len(cfg["bindings"]) == 1
        assert cfg["bindings"][0]["from"] == "option:seed"

    def test_import_workflow_writes_and_upserts(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        wdir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))

        gui = json.dumps({"nodes": [{"id": 1, "type": "KSampler"}], "links": []})
        result = wdb.import_workflow("inpaint", "My Cool Upload.json", gui)

        assert result["kind"] == "inpaint"
        assert result["label"] == "My Cool Upload"

        written = Path(wdir / "inpaint" / "My-Cool-Upload.json")
        assert written.exists()

        rows = wdb.list_workflows()
        assert any(r["kind"] == "inpaint" and r["label"] == "My Cool Upload" for r in rows)

    def test_import_workflow_does_not_prune_other_kinds(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "wan", "video")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("video",))
        assert any(r["kind"] == "video" for r in wdb.list_workflows())

        wdb.import_workflow("image", "fresh.json",
                            json.dumps({"nodes": [{"id": 1}]}))

        labels = {(r["kind"], r["label"]) for r in wdb.list_workflows()}
        assert ("image", "Fresh") in labels
        assert ("video", "Wan") in labels  # untouched — targeted upsert, no prune

    def test_import_workflow_rejects_non_gui(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(tmp_path / "workflows"))
        api_format = json.dumps({"3": {"class_type": "KSampler", "inputs": {}}})
        with pytest.raises(ValueError, match="GUI-format"):
            wdb.import_workflow("image", "bad.json", api_format)

    def test_import_workflow_rejects_preset_name(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(tmp_path / "workflows"))
        with pytest.raises(ValueError, match="_preset"):
            wdb.import_workflow("image", "thing_preset.json",
                                json.dumps({"nodes": []}))

    def test_import_then_registry_lists_it(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        from ComfyTV.runners import refresh_registry, RUNNER_REGISTRY
        wdir = tmp_path / "workflows"
        wdir.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))

        wdb.import_workflow("inpaint", "Flux Fill Inpaint33.json",
                            json.dumps({"nodes": [{"id": 1}]}))
        refresh_registry()
        assert "Flux Fill Inpaint33" in RUNNER_REGISTRY.labels_for_kind("inpaint")

    def test_safe_stem(self):
        assert wdb._safe_stem("My Cool Upload.json") == "My-Cool-Upload"
        assert wdb._safe_stem("../../etc/passwd") == "passwd"
        assert wdb._safe_stem("a/b/c.JSON") == "c"
        assert wdb._safe_stem("  spaced name .json") == "spaced-name"

    def test_seed_skips_preset_on_existing_row(self, reset_db, tmp_path, monkeypatch):
        """The whole point of the once-only preset rule — user edits survive
        the next seed."""
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "fancy", "image", preset={
            "label": "Fancy",
            "inputs": {"3": {"seed": {"from": "option:seed"}}},
        })
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        cfg1 = wdb.get_workflow_config("image", "Fancy")
        wid = cfg1["id"]
        # User edits the binding via sidebar — re-seed must not clobber it.
        wdb.upsert_input_binding(
            workflow_id=wid, node_id="3", input_name="seed",
            from_="main_prompt",  # user changed it
        )
        wdb.seed_workflows_from_disk(("image",))

        cfg2 = wdb.get_workflow_config("image", "Fancy")
        seed_b = next(b for b in cfg2["bindings"] if b["node_id"] == "3" and b["input_name"] == "seed")
        assert seed_b["from"] == "main_prompt"

    def test_seed_ignores_preset_files_as_workflows(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kind_dir = wdir / "image"
        kind_dir.mkdir(parents=True)
        # Only a preset, no actual workflow — must not produce a phantom row.
        (kind_dir / "foo_preset.json").write_text(json.dumps({"label": "X"}))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        rows = wdb.list_workflows()
        assert all("X" != r["label"] for r in rows)

    def test_no_workflows_dir(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(tmp_path / "missing"))
        wdb.seed_workflows_from_disk(("image",))  # should not raise

    def test_seed_reclaims_label_from_orphan(self, reset_db, tmp_path, monkeypatch):
        """Stale row whose file is gone must yield its label to a new file."""
        from pathlib import Path
        from ComfyTV import db

        stale_path = str(tmp_path / "ghost" / "old.json")
        with db.get_session() as s:
            stale = db.Workflow(kind="image", label="Shared",
                                file_path=stale_path, order_=100)
            s.add(stale)
            s.flush()
            s.add(db.WorkflowInputBinding(
                workflow_id=stale.id, node_id="3", input_name="seed",
                from_="option:seed",
            ))
            s.commit()
            stale_id = stale.id

        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "new", "image", preset={"label": "Shared"})
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        rows = [r for r in wdb.list_workflows() if r["kind"] == "image"]
        labels = [r["label"] for r in rows]
        assert labels.count("Shared") == 1
        with db.get_session() as s:
            from sqlalchemy import select
            assert s.get(db.Workflow, stale_id) is None
            bindings = s.execute(
                select(db.WorkflowInputBinding).where(
                    db.WorkflowInputBinding.workflow_id == stale_id
                )
            ).scalars().all()
            assert bindings == []

    def test_seed_keeps_default_label_when_live_row_owns_preset_label(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "first",  "image", preset={"label": "Shared"})
        self._make_workflow(wdir, "second", "image", preset={"label": "Shared"})
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))  # must not raise

        rows = [r for r in wdb.list_workflows() if r["kind"] == "image"]
        labels = sorted(r["label"] for r in rows)
        assert "Shared" in labels
        assert "Second" in labels
        assert labels.count("Shared") == 1

    def test_get_workflow_for_invoke_returns_none_when_missing(self, reset_db):
        assert wdb.get_workflow_for_invoke("image", "Nope") is None

    def test_get_workflow_for_invoke_raises_without_api_json(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        with pytest.raises(RuntimeError, match="hasn't been prepared"):
            wdb.get_workflow_for_invoke("image", "Sd15")

    def test_get_workflow_for_invoke_happy_path(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image", preset={
            "label": "SD 1.5",
            "result": {"type": "ui_save_batch", "node": "9"},
            "sizing": {"base": 512, "snap": 8},
            "inputs": {"3": {"seed": {"from": "option:seed", "cast": "int"}}},
        })
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        # Stamp api_json so invoke is allowed.
        api = {"3": {"class_type": "KSampler", "inputs": {"seed": 0}}}
        assert wdb.set_api_json("image", "SD 1.5", api, 100.0)

        cfg = wdb.get_workflow_for_invoke("image", "SD 1.5")
        assert cfg is not None
        assert cfg["api_json"] == api
        assert cfg["result"] == {"type": "ui_save_batch", "node": "9"}
        assert cfg["sizing"] == {"base": 512, "snap": 8}
        assert cfg["inputs"]["3"]["seed"]["from"] == "option:seed"

    def test_set_api_json_invalid_workflow(self, reset_db):
        assert wdb.set_api_json("image", "Nope", {}, 0.0) is False

    def test_set_api_json_prunes_orphaned_bindings(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        wid = wdb.get_workflow_config("image", "Sd15")["id"]

        wdb.upsert_input_binding(wid, "3", "seed", "option:seed")
        wdb.upsert_input_binding(wid, "42", "text", "main_prompt")

        wdb.set_api_json(
            "image", "Sd15",
            {"3": {"class_type": "KSampler", "inputs": {"seed": 0}}},
            200.0,
        )

        cfg = wdb.get_workflow_config("image", "Sd15")
        node_ids = {b["node_id"] for b in cfg["bindings"]}
        assert node_ids == {"3"}, "orphaned binding on node 42 should be pruned"

    def test_set_api_json_keeps_bindings_when_nodes_unchanged(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        wid = wdb.get_workflow_config("image", "Sd15")["id"]

        wdb.upsert_input_binding(wid, "3", "seed", "option:seed")
        # Same node id present → binding must survive a re-prep (e.g. value-only edit).
        wdb.set_api_json(
            "image", "Sd15",
            {"3": {"class_type": "KSampler", "inputs": {"seed": 5}}},
            300.0,
        )
        cfg = wdb.get_workflow_config("image", "Sd15")
        assert {b["node_id"] for b in cfg["bindings"]} == {"3"}

    def test_upsert_then_delete_binding(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        cfg = wdb.get_workflow_config("image", "Sd15")
        wid = cfg["id"]

        # insert
        assert wdb.upsert_input_binding(
            wid, "3", "seed", "option:seed", default="random_int31",
            cast="int", required=True, error_msg="oops",
        )
        cfg2 = wdb.get_workflow_config("image", "Sd15")
        b = cfg2["bindings"][0]
        assert b["from"] == "option:seed"
        assert b["required"] is True
        assert b["cast"] == "int"
        assert b["error_msg"] == "oops"

        # update (same key) — different from_
        wdb.upsert_input_binding(wid, "3", "seed", "main_prompt")
        cfg3 = wdb.get_workflow_config("image", "Sd15")
        b = cfg3["bindings"][0]
        assert b["from"] == "main_prompt"
        assert b["cast"] is None  # cleared

        # delete
        assert wdb.delete_input_binding(wid, "3", "seed")
        cfg4 = wdb.get_workflow_config("image", "Sd15")
        assert cfg4["bindings"] == []

        # second delete: false
        assert wdb.delete_input_binding(wid, "3", "seed") is False

    def test_upsert_binding_unknown_workflow(self, reset_db):
        assert wdb.upsert_input_binding(99999, "x", "y", "main_prompt") is False

    def test_update_workflow_meta_partial(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image", preset={"description": "orig"})
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        cfg = wdb.get_workflow_config("image", "Sd15")
        wid = cfg["id"]

        # Update only description; sizing/result untouched.
        assert wdb.update_workflow_meta(wid, description="new desc")
        cfg2 = wdb.get_workflow_config("image", "Sd15")
        assert cfg2["description"] == "new desc"

        # Clear it explicitly with None.
        wdb.update_workflow_meta(wid, description=None)
        cfg3 = wdb.get_workflow_config("image", "Sd15")
        assert cfg3["description"] is None

        # Set sizing.
        wdb.update_workflow_meta(wid, sizing={"base": 1024, "snap": 16})
        cfg4 = wdb.get_workflow_config("image", "Sd15")
        assert cfg4["sizing"] == {"base": 1024, "snap": 16}

        # Clear sizing with empty dict (treated as falsy → None).
        wdb.update_workflow_meta(wid, sizing={})
        cfg5 = wdb.get_workflow_config("image", "Sd15")
        assert cfg5["sizing"] == {}

    def test_update_meta_missing_workflow(self, reset_db):
        assert wdb.update_workflow_meta(99999, description="x") is False

    def test_list_workflow_bindings(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image", preset={
            "inputs": {"3": {"seed": {"from": "option:seed", "required": True}}},
        })
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        out = wdb.list_workflow_bindings()
        assert len(out) == 1
        assert out[0]["kind"] == "image"
        assert out[0]["bindings"] == [{"from": "option:seed", "required": True}]

    def test_get_workflow_state_paths(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        state = wdb.get_workflow_state("image", "Sd15")
        assert state is not None
        assert state["has_api"] is False
        assert state["file_exists"] is True

    def test_get_workflow_state_invalidates_on_mtime_change(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        wdb.set_api_json("image", "Sd15", {"3": {}}, 1.0)
        # Now the file gets re-touched; mtime changes.
        fpath = wdir / "image" / "sd15.json"
        fpath.write_text(json.dumps({"nodes": [{"id": 1}]}))  # bumps mtime
        state = wdb.get_workflow_state("image", "Sd15")
        # has_api should now be False because mtime mismatch invalidated cache.
        assert state["has_api"] is False

    def test_get_workflow_state_unknown(self, reset_db):
        assert wdb.get_workflow_state("image", "Nope") is None

    def test_get_workflow_state_wipes_stale_api_json(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kind_dir = wdir / "image"
        kind_dir.mkdir(parents=True)
        (kind_dir / "sd15.json").write_text(json.dumps({
            "nodes": [{"id": 158, "type": "SaveImage"},
                      {"id": 98,  "type": "Subgraph"}],
        }))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        stale_api = {str(i): {"class_type": "X", "inputs": {}} for i in range(24, 30)}
        mtime = (kind_dir / "sd15.json").stat().st_mtime
        wdb.set_api_json("image", "Sd15", stale_api, mtime)

        state = wdb.get_workflow_state("image", "Sd15")
        assert state is not None
        assert state["has_api"] is False

        again = wdb.get_workflow_state("image", "Sd15")
        assert again["has_api"] is False

    def test_get_workflow_state_keeps_matching_api_json(
            self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kind_dir = wdir / "image"
        kind_dir.mkdir(parents=True)
        (kind_dir / "sd15.json").write_text(json.dumps({
            "nodes": [{"id": 158, "type": "SaveImage"},
                      {"id": 98,  "type": "Subgraph"}],
        }))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))

        good_api = {
            "158": {"class_type": "SaveImage", "inputs": {}},
            "98:9": {"class_type": "VAELoader", "inputs": {}},
        }
        mtime = (kind_dir / "sd15.json").stat().st_mtime
        wdb.set_api_json("image", "Sd15", good_api, mtime)

        state = wdb.get_workflow_state("image", "Sd15")
        assert state["has_api"] is True

    def test_read_workflow_file_happy(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        self._make_workflow(wdir, "sd15", "image")
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        pair = wdb.read_workflow_file("image", "Sd15")
        assert pair is not None
        content, mtime = pair
        assert json.loads(content) == {"nodes": []}
        assert isinstance(mtime, float)

    def test_read_workflow_file_unknown(self, reset_db):
        assert wdb.read_workflow_file("image", "Nope") is None


# ─── _apply_preset_to_new_row edge cases ─────────────────────────────────────

class TestPresetApplication:
    def test_default_value_serialised(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kdir = wdir / "image"
        kdir.mkdir(parents=True)
        (kdir / "x.json").write_text(json.dumps({"nodes": []}))
        (kdir / "x_preset.json").write_text(json.dumps({
            "inputs": {
                "3": {
                    "int_default":  {"from": "option:k", "default": 7},
                    "list_default": {"from": "option:k", "default": [1, 2, 3]},
                }
            }
        }))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        cfg = wdb.get_workflow_config("image", "X")
        defaults = {b["input_name"]: b["default"] for b in cfg["bindings"]}
        assert defaults["int_default"] == "7"             # int → str
        assert defaults["list_default"] == "[1, 2, 3]"    # list → JSON str

    def test_preset_ignores_bad_inputs_shape(self, reset_db, tmp_path, monkeypatch):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kdir = wdir / "image"
        kdir.mkdir(parents=True)
        (kdir / "x.json").write_text(json.dumps({"nodes": []}))
        (kdir / "x_preset.json").write_text(json.dumps({
            "inputs": {
                "3": "not a dict",   # outer must be dict — skip
                "4": {"seed": "not a dict"},   # inner spec must be dict — skip
                "5": {"seed": {}},   # no `from` — skip
                "6": {"seed": {"from": "option:seed"}},  # OK
            }
        }))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk(("image",))
        cfg = wdb.get_workflow_config("image", "X")
        assert len(cfg["bindings"]) == 1
        assert cfg["bindings"][0]["node_id"] == "6"


# ─── build_preset: DB → preset.json round-trip ───────────────────────────────

class TestBuildPreset:
    """build_preset must produce the inverse of _apply_preset_to_new_row.
    The round-trip (seed → export → re-seed in a fresh DB) must end in
    the same bindings + meta state."""

    def _seed_one(self, monkeypatch, tmp_path, preset: dict,
                  name: str = "x", kind: str = "image"):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kdir = wdir / kind
        kdir.mkdir(parents=True, exist_ok=True)
        (kdir / f"{name}.json").write_text(json.dumps({"nodes": []}))
        (kdir / f"{name}_preset.json").write_text(json.dumps(preset))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk((kind,))

    def test_unknown_returns_none(self, reset_db):
        assert wdb.build_preset("image", "Nope") is None

    def test_minimal_workflow_with_no_bindings(self, reset_db, tmp_path, monkeypatch):
        self._seed_one(monkeypatch, tmp_path, {"label": "Plain"})
        preset = wdb.build_preset("image", "Plain")
        assert preset is not None
        assert preset["label"] == "Plain"
        # Empty / default fields stripped
        assert "inputs" not in preset
        assert "sizing" not in preset
        assert "prune_when_missing" not in preset
        assert "order" not in preset  # default 100 stripped
        assert "_comment" in preset   # always present as guidance

    def test_round_trip_full_preset(self, reset_db, tmp_path, monkeypatch):
        original = {
            "label": "Fancy",
            "order": 5,
            "description": "rich test",
            "result": {"type": "ui_save_batch", "node": "9"},
            "sizing": {"base": 1024, "snap": 8, "type": "image"},
            "prune_when_missing": [
                {"when": "upstream_image:annotated[1]",
                 "drop_nodes": ["load_ref2"]},
            ],
            "inputs": {
                "3": {
                    "seed": {
                        "from": "option:seed",
                        "default": "random_int31",
                        "cast": "int",
                    },
                    "denoise": {
                        "from": "option:denoise",
                        "default": "1.0",
                        "cast": "float",
                        "required": True,
                        "error": "denoise must be set",
                    },
                },
                "17": {
                    "image": {"from": "upstream_image:annotated[0]", "required": True},
                    "channel": {"from": "literal:alpha"},
                },
                "23": {
                    "text": {
                        "from": "main_prompt",
                        "prefix": "[front view] ",
                        "suffix": " ::high quality",
                        "default": "a photograph",
                    },
                },
            },
        }
        self._seed_one(monkeypatch, tmp_path, original, name="fancy")

        # Export.
        exported = wdb.build_preset("image", "Fancy")
        assert exported is not None
        assert exported["label"] == "Fancy"
        assert exported["order"] == 5
        assert exported["description"] == "rich test"
        assert exported["result"] == {"type": "ui_save_batch", "node": "9"}
        assert exported["sizing"] == original["sizing"]
        assert exported["prune_when_missing"] == original["prune_when_missing"]
        # Binding shape matches what _apply_preset_to_new_row consumes.
        assert exported["inputs"]["3"]["seed"]["from"] == "option:seed"
        assert exported["inputs"]["3"]["seed"]["default"] == "random_int31"
        assert exported["inputs"]["3"]["seed"]["cast"] == "int"
        assert exported["inputs"]["3"]["denoise"]["required"] is True
        assert exported["inputs"]["3"]["denoise"]["error"] == "denoise must be set"
        assert exported["inputs"]["17"]["image"]["from"] == "upstream_image:annotated[0]"
        assert exported["inputs"]["23"]["text"]["prefix"] == "[front view] "
        assert exported["inputs"]["23"]["text"]["suffix"] == " ::high quality"

    def test_user_edits_via_sidebar_are_included(
            self, reset_db, tmp_path, monkeypatch):
        """Sidebar edits → DB → build_preset must reflect them, not the
        shipped preset's original values."""
        self._seed_one(monkeypatch, tmp_path, {
            "label": "X",
            "inputs": {"3": {"seed": {"from": "option:seed"}}},
        })
        cfg = wdb.get_workflow_config("image", "X")
        wid = cfg["id"]

        # User changes binding from option:seed → literal:42 via sidebar.
        wdb.upsert_input_binding(wid, "3", "seed", "literal:42")
        # User edits description.
        wdb.update_workflow_meta(wid, description="user added this")

        exported = wdb.build_preset("image", "X")
        assert exported["description"] == "user added this"
        assert exported["inputs"]["3"]["seed"]["from"] == "literal:42"

    def test_empty_sizing_dict_omitted(self, reset_db, tmp_path, monkeypatch):
        """`sizing: {}` was a degenerate case the editor could produce — it
        must NOT appear in the exported preset (would not influence
        anything but adds noise)."""
        self._seed_one(monkeypatch, tmp_path, {"label": "X"})
        cfg = wdb.get_workflow_config("image", "X")
        # Explicitly write an empty sizing dict via the meta updater.
        wdb.update_workflow_meta(cfg["id"], sizing={})
        exported = wdb.build_preset("image", "X")
        assert "sizing" not in exported
