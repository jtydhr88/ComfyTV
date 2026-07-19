from __future__ import annotations

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
async def client(reset_db, monkeypatch):
    from ComfyTV import api  # noqa: F401 — registers routes on the stub PromptServer
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


async def _mk_preset(client, kind="ComfyTV.VideoColorStage", name="warm", config=None):
    resp = await client.post("/comfytv/presets", json={
        "kind": kind,
        "name": name,
        "config": config if config is not None else {"exposure": 0.5},
    })
    return resp


def _user_rows(payload):
    return [p for p in payload["presets"] if not p["builtin"]]


class TestPresetRoutes:
    async def test_create_list_patch_delete(self, client):
        preset = (await (await _mk_preset(client)).json())["preset"]
        assert preset["kind"] == "ComfyTV.VideoColorStage"
        assert preset["name"] == "warm"
        assert preset["config"] == {"exposure": 0.5}
        assert preset["created_at"]

        listed = await (await client.get("/comfytv/presets")).json()
        assert [p["id"] for p in _user_rows(listed)] == [preset["id"]]

        r = await client.patch(f"/comfytv/presets/{preset['id']}", json={"name": "warmer"})
        assert (await r.json())["preset"]["name"] == "warmer"

        r = await client.patch(f"/comfytv/presets/{preset['id']}",
                               json={"config": {"exposure": 1.0}})
        assert (await r.json())["preset"]["config"] == {"exposure": 1.0}

        r = await client.delete(f"/comfytv/presets/{preset['id']}")
        assert r.status == 200
        r = await client.delete(f"/comfytv/presets/{preset['id']}")
        assert r.status == 404

    async def test_upsert_by_kind_and_name(self, client):
        first = (await (await _mk_preset(client, config={"exposure": 0.5})).json())["preset"]
        second = (await (await _mk_preset(client, config={"exposure": -1.0})).json())["preset"]
        assert second["id"] == first["id"]
        assert second["config"] == {"exposure": -1.0}
        listed = await (await client.get("/comfytv/presets")).json()
        assert len(_user_rows(listed)) == 1

    async def test_same_name_different_kind_is_distinct(self, client):
        a = (await (await _mk_preset(client, kind="ComfyTV.VideoColorStage")).json())["preset"]
        b = (await (await _mk_preset(client, kind="ComfyTV.ColorGradeStage")).json())["preset"]
        assert a["id"] != b["id"]

    async def test_list_filtered_by_kind(self, client):
        await _mk_preset(client, kind="ComfyTV.VideoColorStage", name="a")
        await _mk_preset(client, kind="ComfyTV.ColorGradeStage", name="b")
        rows = await (await client.get(
            "/comfytv/presets?kind=ComfyTV.ColorGradeStage")).json()
        assert [p["name"] for p in _user_rows(rows)] == ["b"]
        assert all(not p["builtin"] for p in rows["presets"])

    async def test_list_without_kind_returns_all_kinds(self, client):
        await _mk_preset(client, kind="ComfyTV.VideoColorStage", name="a")
        await _mk_preset(client, kind="ComfyTV.ColorGradeStage", name="b")
        for url in ("/comfytv/presets", "/comfytv/presets?kind="):
            r = await client.get(url)
            assert r.status == 200
            rows = _user_rows(await r.json())
            assert sorted(p["name"] for p in rows) == ["a", "b"]
            assert {p["kind"] for p in rows} == {
                "ComfyTV.VideoColorStage", "ComfyTV.ColorGradeStage",
            }

    async def test_create_requires_fields(self, client):
        r = await client.post("/comfytv/presets", json={"name": "x", "config": {}})
        assert r.status == 400
        r = await client.post("/comfytv/presets", json={"kind": "k", "config": {}})
        assert r.status == 400
        r = await client.post("/comfytv/presets",
                              json={"kind": "k", "name": "x", "config": "nope"})
        assert r.status == 400

    async def test_patch_rename_clash_404(self, client):
        await _mk_preset(client, name="a")
        b = (await (await _mk_preset(client, name="b")).json())["preset"]
        r = await client.patch(f"/comfytv/presets/{b['id']}", json={"name": "a"})
        assert r.status == 404

    async def test_patch_unknown_id(self, client):
        r = await client.patch("/comfytv/presets/9999", json={"name": "x"})
        assert r.status == 404


CURVES_KIND = "ComfyTV.VideoCurvesStage"
CURVES_BUILTIN_NAMES = [
    "color_negative", "cross_process", "darker", "increase_contrast",
    "lighter", "linear_contrast", "medium_contrast", "negative",
    "strong_contrast", "vintage",
]


