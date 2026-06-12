"""Tests for api.py — HTTP route handlers + _compute_input_usage.

`api` imports `PromptServer.instance.routes` and registers handlers as
decorators on that RouteTableDef at import time. We mount the same
RouteTableDef onto an aiohttp test Application and drive it via
AioHTTPTestCase-style fixtures.
"""

from __future__ import annotations

import json
import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


# ─── pure: _compute_input_usage ──────────────────────────────────────────────

class TestComputeInputUsage:
    def _api(self):
        from ComfyTV import api
        return api._compute_input_usage

    def test_empty_bindings(self):
        out = self._api()([])
        assert out["uses"]     == {"image": False, "video": False,
                                   "audio": False, "text":  False}
        assert out["requires"] == {"image": False, "video": False,
                                   "audio": False, "text":  False}
        assert out["max_inputs"] == {"image": 0, "video": 0,
                                     "audio": 0, "text":  0}

    def test_main_prompt_marks_text_unbounded(self):
        out = self._api()([{"from": "main_prompt", "required": False}])
        assert out["uses"]["text"] is True
        assert out["max_inputs"]["text"] is None  # unbounded

    def test_upstream_image_bumps_max(self):
        out = self._api()([
            {"from": "upstream_image:annotated[2]", "required": True},
        ])
        assert out["uses"]["image"] is True
        assert out["requires"]["image"] is True
        assert out["max_inputs"]["image"] == 3

    def test_multiple_bumps_keep_highest(self):
        out = self._api()([
            {"from": "upstream_image:annotated", "required": False},
            {"from": "upstream_image:annotated[3]", "required": False},
        ])
        assert out["max_inputs"]["image"] == 4

    def test_required_propagates(self):
        out = self._api()([
            {"from": "upstream_video:annotated", "required": True},
        ])
        assert out["requires"]["video"] is True

    def test_requires_count_simple(self):
        # `upstream_image:annotated` (no [N]) → idx=0 → count=1
        out = self._api()([
            {"from": "upstream_image:annotated", "required": True},
        ])
        assert out["requires_count"]["image"] == 1

    def test_requires_count_indexed(self):
        # `[1]` with required=true → count=2 (need slots 0 AND 1)
        out = self._api()([
            {"from": "upstream_image:annotated[0]", "required": True},
            {"from": "upstream_image:annotated[1]", "required": True},
        ])
        assert out["requires_count"]["image"] == 2

    def test_requires_count_max_wins(self):
        # Highest required idx+1 dominates, even if intermediate is optional
        out = self._api()([
            {"from": "upstream_image:annotated[0]", "required": True},
            {"from": "upstream_image:annotated[1]", "required": False},
            {"from": "upstream_image:annotated[2]", "required": True},
        ])
        assert out["requires_count"]["image"] == 3

    def test_requires_count_unrequired_zero(self):
        # All optional → count stays 0 even though max_inputs grows
        out = self._api()([
            {"from": "upstream_image:annotated[0]"},
            {"from": "upstream_image:annotated[2]"},
        ])
        assert out["requires_count"]["image"] == 0
        assert out["max_inputs"]["image"] == 3

    def test_upstream_image_masked_counts_like_annotated(self):
        out = self._api()([
            {"from": "upstream_image:masked[0]", "required": True},
        ])
        assert out["uses"]["image"] is True
        assert out["requires"]["image"] is True
        assert out["requires_count"]["image"] == 1
        assert out["max_inputs"]["image"] == 1

    def test_ignores_unmatching(self):
        out = self._api()([
            {"from": "literal:abc"},
            {"from": "computed:width"},
            {"from": "option:foo"},
        ])
        assert all(v is False for v in out["uses"].values())


# ─── HTTP routes — through aiohttp test client ──────────────────────────────


@pytest.fixture()
async def client(reset_db, monkeypatch):
    """Mount the RouteTableDef populated at api-import time onto a fresh
    aiohttp Application + return a connected TestClient."""
    from ComfyTV import api  # registers routes against the stub PromptServer

    # api uses PromptServer.instance.routes which our conftest stubbed. The
    # decorator-registered routes are on that RouteTableDef.
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)

    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


