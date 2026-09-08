from __future__ import annotations

import json
from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from ComfyTV.runners import custom_io as cio


RAW = {
    "inputs": [
        {"node": "17", "input": "image", "kind": "image", "label": "Start frame"},
        {"node": "18", "input": "image", "kind": "image", "label": "End frame", "required": False},
        {"node": "47:23", "input": "text", "kind": "text", "label": "Prompt", "default": "a cat"},
        {"node": "48", "input": "text", "kind": "text", "label": "Main", "default": "dog", "prompt": True},
        {"node": "3", "input": "seed", "kind": "param", "ptype": "INT", "default": 5},
        {"node": "3", "input": "seed", "kind": "param", "ptype": "INT"},
        {"node": "9", "input": "x", "kind": "nope"},
    ],
    "outputs": [
        {"node": "92", "kind": "video", "label": "Save Video"},
        {"node": "115", "kind": "image"},
        {"node": "116", "kind": "image"},
        {"node": "117", "kind": "bogus"},
    ],
}


class TestNormalize:
    def test_slots_labels_and_dedupe(self):
        n = cio.normalize_custom_io(RAW)
        ins = n["inputs"]
        assert [i["node"] for i in ins] == ["17", "18", "47:23", "48", "3"]
        assert ins[2]["prompt"] is False and ins[3]["prompt"] is True and ins[3]["slot"] == 1
        assert ins[0]["slot"] == 0 and ins[1]["slot"] == 1
        assert ins[0]["required"] is True and ins[1]["required"] is False
        assert ins[2]["slot"] == 0 and ins[2]["key"] == "cio_47_23_text"
        assert ins[4]["kind"] == "param" and ins[4]["default"] == 5
        outs = n["outputs"]
        assert [o["node"] for o in outs] == ["92", "115"]
        assert outs[0]["label"] == "Save Video" and outs[1]["label"] == "image"

    def test_garbage_is_empty(self):
        assert cio.normalize_custom_io(None) == {"inputs": [], "outputs": []}
        assert cio.normalize_custom_io({"inputs": "x"}) == {"inputs": [], "outputs": []}


class TestBindings:
    def test_bindings_for(self):
        b = cio.bindings_for(cio.normalize_custom_io(RAW))
        by = {(x["node_id"], x["input_name"]): x for x in b}
        assert by[("17", "image")]["from"] == "upstream_image:annotated[0]"
        assert by[("17", "image")]["required"] is True
        assert "Start frame" in by[("17", "image")]["error_msg"]
        assert by[("18", "image")]["from"] == "upstream_image:annotated[1]"
        assert by[("18", "image")]["required"] is False
        assert by[("47:23", "text")]["from"] == "option:cio_47_23_text"
        assert by[("47:23", "text")]["default"] == "a cat"
        assert by[("47:23", "text")]["cast"] is None
        assert by[("48", "text")]["from"] == "main_prompt"
        assert by[("48", "text")]["default"] == "dog"
        assert by[("3", "seed")]["from"] == "option:cio_3_seed"
        assert by[("3", "seed")]["cast"] == "int"
        assert by[("3", "seed")]["default"] == "5"

    def test_result_meta(self):
        m = cio.result_meta_for(cio.normalize_custom_io(RAW))
        assert m["type"] == "multi" and m["node"] == "92"
        assert m["outputs"][0] == {"id": "video", "node": "92", "type": "ui_save_url", "kind": "video", "only_node": True}
        assert m["outputs"][1]["type"] == "ui_save_url" and m["outputs"][1]["kind"] == "image"
        assert cio.result_meta_for({"inputs": [], "outputs": []}) == {}


class TestUpstream:
    def test_autogrow_by_name(self):
        assert cio.autogrow_by_index({"image0": "a", "image2": "c"}, "image", 3) == ["a", None, "c"]

    def test_autogrow_compact_fallback(self):
        assert cio.autogrow_by_index(["a", "b"], "image", 3) == ["a", "b", None]
        assert cio.autogrow_by_index(None, "image", 2) == [None, None]

    def test_build_upstream_and_text_options(self):
        n = cio.normalize_custom_io(RAW)
        up = cio.build_upstream(n, {
            "images": {"image0": "/view?filename=a.png", "image1": None},
            "texts": {"text0": "hello", "text1": "ignored"},
        })
        assert up["images"] == ["/view?filename=a.png", None]
        assert up["texts"] == ["hello", "ignored"]
        assert up["videos"] == [None] and up["audio"] == [None] and up["models"] == [None]
        assert cio.linked_text_options(n, up) == {"cio_47_23_text": "hello"}
        assert cio.linked_text_options(n, {"texts": [None]}) == {}