class TestBuiltinPresets:
    async def test_registry_fields_are_whitelisted(self):
        from ComfyTV.nodes.stages.common.builtin_presets import BUILTIN_PRESETS
        from ComfyTV.nodes.stages.common.preset_fields import PRESET_FIELDS

        assert BUILTIN_PRESETS
        for kind, entries in BUILTIN_PRESETS.items():
            assert kind in PRESET_FIELDS, kind
            names = [e["name"] for e in entries]
            assert len(names) == len(set(names)), kind
            for entry in entries:
                assert entry["name"]
                for field in entry["config"]:
                    assert field in PRESET_FIELDS[kind], (
                        f"{kind}:{entry['name']} field {field!r} not whitelisted"
                    )

    async def test_curves_builtin_points_parse(self):
        from ComfyTV.nodes.stages.common.builtin_presets import BUILTIN_PRESETS
        from ComfyTV.nodes.stages.video_color import _curve_points_arg

        entries = BUILTIN_PRESETS[CURVES_KIND]
        assert [e["name"] for e in entries] == CURVES_BUILTIN_NAMES
        for entry in entries:
            config = entry["config"]
            assert config["preset"] == "none"
            channels = [config[k] for k in
                        ("master_pts", "red_pts", "green_pts", "blue_pts")]
            assert any(channels), entry["name"]
            for raw in channels:
                if not raw:
                    continue
                arg = _curve_points_arg(raw)
                assert arg, f"{entry['name']}: unparseable points {raw!r}"
                assert len(arg.split()) >= 2

    async def test_list_merges_builtins_first(self, client):
        await _mk_preset(client, kind=CURVES_KIND, name="mine",
                         config={"master_pts": "[[0,0],[0.5,0.6],[1,1]]"})
        rows = (await (await client.get(
            f"/comfytv/presets?kind={CURVES_KIND}")).json())["presets"]
        builtins = [p for p in rows if p["builtin"]]
        assert [p["name"] for p in builtins] == CURVES_BUILTIN_NAMES
        assert rows[:len(builtins)] == builtins
        for p in builtins:
            assert p["id"] == f"builtin:{CURVES_KIND}:{p['name']}"
            assert p["kind"] == CURVES_KIND
            assert p["created_at"] is None
            assert p["config"]["preset"] == "none"
        users = [p for p in rows if not p["builtin"]]
        assert [p["name"] for p in users] == ["mine"]
        assert all(isinstance(p["id"], int) for p in users)

    async def test_unfiltered_list_includes_builtins(self, client):
        rows = (await (await client.get("/comfytv/presets")).json())["presets"]
        assert {p["name"] for p in rows if p["builtin"]
                and p["kind"] == CURVES_KIND} == set(CURVES_BUILTIN_NAMES)

    async def test_patch_delete_builtin_id_rejected(self, client):
        bid = f"builtin:{CURVES_KIND}:vintage"
        r = await client.patch(f"/comfytv/presets/{bid}", json={"name": "x"})
        assert r.status == 400
        assert "read-only" in (await r.json())["error"]
        r = await client.delete(f"/comfytv/presets/{bid}")
        assert r.status == 400
        assert "read-only" in (await r.json())["error"]

    async def test_patch_delete_non_numeric_id_404(self, client):
        r = await client.patch("/comfytv/presets/abc", json={"name": "x"})
        assert r.status == 404
        r = await client.delete("/comfytv/presets/abc")
        assert r.status == 404

    async def test_post_builtin_name_collision_400(self, client):
        r = await _mk_preset(client, kind=CURVES_KIND, name="vintage",
                             config={"master_pts": ""})
        assert r.status == 400
        assert "reserved" in (await r.json())["error"]
        r = await _mk_preset(client, kind="ComfyTV.VideoColorStage",
                             name="vintage")
        assert r.status == 200


class TestStageDefaults:
    async def test_video_color_defaults(self, client):
        r = await client.get("/comfytv/stage_defaults?node_id=ComfyTV.VideoColorStage")
        assert r.status == 200
        defaults = (await r.json())["defaults"]
        assert defaults["exposure"] == 0.0
        assert defaults["temperature"] == 6500
        assert defaults["whitepoint"] == 1.0
        assert defaults["preserve_lightness"] is True
        assert defaults["shadows_r"] == 0.0
        assert "force_run_token" not in defaults
        assert "project_id" not in defaults
        assert "parent_output_id" not in defaults
        assert "video" not in defaults

    async def test_curves_combo_default(self, client):
        r = await client.get("/comfytv/stage_defaults?node_id=ComfyTV.VideoCurvesStage")
        assert r.status == 200
        defaults = (await r.json())["defaults"]
        assert defaults["preset"] == "none"

    async def test_whitelist_filters_fields(self, client):
        r = await client.get("/comfytv/stage_defaults?node_id=ComfyTV.VideoTransitionStage")
        assert r.status == 200
        defaults = (await r.json())["defaults"]
        assert defaults["transition"] == "fade"
        assert defaults["duration"] == 1.0
        assert "offset" not in defaults

    async def test_unregistered_node_returns_empty_defaults(self, client):
        for node_id in ("ComfyTV.VideoClipStage", "ComfyTV.VideoCropStage",
                        "ComfyTV.SubtitleStage"):
            r = await client.get(f"/comfytv/stage_defaults?node_id={node_id}")
            assert r.status == 200
            assert (await r.json())["defaults"] == {}

    async def test_unknown_node_id_404(self, client):
        r = await client.get("/comfytv/stage_defaults?node_id=ComfyTV.NopeStage")
        assert r.status == 404

    async def test_missing_node_id_400(self, client):
        r = await client.get("/comfytv/stage_defaults")
        assert r.status == 400


class TestPresetFieldRegistry:
    async def test_every_registered_field_exists_socketless_hidden(self):
        from ComfyTV.api import presets
        from ComfyTV.nodes.stages.common.preset_fields import PRESET_FIELDS

        mapping = await presets._stage_class_map()
        assert PRESET_FIELDS
        for node_id, fields in PRESET_FIELDS.items():
            assert node_id in mapping, f"unknown node_id in PRESET_FIELDS: {node_id}"
            assert fields, f"empty field tuple for {node_id}"
            assert len(fields) == len(set(fields)), f"duplicate fields for {node_id}"
            candidates = presets._candidate_defaults(mapping[node_id])
            for field in fields:
                assert field in candidates, (
                    f"{node_id}.{field} is not a socketless+hidden schema input"
                )

    async def test_registered_defaults_match_whitelist_exactly(self):
        from ComfyTV.api import presets
        from ComfyTV.nodes.stages.common.preset_fields import PRESET_FIELDS

        mapping = await presets._stage_class_map()
        for node_id, fields in PRESET_FIELDS.items():
            defaults = presets._stage_defaults(node_id, mapping[node_id])
            assert set(defaults) == set(fields), node_id
