from __future__ import annotations

import json

from ComfyTV.runners import workflow_db as wdb


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
        cfg = wdb.get_workflow_config("image", "x")
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
        cfg = wdb.get_workflow_config("image", "x")
        assert len(cfg["bindings"]) == 1
        assert cfg["bindings"][0]["node_id"] == "6"


class TestResolutionSelectorAutoBind:
    _RS = {"type": "ResolutionSelector",
           "outputs": [{"name": "width", "links": [1]}, {"name": "height", "links": [2]}]}

    def _seed(self, tmp_path, monkeypatch, kind, doc, preset=None):
        from pathlib import Path
        wdir = tmp_path / "workflows"
        kdir = wdir / kind
        kdir.mkdir(parents=True)
        (kdir / "x.json").write_text(json.dumps(doc))
        if preset is not None:
            (kdir / "x_preset.json").write_text(json.dumps(preset))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
        wdb.seed_workflows_from_disk((kind,))
        return {(b["node_id"], b["input_name"]): b["from"]
                for b in wdb.get_workflow_config(kind, "x")["bindings"]}

    def test_top_level_and_subgraph_selectors_bound(self, reset_db, tmp_path, monkeypatch):
        doc = {
            "nodes": [{"id": 115, **self._RS}, {"id": 7, "type": "sg-1"}],
            "definitions": {"subgraphs": [{"id": "sg-1", "nodes": [{"id": 3, **self._RS}]}]},
        }
        got = self._seed(tmp_path, monkeypatch, "video", doc)
        assert got == {
            ("115", "output:0"): "computed:width", ("115", "output:1"): "computed:height",
            ("7:3", "output:0"): "computed:width", ("7:3", "output:1"): "computed:height",
        }

    def test_unlinked_output_left_alone(self, reset_db, tmp_path, monkeypatch):
        rs = {"id": 115, "type": "ResolutionSelector",
              "outputs": [{"name": "width", "links": [1]}, {"name": "height", "links": []}]}
        got = self._seed(tmp_path, monkeypatch, "image", {"nodes": [rs]})
        assert got == {("115", "output:0"): "computed:width"}

    def test_kind_without_stage_size_skipped(self, reset_db, tmp_path, monkeypatch):
        got = self._seed(tmp_path, monkeypatch, "panorama", {"nodes": [{"id": 115, **self._RS}]})
        assert got == {}

    def test_mapped_node_binds_its_listed_slots(self, reset_db, tmp_path, monkeypatch):
        from ComfyTV.runners.workflow_db import auto_bind
        monkeypatch.setitem(auto_bind.SIZE_NODE_OUTPUTS, "SizePreset",
                            {1: "computed:width", 2: "computed:height"})
        node = {"id": 9, "type": "SizePreset", "outputs": [
            {"name": "latent", "links": [1]}, {"name": "w", "links": [2]}, {"name": "h", "links": [3]},
        ]}
        got = self._seed(tmp_path, monkeypatch, "image", {"nodes": [node]})
        assert got == {("9", "output:1"): "computed:width", ("9", "output:2"): "computed:height"}

    def test_preset_takes_precedence(self, reset_db, tmp_path, monkeypatch):
        preset = {"inputs": {"6": {"seed": {"from": "option:seed"}}}}
        got = self._seed(tmp_path, monkeypatch, "image", {"nodes": [{"id": 115, **self._RS}]}, preset)
        assert got == {("6", "seed"): "option:seed"}


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