class TestSplit:
    def test_multi_payload(self):
        n = cio.normalize_custom_io(RAW)
        by, pk, primary = cio.split_multi_payload(
            json.dumps({"multi": {"video": "/view?v", "image": "/view?i", "audio": "/view?x"}}), n)
        assert by == {"video": "/view?v", "image": "/view?i"}
        assert pk == "video" and primary == "/view?v"
        assert cio.slot_values(by) == ["/view?i", "", "/view?v", "", "", ""]

    def test_plain_payload_falls_to_primary(self):
        n = cio.normalize_custom_io({"outputs": [{"node": "1", "kind": "text"}]})
        by, pk, primary = cio.split_multi_payload("hello", n)
        assert by == {"text": "hello"} and pk == "text" and primary == "hello"


class _FakeExecutor:
    def __init__(self, history_outputs):
        self.history_result = {"outputs": history_outputs}


@pytest.mark.asyncio
async def test_extract_multi():
    from ComfyTV.runners import local_comfy as lc
    ex = _FakeExecutor({
        "92": {"images": [{"filename": "v.mp4", "subfolder": "", "type": "output"}]},
        "115": {"images": [{"filename": "i.png", "subfolder": "s", "type": "output"}]},
    })
    meta = cio.result_meta_for(cio.normalize_custom_io(RAW))
    out = json.loads(await lc._extract_result(ex, meta))
    assert "filename=v.mp4" in out["multi"]["video"]
    assert "filename=i.png" in out["multi"]["image"]


@pytest.mark.asyncio
async def test_extract_multi_batch_only_reads_its_node():
    from ComfyTV.runners import local_comfy as lc
    ex = _FakeExecutor({
        "3": {"images": [{"filename": "a.png", "subfolder": "", "type": "output"}]},
        "4": {"images": [{"filename": "b.png", "subfolder": "", "type": "output"}]},
        "6": {"images": [{"filename": "c.mp4", "subfolder": "", "type": "output"}]},
    })
    meta = cio.result_meta_for(cio.normalize_custom_io({"outputs": [
        {"node": "3", "kind": "images"}, {"node": "4", "kind": "image"}, {"node": "6", "kind": "video"},
    ]}))
    out = json.loads(await lc._extract_result(ex, meta))["multi"]
    batch = json.loads(out["images"])["images"]
    assert [b["image_url"] for b in batch] == [lc._view_url("a.png", "", "output")]
    assert "b.png" in out["image"] and "c.mp4" in out["video"]


def test_prepare_workflow_uses_multi(monkeypatch):
    from ComfyTV.runners import local_comfy as lc
    from ComfyTV.runners import workflow_db
    from ComfyTV.runners.base import RunnerContext
    n = cio.normalize_custom_io(RAW)
    monkeypatch.setattr(workflow_db, "get_workflow_for_invoke", lambda k, l: {
        "api_json": {"92": {"class_type": "SaveVideo", "inputs": {}},
                     "115": {"class_type": "SaveImage", "inputs": {}}},
        "result": {"type": "ui_save_url", "node": "92"},
        "inputs": {}, "sizing": {}, "prune_when_missing": [],
        "meta": {"custom_io": n},
    })
    wf, meta = lc.prepare_workflow("custom/x", {"custom"}, RunnerContext(kind="custom"))
    assert meta["type"] == "multi" and meta["node"] == "92"
    assert lc._execute_node_ids(wf, meta) == ["92", "115"]
    only_text = cio.result_meta_for(cio.normalize_custom_io({"outputs": [{"node": "115", "kind": "image"}]}))
    assert lc._execute_node_ids(wf, only_text) == ["115"]


def _seed(tmp_path, monkeypatch):
    from ComfyTV.runners import workflow_db as wdb
    wdir = tmp_path / "workflows"
    kdir = wdir / "custom"
    kdir.mkdir(parents=True, exist_ok=True)
    (kdir / "wf.json").write_text(json.dumps({"nodes": []}))
    monkeypatch.setattr(wdb.seed, "_WORKFLOWS_DIR", Path(wdir))
    wdb.seed_workflows_from_disk(("custom",))
    return wdb


