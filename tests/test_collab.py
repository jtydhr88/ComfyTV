"""Tests for api/collab.py — session cookie, presence relay, co-editing."""

from __future__ import annotations

import asyncio

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from ComfyTV.api import collab


@pytest.fixture(autouse=True)
def clean_peers():
    collab.clear_peers()
    yield
    collab.clear_peers()


@pytest.fixture()
async def client(reset_db):
    from ComfyTV import api, storage  # noqa: F401
    storage.set_settings({"enable-collab": True})
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_client = TestClient(TestServer(app))
    await test_client.start_server()
    yield test_client
    await test_client.close()


@pytest.fixture()
async def disabled_client(reset_db):
    from ComfyTV import api  # noqa: F401  (default: enable-collab off)
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_client = TestClient(TestServer(app))
    await test_client.start_server()
    yield test_client
    await test_client.close()


class TestCollabDisabled:
    async def test_everything_rejected_when_disabled(self, disabled_client):
        for path in ("/comfytv/collab/session", "/comfytv/collab/peers"):
            resp = await disabled_client.get(path)
            assert resp.status == 403
        resp = await disabled_client.get("/comfytv/collab")
        assert resp.status == 403  # the ws upgrade is refused outright


class TestCollabSession:
    async def test_issues_sid_and_cookie(self, client):
        resp = await client.get("/comfytv/collab/session")
        assert resp.status == 200
        data = await resp.json()
        assert len(data["sid"]) == 32
        cookie = resp.cookies.get(collab.SESSION_COOKIE)
        assert cookie is not None
        assert cookie.value == data["sid"]
        assert cookie["httponly"]

    async def test_sid_sticky_across_calls(self, client):
        first = await (await client.get("/comfytv/collab/session")).json()
        second = await (await client.get("/comfytv/collab/session")).json()
        assert first["sid"] == second["sid"]

    async def test_rejects_malformed_cookie(self, client):
        for bad in ("../evil", "¹²³⁴⁵⁶⁷⁸", "ABCDEF12"):
            resp = await client.get(
                "/comfytv/collab/session",
                headers={"Cookie": f"{collab.SESSION_COOKIE}={bad}"})
            data = await resp.json()
            assert data["sid"] != bad


