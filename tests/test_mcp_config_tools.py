from __future__ import annotations

import json

import pytest


API_JSON = {
    "3": {"class_type": "KSampler",
          "_meta": {"title": "Sampler"},
          "inputs": {"seed": 5, "steps": 20, "model": ["4", 0]}},
    "5": {"class_type": "EmptyLatentImage",
          "inputs": {"width": 1024, "height": 1024,
                     "long_text": "x" * 500}},
}


@pytest.fixture()
def workflow_row(reset_db, tmp_path):
    from ComfyTV import db
    wf_file = tmp_path / "t2i.json"
    wf_file.write_text("{}", encoding="utf-8")
    with db.get_session() as s:
        row = db.Workflow(
            kind="image", label="Test T2I",
            file_path=str(wf_file), api_json=json.dumps(API_JSON),
        )
        s.add(row)
        s.commit()
        return {"id": row.id, "kind": "image", "label": "Test T2I"}


class TestWorkflowGet:
    async def test_returns_slim_nodes_and_bindings(self, workflow_row):
        from ComfyTV.api.mcp_tools import _workflow_get
        out = await _workflow_get({"kind": "image", "label": "Test T2I"})
        assert out["id"] == workflow_row["id"]
        nodes = {n["node_id"]: n for n in out["nodes"]}
        assert nodes["3"]["class_type"] == "KSampler"
        assert nodes["3"]["title"] == "Sampler"
        assert nodes["3"]["inputs"]["model"] == "«linked from node 4»"
        assert nodes["5"]["inputs"]["long_text"].endswith("…")
        assert out["bindings"] == []

    async def test_unknown_label_lists_available(self, workflow_row):
        from ComfyTV.api.mcp_tools import _workflow_get
        with pytest.raises(ValueError, match="Test T2I"):
            await _workflow_get({"kind": "image", "label": "Nope"})

    async def test_unknown_kind(self, reset_db):
        from ComfyTV.api.mcp_tools import _workflow_get
        with pytest.raises(ValueError, match="unknown workflow kind"):
            await _workflow_get({"kind": "nope", "label": "x"})


class TestWorkflowEdit:
    async def test_bind_and_unbind_roundtrip(self, workflow_row):
        from ComfyTV.api.mcp_tools import _workflow_edit
        out = await _workflow_edit({
            "kind": "image", "label": "Test T2I",
            "ops": [
                {"op": "bind", "node_id": "3", "input_name": "seed",
                 "from": "option:seed", "cast": "int"},
                {"op": "bind", "node_id": "5", "input_name": "width",
                 "from": "computed:width"},
            ],
        })
        assert all(r["ok"] for r in out["results"])
        bound = {(b["node_id"], b["input_name"]): b for b in out["bindings"]}
        assert bound[("3", "seed")]["from"] == "option:seed"
        assert bound[("3", "seed")]["cast"] == "int"
        assert bound[("5", "width")]["from"] == "computed:width"

        out = await _workflow_edit({
            "kind": "image", "label": "Test T2I",
            "ops": [{"op": "unbind", "node_id": "3", "input_name": "seed"}],
        })
        assert [b["input_name"] for b in out["bindings"]] == ["width"]

    async def test_invalid_from_rejected(self, workflow_row):
        from ComfyTV.api.mcp_tools import _workflow_edit
        with pytest.raises(ValueError, match="invalid from"):
            await _workflow_edit({
                "kind": "image", "label": "Test T2I",
                "ops": [{"op": "bind", "node_id": "3", "input_name": "seed",
                         "from": "seed"}],
            })

    async def test_unknown_node_and_input_rejected(self, workflow_row):
        from ComfyTV.api.mcp_tools import _workflow_edit
        with pytest.raises(ValueError, match="not in this workflow"):
            await _workflow_edit({
                "kind": "image", "label": "Test T2I",
                "ops": [{"op": "bind", "node_id": "99", "input_name": "seed",
                         "from": "option:seed"}],
            })
        with pytest.raises(ValueError, match="has no input"):
            await _workflow_edit({
                "kind": "image", "label": "Test T2I",
                "ops": [{"op": "bind", "node_id": "3", "input_name": "nope",
                         "from": "option:seed"}],
            })

    async def test_validation_is_atomic(self, workflow_row):
        from ComfyTV.api.mcp_tools import _workflow_edit, _workflow_get
        with pytest.raises(ValueError):
            await _workflow_edit({
                "kind": "image", "label": "Test T2I",
                "ops": [
                    {"op": "bind", "node_id": "3", "input_name": "seed",
                     "from": "option:seed"},
                    {"op": "bind", "node_id": "3", "input_name": "seed",
                     "from": "bogus"},
                ],
            })
        out = await _workflow_get({"kind": "image", "label": "Test T2I"})
        assert out["bindings"] == []

    async def test_set_meta(self, workflow_row):
        from ComfyTV.api.mcp_tools import _workflow_edit, _workflow_get
        await _workflow_edit({
            "kind": "image", "label": "Test T2I",
            "ops": [{"op": "set_meta", "description": "hi there"}],
        })
        out = await _workflow_get({"kind": "image", "label": "Test T2I"})
        assert out["description"] == "hi there"

    async def test_invalid_cast_and_op(self, workflow_row):
        from ComfyTV.api.mcp_tools import _workflow_edit
        with pytest.raises(ValueError, match="invalid cast"):
            await _workflow_edit({
                "kind": "image", "label": "Test T2I",
                "ops": [{"op": "bind", "node_id": "3", "input_name": "seed",
                         "from": "option:seed", "cast": "bool"}],
            })
        with pytest.raises(ValueError, match="unknown op"):
            await _workflow_edit({
                "kind": "image", "label": "Test T2I",
                "ops": [{"op": "explode"}],
            })

    async def test_upstream_from_accepted(self, workflow_row):
        from ComfyTV.api.mcp_tools import _workflow_edit
        out = await _workflow_edit({
            "kind": "image", "label": "Test T2I",
            "ops": [{"op": "bind", "node_id": "3", "input_name": "steps",
                     "from": "upstream_image:value[1]"}],
        })
        assert out["results"][0]["ok"]