def test_set_custom_io_roundtrip(reset_db, tmp_path, monkeypatch):
    wdb = _seed(tmp_path, monkeypatch)
    wid = wdb.get_workflow_config("custom", "wf")["id"]
    wdb.upsert_input_binding(wid, "3", "seed", "option:seed")

    cfg = wdb.set_custom_io(wid, RAW)
    assert cfg["result_type"] == "ui_save_url" and cfg["result_node"] == "92"
    assert [i["node"] for i in cfg["meta"]["custom_io"]["inputs"]] == ["17", "18", "47:23", "48", "3"]
    froms = {(b["node_id"], b["input_name"]): b["from"] for b in cfg["bindings"]}
    assert froms[("17", "image")] == "upstream_image:annotated[0]"
    assert froms[("3", "seed")] == "option:cio_3_seed"

    cfg2 = wdb.set_custom_io(wid, {"inputs": [RAW["inputs"][1]], "outputs": RAW["outputs"][1:]})
    froms2 = {(b["node_id"], b["input_name"]): b["from"] for b in cfg2["bindings"]}
    assert froms2 == {("18", "image"): "upstream_image:annotated[0]"}
    assert cfg2["result_node"] == "115"

    assert wdb.set_custom_io(99999, RAW) is None


@pytest.fixture()
async def client(reset_db, monkeypatch):
    from ComfyTV import api  # noqa: F401
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_client = TestClient(TestServer(app))
    await test_client.start_server()
    yield test_client
    await test_client.close()


@pytest.mark.asyncio
async def test_custom_io_route(client, tmp_path, monkeypatch):
    wdb = _seed(tmp_path, monkeypatch)
    wid = wdb.get_workflow_config("custom", "wf")["id"]
    resp = await client.post("/comfytv/workflows/config/custom_io", json={"workflow_id": wid, **RAW})
    assert resp.status == 200
    data = await resp.json()
    assert data["ok"] is True
    assert data["config"]["meta"]["custom_io"]["outputs"][0]["node"] == "92"

    resp = await client.post("/comfytv/workflows/config/custom_io", json={"workflow_id": 4242})
    assert resp.status == 404
    resp = await client.post("/comfytv/workflows/config/custom_io", json={})
    assert resp.status == 400


def test_duplicate_workflow_copies_config(reset_db, tmp_path, monkeypatch):
    wdb = _seed(tmp_path, monkeypatch)
    wid = wdb.get_workflow_config("custom", "wf")["id"]
    wdb.set_custom_io(wid, RAW)
    wdb.set_api_json("custom", "wf", {"17": {"class_type": "LoadImage", "inputs": {}}}, 1.0)

    cfg = wdb.duplicate_workflow(wid, "wf 竖版")
    assert cfg["label"] == "wf 竖版" and cfg["id"] != wid
    assert cfg["has_api"] is True
    assert cfg["result_node"] == "92"
    assert [i["node"] for i in cfg["meta"]["custom_io"]["inputs"]] == ["17", "18", "47:23", "48", "3"]
    assert {(b["node_id"], b["input_name"]) for b in cfg["bindings"]} == \
        {(b["node_id"], b["input_name"]) for b in wdb.get_workflow_config("custom", "wf")["bindings"]}
    assert Path(cfg["file_path"]).exists() and Path(cfg["file_path"]).name != "wf.json"

    wdb.set_custom_io(cfg["id"], {"inputs": [], "outputs": RAW["outputs"][:1]})
    assert len(wdb.get_workflow_config("custom", "wf")["meta"]["custom_io"]["inputs"]) == 5
    assert wdb.get_workflow_config("custom", "wf 竖版")["meta"]["custom_io"]["inputs"] == []

    with pytest.raises(ValueError):
        wdb.duplicate_workflow(wid, "wf 竖版")
    assert wdb.duplicate_workflow(99999, "x") is None


@pytest.mark.asyncio
async def test_duplicate_route(client, tmp_path, monkeypatch):
    wdb = _seed(tmp_path, monkeypatch)
    wid = wdb.get_workflow_config("custom", "wf")["id"]
    resp = await client.post(f"/comfytv/workflows/{wid}/duplicate", json={"label": "copy"})
    assert resp.status == 200
    assert (await resp.json())["config"]["label"] == "copy"
    resp = await client.post(f"/comfytv/workflows/{wid}/duplicate", json={"label": "copy"})
    assert resp.status == 400
    resp = await client.post("/comfytv/workflows/424242/duplicate", json={"label": "z"})
    assert resp.status == 404