class TestCollabWs:
    async def _join(self, client, sid, name, project="p1"):
        ws = await client.ws_connect(f"/comfytv/collab?sid={sid}")
        await ws.send_json({"type": "hello", "protocol": collab.PROTOCOL_VERSION,
                            "name": name, "color": "hsl(0, 80%, 62%)",
                            "project_id": project})
        welcome = await ws.receive_json(timeout=5)
        assert welcome["type"] == "welcome"
        return ws, welcome

    async def _seed(self, ws, workflow=None, project="p1"):
        """edit_put a doc and consume edit_state + edit_scribe frames."""
        await ws.send_json({"type": "edit_put", "project_id": project,
                            "workflow": workflow or {"nodes": [{"id": 1}]}})
        frames = {}
        for _ in range(2):
            ev = await ws.receive_json(timeout=5)
            frames[ev["type"]] = ev
        assert "edit_state" in frames
        assert frames["edit_scribe"]["you"] is True
        return frames

    async def test_welcome_and_join_leave(self, client):
        ws1, w1 = await self._join(client, "aaa", "Alice")
        assert w1["peers"] == []
        assert w1["peer_id"] == collab._peer_id("aaa")
        assert "sid" not in w1 and "locks" not in w1

        ws2, w2 = await self._join(client, "bbb", "Bob")
        assert [p["name"] for p in w2["peers"]] == ["Alice"]
        assert all("sid" not in p for p in w2["peers"])

        join = await ws1.receive_json(timeout=5)
        assert join["type"] == "peer-join"
        assert join["peer"]["peer_id"] == collab._peer_id("bbb")

        peers = await (await client.get("/comfytv/collab/peers")).json()
        assert len(peers["peers"]) == 2
        assert "docs" in peers

        await ws2.close()
        leave = await ws1.receive_json(timeout=5)
        assert leave["type"] == "peer-leave"
        await ws1.close()

    async def test_wrong_protocol_rejected(self, client):
        ws = await client.ws_connect("/comfytv/collab?sid=aaa")
        await ws.send_json({"type": "hello", "protocol": 999, "name": "Old",
                            "color": "", "project_id": "p1"})
        ev = await ws.receive_json(timeout=5)
        assert ev["type"] == "incompatible"
        closed = await ws.receive(timeout=5)
        assert closed.type == web.WSMsgType.CLOSE

    async def test_hello_timeout_closes_connection(self, client, monkeypatch):
        monkeypatch.setattr(collab, "HELLO_TIMEOUT_S", 0.05)
        ws = await client.ws_connect("/comfytv/collab?sid=aaa")
        closed = await ws.receive(timeout=5)
        assert closed.type == web.WSMsgType.CLOSE

    async def test_presence_relay_skips_sender(self, client):
        ws1, _ = await self._join(client, "aaa", "Alice")
        ws2, _ = await self._join(client, "bbb", "Bob")
        await ws1.receive_json(timeout=5)  # Bob's join

        await ws2.send_json({"type": "presence", "project_id": "p1",
                             "cursor": {"x": 1.5, "y": 2.5},
                             "selected": ["5"], "idle": "active"})
        ev = await ws1.receive_json(timeout=5)
        assert ev["type"] == "peer-presence"
        assert ev["cursor"] == {"x": 1.5, "y": 2.5}

        ws3, w3 = await self._join(client, "ccc", "Cara")
        bob = next(p for p in w3["peers"] if p["name"] == "Bob")
        assert bob["presence"]["cursor"] == {"x": 1.5, "y": 2.5}
        for ws in (ws1, ws2, ws3):
            await ws.close()

    async def test_anyone_seeds_when_no_doc(self, client):
        ws1, w1 = await self._join(client, "aaa", "Alice")
        assert w1["docs"] == {}
        await self._seed(ws1)
        peers = await (await client.get("/comfytv/collab/peers")).json()
        assert peers["docs"] == {"p1": 0}
        await ws1.close()

    async def test_non_member_cannot_replace_doc(self, client):
        ws1, _ = await self._join(client, "aaa", "Alice")
        ws2, _ = await self._join(client, "bbb", "Bob")
        await ws1.receive_json(timeout=5)  # join
        await self._seed(ws1, {"nodes": [{"id": 7}]})
        await ws2.receive_json(timeout=5)  # edit_state

        await ws2.send_json({"type": "edit_put", "project_id": "p1",
                             "workflow": {"nodes": [], "hijack": True}})
        await ws2.send_json({"type": "join_edit", "project_id": "p1"})
        doc = await ws2.receive_json(timeout=5)
        assert doc["type"] == "edit_doc"
        assert doc["workflow"] == {"nodes": [{"id": 7}]}
        await ws1.close()
        await ws2.close()

    async def test_coedit_ops_flow(self, client):
        ws1, _ = await self._join(client, "aaa", "Alice")
        await self._seed(ws1)
        await ws1.send_json({"type": "edit_ops", "project_id": "p1",
                             "ops": [{"kind": "node", "op": "patch", "id": "1",
                                      "fields": {"pos": [5, 5]}}]})
        echo = await ws1.receive_json(timeout=5)
        assert echo["type"] == "edit_ops" and echo["clock"] == 1

        ws2, _ = await self._join(client, "bbb", "Bob")
        await ws1.receive_json(timeout=5)  # join
        await ws2.send_json({"type": "join_edit", "project_id": "p1"})
        doc = await ws2.receive_json(timeout=5)
        assert doc["workflow"] == {"nodes": [{"id": 1}]}
        assert doc["ops"] == [[{"kind": "node", "op": "patch", "id": "1",
                                "fields": {"pos": [5, 5]}}]]

        await ws2.send_json({"type": "edit_ops", "project_id": "p1",
                             "ops": [{"kind": "node", "op": "remove", "id": "1"}]})
        for ws in (ws1, ws2):
            ev = await ws.receive_json(timeout=5)
            assert ev["type"] == "edit_ops" and ev["clock"] == 2
        await ws1.close()
        await ws2.close()

    async def test_nonmember_ops_ignored(self, client):
        ws1, _ = await self._join(client, "aaa", "Alice")
        ws2, _ = await self._join(client, "bbb", "Bob")
        await ws1.receive_json(timeout=5)  # join
        await self._seed(ws1)
        await ws2.receive_json(timeout=5)  # edit_state
        await ws2.send_json({"type": "edit_ops", "project_id": "p1",
                             "ops": [{"kind": "node", "op": "remove", "id": "1"}]})
        await ws1.send_json({"type": "edit_ops", "project_id": "p1",
                             "ops": [{"kind": "node", "op": "patch", "id": "1",
                                      "fields": {}}]})
        echo = await ws1.receive_json(timeout=5)
        assert echo["clock"] == 1  # Bob's op did not consume a clock
        await ws1.close()
        await ws2.close()

    async def test_scribe_transfers_on_disconnect(self, client):
        ws1, _ = await self._join(client, "aaa", "Alice")
        ws2, _ = await self._join(client, "bbb", "Bob")
        await ws1.receive_json(timeout=5)  # join
        await self._seed(ws1)  # Alice is scribe
        await ws2.receive_json(timeout=5)  # edit_state
        await ws2.send_json({"type": "join_edit", "project_id": "p1"})
        await ws2.receive_json(timeout=5)  # edit_doc

        await ws1.close()
        frames = {}
        for _ in range(2):
            ev = await ws2.receive_json(timeout=5)
            frames[ev["type"]] = ev
        assert frames["peer-leave"]
        assert frames["edit_scribe"]["you"] is True
        await ws2.close()

    async def test_canvas_only_from_scribe(self, client):
        ws1, _ = await self._join(client, "aaa", "Alice")
        ws2, _ = await self._join(client, "bbb", "Bob")
        await ws1.receive_json(timeout=5)  # join
        await self._seed(ws1)
        await ws2.receive_json(timeout=5)  # edit_state
        await ws2.send_json({"type": "join_edit", "project_id": "p1"})
        await ws2.receive_json(timeout=5)  # edit_doc

        # Bob is a member but not the scribe — his canvas is dropped
        await ws2.send_json({"type": "canvas", "project_id": "p1",
                             "stages": [{"uid": "from-bob"}]})
        await ws1.send_json({"type": "canvas", "project_id": "p1",
                             "stages": [{"uid": "from-scribe"}]})
        ev = await ws2.receive_json(timeout=5)
        assert ev["type"] == "peer-canvas"
        assert ev["stages"] == [{"uid": "from-scribe"}]

        # late joiner on the project receives the cached scribe canvas
        ws3, _ = await self._join(client, "ccc", "Cara")
        cached = await ws3.receive_json(timeout=5)
        assert cached["type"] == "peer-canvas"
        assert cached["stages"] == [{"uid": "from-scribe"}]
        for ws in (ws1, ws2, ws3):
            await ws.close()

    async def test_blob_refresh_preserves_unseen_ops(self, client):
        """A scribe refresh must not truncate ops it had not applied yet."""
        ws1, _ = await self._join(client, "aaa", "Alice")
        await self._seed(ws1)
        for pos in ([1, 1], [2, 2]):
            await ws1.send_json({"type": "edit_ops", "project_id": "p1",
                                 "ops": [{"kind": "node", "op": "patch",
                                          "id": "1", "fields": {"pos": pos}}]})
            await ws1.receive_json(timeout=5)  # echo

        # blob serialized when only clock 1 was applied — clock 2 must survive
        await ws1.send_json({"type": "edit_put", "project_id": "p1",
                             "workflow": {"nodes": [{"id": 1, "v": "stale"}]},
                             "base_clock": 1})
        ws2, _ = await self._join(client, "bbb", "Bob")
        await ws2.send_json({"type": "join_edit", "project_id": "p1"})
        doc = await ws2.receive_json(timeout=5)
        assert doc["workflow"]["nodes"][0]["v"] == "stale"
        assert doc["ops"] == [[{"kind": "node", "op": "patch", "id": "1",
                                "fields": {"pos": [2, 2]}}]]
        await ws1.close()
        await ws2.close()

    async def test_doc_persisted_across_restart(self, client):
        ws1, _ = await self._join(client, "aaa", "Alice")
        await self._seed(ws1)
        await ws1.send_json({"type": "edit_ops", "project_id": "p1",
                             "ops": [{"kind": "node", "op": "patch", "id": "1",
                                      "fields": {"pos": [9, 9]}}]})
        await ws1.receive_json(timeout=5)  # echo
        await collab.flush_docs_now()

        collab._edits.clear()
        collab._edit_loaded.clear()

        ws2, _ = await self._join(client, "bbb", "Bob")
        await ws2.send_json({"type": "join_edit", "project_id": "p1"})
        doc = await ws2.receive_json(timeout=5)
        assert doc["workflow"] == {"nodes": [{"id": 1}]}
        assert doc["ops"] == [[{"kind": "node", "op": "patch", "id": "1",
                                "fields": {"pos": [9, 9]}}]]
        await ws1.close()
        await ws2.close()

    async def test_hello_lazy_loads_doc_into_welcome(self, client):
        ws1, _ = await self._join(client, "aaa", "Alice")
        await self._seed(ws1)
        await collab.flush_docs_now()
        collab._edits.clear()
        collab._edit_loaded.clear()

        ws2, w2 = await self._join(client, "bbb", "Bob")
        assert "p1" in w2["docs"]
        await ws1.close()
        await ws2.close()

    async def test_exec_relayed_to_members_only(self, client):
        ws1, _ = await self._join(client, "aaa", "Alice")
        ws2, _ = await self._join(client, "bbb", "Bob")
        ws3, _ = await self._join(client, "ccc", "Cara")
        await ws1.receive_json(timeout=5)  # Bob join
        await ws1.receive_json(timeout=5)  # Cara join
        await ws2.receive_json(timeout=5)  # Cara join
        await self._seed(ws1)
        await ws2.receive_json(timeout=5)  # edit_state
        await ws3.receive_json(timeout=5)  # edit_state
        await ws2.send_json({"type": "join_edit", "project_id": "p1"})
        await ws2.receive_json(timeout=5)  # edit_doc

        await ws1.send_json({"type": "exec", "project_id": "p1",
                             "event": "running", "node": "9"})
        ev = await ws2.receive_json(timeout=5)
        assert ev["type"] == "peer-exec"
        assert ev["event"] == "running" and ev["node"] == "9"

        # Cara is not a member — her exec goes nowhere
        await ws3.send_json({"type": "exec", "project_id": "p1",
                             "event": "running", "node": "5"})
        await ws1.send_json({"type": "exec", "project_id": "p1",
                             "event": "output", "node": "9",
                             "output": {"images": [{"filename": "x.png"}]}})
        ev = await ws2.receive_json(timeout=5)
        assert ev["event"] == "output"
        for ws in (ws1, ws2, ws3):
            await ws.close()

    async def test_messages_before_hello_ignored(self, client):
        ws = await client.ws_connect("/comfytv/collab?sid=aaa")
        await ws.send_json({"type": "presence", "cursor": None})
        await ws.send_json({"type": "hello", "protocol": collab.PROTOCOL_VERSION,
                            "name": "Late", "color": "", "project_id": "p1"})
        welcome = await ws.receive_json(timeout=5)
        assert welcome["type"] == "welcome"
        await ws.close()