class TestProjectRoutes:
    async def test_list_projects(self, client):
        resp = await client.get("/comfytv/projects")
        assert resp.status == 200
        data = await resp.json()
        # ensure_default_project guarantees at least one row.
        ids = [p["id"] for p in data["projects"]]
        assert "default" in ids

    async def test_create_project(self, client):
        resp = await client.post("/comfytv/projects", json={"name": "My Proj"})
        assert resp.status == 200
        data = await resp.json()
        assert data["ok"] is True
        assert data["project"]["name"] == "My Proj"

    async def test_create_project_no_body(self, client):
        resp = await client.post("/comfytv/projects")  # no JSON body
        assert resp.status == 200
        data = await resp.json()
        assert data["project"]["name"] == "Untitled"

    async def test_get_project(self, client):
        from ComfyTV import storage
        storage.ensure_default_project()
        resp = await client.get("/comfytv/projects/default")
        assert resp.status == 200

    async def test_get_project_missing(self, client):
        resp = await client.get("/comfytv/projects/nope")
        assert resp.status == 404

    async def test_patch_project_rename(self, client):
        from ComfyTV import storage
        proj = storage.create_project("Orig")
        resp = await client.patch(
            f"/comfytv/projects/{proj['id']}", json={"name": "Renamed"},
        )
        assert resp.status == 200
        data = await resp.json()
        assert data["project"]["name"] == "Renamed"

    async def test_patch_project_no_fields(self, client):
        from ComfyTV import storage
        proj = storage.create_project("X")
        resp = await client.patch(f"/comfytv/projects/{proj['id']}", json={})
        assert resp.status == 400

    async def test_patch_project_invalid_json(self, client):
        from ComfyTV import storage
        proj = storage.create_project("X")
        resp = await client.patch(
            f"/comfytv/projects/{proj['id']}",
            data="not json", headers={"Content-Type": "application/json"},
        )
        assert resp.status == 400

    async def test_patch_project_missing(self, client):
        resp = await client.patch("/comfytv/projects/nope",
                                  json={"name": "X"})
        assert resp.status == 404

    async def test_delete_project(self, client):
        from ComfyTV import storage
        proj = storage.create_project("Delete me")
        resp = await client.delete(f"/comfytv/projects/{proj['id']}")
        assert resp.status == 200

    async def test_delete_default_refused(self, client):
        resp = await client.delete("/comfytv/projects/default")
        assert resp.status == 400


class TestOutputsRoutes:
    async def test_list_outputs(self, client):
        from ComfyTV import storage
        storage.persist_output(
            project_id="default", stage_class="ImageStage",
            stage_node_id="9", output_type="image", payload_url="/view?x",
        )
        resp = await client.get("/comfytv/projects/default/outputs")
        data = await resp.json()
        assert len(data["outputs"]) >= 1

    async def test_list_outputs_filtered(self, client):
        from ComfyTV import storage
        storage.persist_output(
            project_id="default", stage_class="X", stage_node_id="A",
            output_type="image", payload_url="/a",
        )
        storage.persist_output(
            project_id="default", stage_class="X", stage_node_id="B",
            output_type="image", payload_url="/b",
        )
        resp = await client.get("/comfytv/projects/default/outputs",
                                params={"stage_node_id": "B", "limit": "10"})
        data = await resp.json()
        assert len(data["outputs"]) == 1
        assert data["outputs"][0]["stage_node_id"] == "B"

    async def test_list_outputs_invalid_limit(self, client):
        # Invalid limit should fall back to default (50), not error.
        resp = await client.get("/comfytv/projects/default/outputs",
                                params={"limit": "garbage"})
        assert resp.status == 200

    async def test_latest_output_needs_node(self, client):
        resp = await client.get("/comfytv/projects/default/outputs/latest")
        assert resp.status == 400

    async def test_latest_output(self, client):
        from ComfyTV import storage
        storage.persist_output(
            project_id="default", stage_class="X", stage_node_id="9",
            output_type="image", payload_url="/x",
        )
        resp = await client.get("/comfytv/projects/default/outputs/latest",
                                params={"stage_node_id": "9"})
        data = await resp.json()
        assert data["output"]["payload_url"] == "/x"


class TestStagesRoute:
    async def test_list_stages_returns_meta(self, client):
        resp = await client.get("/comfytv/stages")
        assert resp.status == 200
        data = await resp.json()
        assert isinstance(data["stages"], list)


class TestWorkflowInfoRoute:
    async def test_uses_dict_and_stubs(self, client, tmp_path, monkeypatch):
        from pathlib import Path
        from ComfyTV.runners import workflow_db
        wdir = tmp_path / "workflows"
        kdir = wdir / "image"
        kdir.mkdir(parents=True)
        (kdir / "x.json").write_text(json.dumps({"nodes": []}))
        (kdir / "x_preset.json").write_text(json.dumps({
            "label": "X",
            "inputs": {"3": {"seed": {"from": "upstream_image:annotated[1]", "required": True}}},
        }))
        monkeypatch.setattr(workflow_db.seed, "_WORKFLOWS_DIR", Path(wdir))
        workflow_db.seed_workflows_from_disk(("image",))

        resp = await client.get("/comfytv/workflow_info")
        assert resp.status == 200
        data = await resp.json()
        # Bound workflow appears
        assert "X" in data.get("image", {})
        # max_inputs.image should be 2 (idx 1 + 1)
        assert data["image"]["X"]["max_inputs"]["image"] == 2