@pytest.mark.asyncio
async def test_mcp_set_custom_io(reset_db, tmp_path, monkeypatch):
    from ComfyTV.api.mcp_tools import _workflow_edit, _workflow_get
    wdb = _seed(tmp_path, monkeypatch)
    wdb.set_api_json("custom", "wf", {
        "17": {"class_type": "LoadImage", "inputs": {"image": "a.png"}},
        "3": {"class_type": "KSampler", "inputs": {"seed": 1}},
        "92": {"class_type": "SaveVideo", "inputs": {}},
    }, 1.0)
    out = await _workflow_edit({"kind": "custom", "label": "wf", "ops": [{
        "op": "set_custom_io",
        "inputs": [{"node": "17", "input": "image", "kind": "image", "label": "Src"},
                   {"node": "3", "input": "seed", "kind": "param", "ptype": "INT", "default": 1}],
        "outputs": [{"node": "92", "kind": "video"}],
    }]})
    assert out["results"][0] == {"op": "set_custom_io", "ok": True, "inputs": 2, "outputs": 1}
    assert {b["from"] for b in out["bindings"]} == {"upstream_image:annotated[0]", "option:cio_3_seed"}
    out2 = await _workflow_edit({"kind": "custom", "label": "wf", "ops": [{
        "op": "set_custom_io",
        "inputs": [{"node": "3", "input": "seed", "kind": "param", "ptype": "INT"}],
        "outputs": [{"node": "92", "kind": "video"}],
    }]})
    seed = next(b for b in out2["bindings"] if b["input_name"] == "seed")
    assert seed["default"] == "1"
    got = await _workflow_get({"kind": "custom", "label": "wf"})
    assert got["custom_io"]["outputs"][0]["node"] == "92"
    assert got["result_node"] == "92"

    for bad in (
        {"op": "set_custom_io", "inputs": [], "outputs": []},
        {"op": "set_custom_io", "inputs": [{"node": "99", "input": "x", "kind": "image"}], "outputs": [{"node": "92", "kind": "video"}]},
        {"op": "set_custom_io", "inputs": [{"node": "3", "input": "nope", "kind": "param"}], "outputs": [{"node": "92", "kind": "video"}]},
        {"op": "set_custom_io", "inputs": [], "outputs": [{"node": "92", "kind": "movie"}]},
    ):
        with pytest.raises(ValueError):
            await _workflow_edit({"kind": "custom", "label": "wf", "ops": [bad]})


@pytest.mark.asyncio
async def test_mcp_duplicate_op(reset_db, tmp_path, monkeypatch):
    from ComfyTV.api.mcp_tools import _workflow_edit, _workflow_get
    wdb = _seed(tmp_path, monkeypatch)
    wdb.set_api_json("custom", "wf", {"92": {"class_type": "SaveVideo", "inputs": {}}}, 1.0)
    wdb.set_custom_io(wdb.get_workflow_config("custom", "wf")["id"], {"outputs": [{"node": "92", "kind": "video"}]})
    out = await _workflow_edit({"kind": "custom", "label": "wf", "ops": [{"op": "duplicate", "label": "wf copy"}]})
    assert out["results"][0]["ok"] is True and out["results"][0]["label"] == "wf copy"
    copy = await _workflow_get({"kind": "custom", "label": "wf copy"})
    assert copy["custom_io"]["outputs"][0]["node"] == "92"
    again = await _workflow_edit({"kind": "custom", "label": "wf", "ops": [{"op": "duplicate", "label": "wf copy"}]})
    assert again["results"][0]["ok"] is False and "already exists" in again["results"][0]["reason"]
    with pytest.raises(ValueError):
        await _workflow_edit({"kind": "custom", "label": "wf", "ops": [{"op": "duplicate", "label": " "}]})


def test_stage_params_blocked_for_custom(reset_db):
    from ComfyTV import storage
    from ComfyTV.nodes.stages.common.caps import caps_payload
    from ComfyTV.nodes.stages.common.invoke import _merge_custom_params
    assert storage.create_stage_param(kind="custom", label="Steps", type="int", default=4) is None
    assert storage.create_stage_param(kind="image", label="Steps", type="int", default=4) is not None
    assert "custom" not in {p["kind"] for p in storage.list_stage_params()}
    assert caps_payload()["caps_by_kind"]["custom"]["option_keys"] == []
    assert _merge_custom_params("custom", '{"items":[{"key":"cio_3_seed","value":7}]}', {"x": 1}) == {"cio_3_seed": 7, "x": 1}


@pytest.mark.asyncio
async def test_stage_param_routes_block_custom(client):
    resp = await client.post("/comfytv/stage_params", json={"kind": "custom", "label": "Steps", "type": "int"})
    assert resp.status == 400 and "custom" in (await resp.json())["error"]
    from ComfyTV.api.mcp_tools.stages import _stage_params_tool
    with pytest.raises(ValueError, match="custom"):
        await _stage_params_tool({"action": "create", "kind": "custom", "label": "Steps", "type": "int"})