class TestShippedPresetRefresh:
    PRESET_V1 = {
        "label": "H3",
        "description": "v1",
        "prune_when_missing": [
            {"when": "upstream_image:value[0]",
             "drop_upstream_of": [{"node": "136", "input": "ref_images.ref_image_0"}]},
        ],
        "inputs": {"138": {"value": {"from": "main_prompt"}}},
    }
    PRESET_V2 = {
        "label": "H3",
        "description": "v2",
        "prune_when_missing": [
            {"when": "upstream_image:value[0]",
             "drop_upstream_of": [{"node": "136", "input": "ref_images.ref_image_0"}]},
            {"when": "upstream_audio:value[0]",
             "drop_upstream_of": [{"node": "136", "input": "ref_audios.ref_audio_0"}]},
        ],
        "inputs": {
            "138": {"value": {"from": "main_prompt"}},
            "401": {"audio": {"from": "upstream_audio:annotated[0]"}},
        },
    }

    def _setup_dirs(self, tmp_path, monkeypatch):
        from pathlib import Path
        legacy = tmp_path / "legacy"
        (legacy / "video").mkdir(parents=True)
        user_root = tmp_path / "user-workflows"
        monkeypatch.setattr(wdb.seed, "_LEGACY_WORKFLOWS_DIR", Path(legacy))
        monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(user_root))
        return legacy, user_root

    def _ship(self, legacy, graph: dict, preset: dict) -> None:
        (legacy / "video" / "wf.json").write_text(json.dumps(graph))
        (legacy / "video" / "wf_preset.json").write_text(json.dumps(preset))

    def _seed_v1(self, legacy):
        self._ship(legacy, {"nodes": []}, self.PRESET_V1)
        wdb.seed_workflows_from_disk(("video",))
        cfg = wdb.get_workflow_config("video", "H3")
        assert cfg["description"] == "v1"
        assert len(cfg["bindings"]) == 1
        return cfg

    def _prune_rules(self, workflow_id: int) -> list:
        from ComfyTV import db
        with db.get_session() as s:
            row = s.get(db.Workflow, workflow_id)
            return json.loads(row.prune_when_missing_json or "[]")

    def test_preset_update_reapplies_to_untouched_row(
            self, reset_db, tmp_path, monkeypatch):
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        cfg1 = self._seed_v1(legacy)

        self._ship(legacy, {"nodes": [{"id": 401, "type": "LoadAudio"}]},
                   self.PRESET_V2)
        wdb.seed_workflows_from_disk(("video",))

        cfg2 = wdb.get_workflow_config("video", "H3")
        assert cfg2["id"] == cfg1["id"]
        assert cfg2["description"] == "v2"
        keys = {(b["node_id"], b["input_name"]) for b in cfg2["bindings"]}
        assert keys == {("138", "value"), ("401", "audio")}
        assert len(self._prune_rules(cfg2["id"])) == 2

    def test_preset_update_keeps_label_order_default(
            self, reset_db, tmp_path, monkeypatch):
        from ComfyTV import db
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        cfg1 = self._seed_v1(legacy)
        wdb.set_default_workflow(cfg1["id"], True)
        with db.get_session() as s:
            s.get(db.Workflow, cfg1["id"]).label = "My H3"
            s.commit()

        self._ship(legacy, {"nodes": [{"id": 401, "type": "LoadAudio"}]},
                   self.PRESET_V2)
        wdb.seed_workflows_from_disk(("video",))

        rows = wdb.list_workflows_overview("video")
        assert len(rows) == 1
        assert rows[0]["label"] == "My H3"
        assert rows[0]["is_default"] is True
        cfg2 = wdb.get_workflow_config("video", "My H3")
        assert cfg2["description"] == "v2"

    def test_preset_update_skips_row_with_gui_edits(
            self, reset_db, tmp_path, monkeypatch):
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        cfg1 = self._seed_v1(legacy)
        wdb.upsert_input_binding(
            workflow_id=cfg1["id"], node_id="138", input_name="value",
            from_="option:seed")

        self._ship(legacy, {"nodes": [{"id": 401, "type": "LoadAudio"}]},
                   self.PRESET_V2)
        wdb.seed_workflows_from_disk(("video",))

        cfg2 = wdb.get_workflow_config("video", "H3")
        assert cfg2["description"] == "v1"
        assert len(cfg2["bindings"]) == 1
        assert cfg2["bindings"][0]["from"] == "option:seed"

    def test_preset_update_skips_forked_graph_file(
            self, reset_db, tmp_path, monkeypatch):
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        self._seed_v1(legacy)
        (user_root / "video" / "wf.json").write_text(
            json.dumps({"nodes": [{"id": 9, "type": "UserEdit"}]}))

        self._ship(legacy, {"nodes": [{"id": 401, "type": "LoadAudio"}]},
                   self.PRESET_V2)
        wdb.seed_workflows_from_disk(("video",))

        cfg2 = wdb.get_workflow_config("video", "H3")
        assert cfg2["description"] == "v1"
        assert len(cfg2["bindings"]) == 1

    def test_bootstrap_without_ledger_reapplies_pristine_row(
            self, reset_db, tmp_path, monkeypatch):
        """Pre-fix DBs have no ledger — issue #310's population. A pristine
        builtin copy still adopts the shipped update once."""
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        self._seed_v1(legacy)
        wdb.presets._preset_ledger_path(user_root).unlink()

        self._ship(legacy, {"nodes": [{"id": 401, "type": "LoadAudio"}]},
                   self.PRESET_V2)
        wdb.seed_workflows_from_disk(("video",))

        cfg2 = wdb.get_workflow_config("video", "H3")
        assert cfg2["description"] == "v2"
        keys = {(b["node_id"], b["input_name"]) for b in cfg2["bindings"]}
        assert keys == {("138", "value"), ("401", "audio")}

    def test_manual_reset_rejoins_auto_refresh(
            self, reset_db, tmp_path, monkeypatch):
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        cfg1 = self._seed_v1(legacy)
        wdb.upsert_input_binding(
            workflow_id=cfg1["id"], node_id="138", input_name="value",
            from_="option:seed")
        wdb.reset_workflow_to_preset(cfg1["id"])

        self._ship(legacy, {"nodes": [{"id": 401, "type": "LoadAudio"}]},
                   self.PRESET_V2)
        wdb.seed_workflows_from_disk(("video",))

        cfg2 = wdb.get_workflow_config("video", "H3")
        assert cfg2["description"] == "v2"
        assert len(cfg2["bindings"]) == 2

    def test_unchanged_preset_never_touches_row(
            self, reset_db, tmp_path, monkeypatch):
        legacy, user_root = self._setup_dirs(tmp_path, monkeypatch)
        cfg1 = self._seed_v1(legacy)
        wdb.upsert_input_binding(
            workflow_id=cfg1["id"], node_id="138", input_name="value",
            from_="option:seed")
        wdb.seed_workflows_from_disk(("video",))

        cfg2 = wdb.get_workflow_config("video", "H3")
        assert cfg2["bindings"][0]["from"] == "option:seed"