class TestWorkflowConfigRoutes:
    async def _seed_one(self, monkeypatch, tmp_path,
                        preset=None, kind="image", name="x"):
        from pathlib import Path
        from ComfyTV.runners import workflow_db
        wdir = tmp_path / "workflows"
        kdir = wdir / kind
        kdir.mkdir(parents=True, exist_ok=True)
        (kdir / f"{name}.json").write_text(json.dumps({"nodes": []}))
        if preset:
            (kdir / f"{name}_preset.json").write_text(json.dumps(preset))
        monkeypatch.setattr(workflow_db.seed, "_WORKFLOWS_DIR", Path(wdir))
        workflow_db.seed_workflows_from_disk((kind,))

    async def test_state_unknown(self, client):
        resp = await client.get("/comfytv/workflows/state",
                                params={"kind": "image", "label": "Nope"})
        assert resp.status == 404

    async def test_state_missing_params(self, client):
        resp = await client.get("/comfytv/workflows/state")
        assert resp.status == 400

    async def test_state_known(self, client, tmp_path, monkeypatch):
        await self._seed_one(monkeypatch, tmp_path)
        resp = await client.get("/comfytv/workflows/state",
                                params={"kind": "image", "label": "X"})
        assert resp.status == 200
        data = await resp.json()
        assert data["has_api"] is False

    async def test_file_route(self, client, tmp_path, monkeypatch):
        await self._seed_one(monkeypatch, tmp_path)
        resp = await client.get("/comfytv/workflows/file",
                                params={"kind": "image", "label": "X"})
        assert resp.status == 200
        assert "X-Workflow-Mtime" in resp.headers

    async def test_file_route_unknown(self, client):
        resp = await client.get("/comfytv/workflows/file",
                                params={"kind": "image", "label": "Nope"})
        assert resp.status == 404

    async def test_file_route_missing_params(self, client):
        resp = await client.get("/comfytv/workflows/file")
        assert resp.status == 400

    async def test_get_config(self, client, tmp_path, monkeypatch):
        await self._seed_one(monkeypatch, tmp_path)
        resp = await client.get("/comfytv/workflows/config",
                                params={"kind": "image", "label": "X"})
        assert resp.status == 200
        data = await resp.json()
        assert data["label"] == "X"
        assert isinstance(data["bindings"], list)

    async def test_get_config_missing(self, client):
        resp = await client.get("/comfytv/workflows/config",
                                params={"kind": "image", "label": "Nope"})
        assert resp.status == 404

    async def test_get_config_missing_params(self, client):
        resp = await client.get("/comfytv/workflows/config")
        assert resp.status == 400

    async def test_export_preset(self, client, tmp_path, monkeypatch):
        await self._seed_one(monkeypatch, tmp_path, preset={
            "label": "Fancy Workflow",
            "description": "test desc",
            "inputs": {"3": {"seed": {"from": "option:seed", "cast": "int"}}},
        })
        resp = await client.get("/comfytv/workflows/preset",
                                params={"kind": "image", "label": "Fancy Workflow"})
        assert resp.status == 200
        # Content-Disposition + filename slugified from label
        cd = resp.headers.get("Content-Disposition", "")
        assert 'attachment' in cd
        assert "fancy-workflow_preset.json" in cd
        body = await resp.json()
        assert body["label"] == "Fancy Workflow"
        assert body["description"] == "test desc"
        assert body["inputs"]["3"]["seed"]["from"] == "option:seed"

    async def test_export_preset_missing_params(self, client):
        resp = await client.get("/comfytv/workflows/preset")
        assert resp.status == 400

    async def test_export_preset_unknown(self, client):
        resp = await client.get("/comfytv/workflows/preset",
                                params={"kind": "image", "label": "Nope"})
        assert resp.status == 404

    async def test_upsert_binding(self, client, tmp_path, monkeypatch):
        await self._seed_one(monkeypatch, tmp_path)
        # Fetch the workflow id
        resp = await client.get("/comfytv/workflows/config",
                                params={"kind": "image", "label": "X"})
        wid = (await resp.json())["id"]
        resp = await client.post("/comfytv/workflows/config/binding", json={
            "workflow_id": wid, "node_id": "3", "input_name": "seed",
            "from": "option:seed", "required": True, "cast": "int",
        })
        assert resp.status == 200

    async def test_upsert_binding_bad_payload(self, client):
        resp = await client.post("/comfytv/workflows/config/binding", json={})
        assert resp.status == 400

    async def test_upsert_binding_no_json(self, client):
        resp = await client.post(
            "/comfytv/workflows/config/binding",
            data="not json", headers={"Content-Type": "application/json"},
        )
        assert resp.status == 400

    async def test_upsert_binding_unknown_workflow(self, client):
        resp = await client.post("/comfytv/workflows/config/binding", json={
            "workflow_id": 99999, "node_id": "3", "input_name": "seed",
            "from": "option:seed",
        })
        assert resp.status == 404

    async def test_delete_binding(self, client, tmp_path, monkeypatch):
        await self._seed_one(monkeypatch, tmp_path, preset={
            "inputs": {"3": {"seed": {"from": "option:seed"}}},
        })
        resp = await client.get("/comfytv/workflows/config",
                                params={"kind": "image", "label": "X"})
        wid = (await resp.json())["id"]
        resp = await client.delete("/comfytv/workflows/config/binding", json={
            "workflow_id": wid, "node_id": "3", "input_name": "seed",
        })
        data = await resp.json()
        assert data["ok"] is True

    async def test_delete_binding_bad_payload(self, client):
        resp = await client.delete("/comfytv/workflows/config/binding", json={})
        assert resp.status == 400

    async def test_delete_binding_no_json(self, client):
        resp = await client.delete(
            "/comfytv/workflows/config/binding",
            data="x", headers={"Content-Type": "application/json"},
        )
        assert resp.status == 400

    async def test_update_meta(self, client, tmp_path, monkeypatch):
        await self._seed_one(monkeypatch, tmp_path)
        resp = await client.get("/comfytv/workflows/config",
                                params={"kind": "image", "label": "X"})
        wid = (await resp.json())["id"]
        resp = await client.post("/comfytv/workflows/config/meta", json={
            "workflow_id": wid,
            "description": "new",
            "sizing": {"base": 1024, "snap": 16},
            "result_type": "ui_save_url", "result_node": "9",
            "prune_when_missing": [],
        })
        assert resp.status == 200

    async def test_update_meta_bad_payload(self, client):
        resp = await client.post("/comfytv/workflows/config/meta", json={})
        assert resp.status == 400

    async def test_update_meta_no_json(self, client):
        resp = await client.post(
            "/comfytv/workflows/config/meta",
            data="x", headers={"Content-Type": "application/json"},
        )
        assert resp.status == 400

    async def test_update_meta_unknown_workflow(self, client):
        resp = await client.post("/comfytv/workflows/config/meta", json={
            "workflow_id": 99999, "description": "x",
        })
        assert resp.status == 404

    async def test_set_api_json(self, client, tmp_path, monkeypatch):
        await self._seed_one(monkeypatch, tmp_path)
        resp = await client.post("/comfytv/workflows/api_json", json={
            "kind": "image", "label": "X",
            "api_json": {"3": {"class_type": "KSampler"}},
            "file_mtime": 12345.6,
        })
        assert resp.status == 200

    async def test_set_api_json_missing_params(self, client):
        resp = await client.post("/comfytv/workflows/api_json", json={
            "api_json": {}, "file_mtime": 1.0,
        })
        assert resp.status == 400

    async def test_set_api_json_bad_apijson_type(self, client):
        resp = await client.post("/comfytv/workflows/api_json", json={
            "kind": "image", "label": "X", "api_json": "not dict",
            "file_mtime": 1.0,
        })
        assert resp.status == 400

    async def test_set_api_json_bad_mtime(self, client):
        resp = await client.post("/comfytv/workflows/api_json", json={
            "kind": "image", "label": "X", "api_json": {}, "file_mtime": "x",
        })
        assert resp.status == 400

    async def test_set_api_json_unknown_workflow(self, client):
        resp = await client.post("/comfytv/workflows/api_json", json={
            "kind": "image", "label": "Nope",
            "api_json": {}, "file_mtime": 1.0,
        })
        assert resp.status == 404

    async def test_set_api_json_no_json_body(self, client):
        resp = await client.post(
            "/comfytv/workflows/api_json",
            data="x", headers={"Content-Type": "application/json"},
        )
        assert resp.status == 400