class TestAssetEdit:
    async def test_create_with_named_categories(self, reset_db):
        from ComfyTV.api.mcp_tools import _asset_edit
        out = await _asset_edit({
            "action": "create", "name": "hero",
            "payload_url": "/view?filename=a.png&type=output",
            "categories": ["chars", "chase"],
        })
        assert out["asset"]["name"] == "hero"
        assert len(out["asset"]["category_ids"]) == 2

    async def test_update_and_delete(self, reset_db):
        from ComfyTV.api.mcp_tools import _asset_edit
        created = await _asset_edit({
            "action": "create", "payload_url": "/view?x", "name": "old",
        })
        aid = created["asset"]["id"]
        out = await _asset_edit({"action": "update", "asset_id": aid,
                                 "name": "new"})
        assert out["asset"]["name"] == "new"
        out = await _asset_edit({"action": "delete", "asset_id": aid})
        assert out["ok"] is True
        with pytest.raises(ValueError, match="not found"):
            await _asset_edit({"action": "delete", "asset_id": aid})

    async def test_bad_media_type(self, reset_db):
        from ComfyTV.api.mcp_tools import _asset_edit
        with pytest.raises(ValueError, match="media_type"):
            await _asset_edit({"action": "create", "payload_url": "/x",
                               "media_type": "gif"})


class TestEntriesTool:
    async def test_upsert_list_delete(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.api.mcp_tools import _entries
        storage.ensure_default_project()
        out = await _entries({"action": "upsert", "kind": "fragment",
                              "label": "camera_style",
                              "content": "low angle, 35mm"})
        eid = out["entry"]["id"]
        out = await _entries({"action": "list", "kind": "fragment"})
        assert any(e["id"] == eid for e in out["entries"])
        out = await _entries({"action": "delete", "id": eid})
        assert out["ok"] is True

    async def test_bad_kind_and_label(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.api.mcp_tools import _entries
        storage.ensure_default_project()
        with pytest.raises(ValueError, match="unknown kind"):
            await _entries({"action": "upsert", "kind": "nope", "label": "x"})
        with pytest.raises(ValueError, match="invalid label"):
            await _entries({"action": "upsert", "kind": "fragment",
                            "label": "0bad"})


class TestResourcesTool:
    async def test_list_and_kind_filter(self, reset_db):
        from ComfyTV.api.mcp_tools import _resources
        out = await _resources({})
        assert out["kinds"] == ["lut", "font", "soundfont"]
        assert isinstance(out["resources"], list)
        with pytest.raises(ValueError, match="unknown kind"):
            await _resources({"kind": "shader"})
