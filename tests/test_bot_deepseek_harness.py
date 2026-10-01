from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import pytest

from ComfyTV.bot import deepseek_harness as dh
from ComfyTV.bot import deepseek_harness_runtime as rt
from ComfyTV.bot.providers import (
    AgentProvider,
    BotEvent,
    ProviderCaps,
    ProviderStatus,
    TurnHandle,
    TurnRequest,
    TurnResult,
    register_provider,
)
from conftest import wait_bot_done as _wait_done

_FAKE_AGENT = r'''
import json, os, sys

def out(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()

def seen(kind, payload):
    with open(os.environ["FAKE_ACP_SEEN"], "a", encoding="utf-8") as fh:
        fh.write(kind + ":" + json.dumps(payload) + "\n")

cfg = json.loads(os.environ.get("FAKE_ACP_CONFIG") or "{}")
session_id = cfg.get("sessionId") or "sess-1"
if cfg.get("noise"):
    sys.stdout.write("this is not json\n")
    sys.stdout.flush()
pending_prompt = None

def notify(update):
    out({"jsonrpc": "2.0", "method": "session/update",
         "params": {"sessionId": session_id, "update": update}})

def settle_prompt():
    global pending_prompt
    if pending_prompt is not None:
        out({"jsonrpc": "2.0", "id": pending_prompt,
             "result": {"stopReason": cfg.get("stopReason", "end_turn")}})
        pending_prompt = None

for raw in sys.stdin:
    msg = json.loads(raw)
    method, mid, params = msg.get("method"), msg.get("id"), msg.get("params") or {}
    if method == "initialize":
        out({"jsonrpc": "2.0", "id": mid, "result": {"protocolVersion": 1, "agentCapabilities": {
            "mcpCapabilities": {"http": True},
            "promptCapabilities": {"image": bool(cfg.get("image"))},
            "sessionCapabilities": {"close": {}, "resume": {}}}}})
        if cfg.get("eofAfterInitialize"):
            sys.exit(0)
    elif method in ("session/new", "session/resume"):
        seen(method.split("/")[1], params)
        error = cfg.get("resumeError") if method == "session/resume" else None
        if error:
            out({"jsonrpc": "2.0", "id": mid, "error": {"code": -32602, "message": error}})
        else:
            out({"jsonrpc": "2.0", "id": mid, "result": {
                "sessionId": session_id, "configOptions": cfg.get("configOptions") or []}})
    elif method == "session/set_config_option":
        seen("set_config_option", params)
        out({"jsonrpc": "2.0", "id": mid, "result": {}})
    elif method == "session/close":
        seen("close", params)
        out({"jsonrpc": "2.0", "id": mid, "result": {}})
    elif method == "session/prompt":
        seen("prompt", params)
        for update in cfg.get("updates") or []:
            notify(update)
        pending_prompt = mid
        if cfg.get("permission"):
            out({"jsonrpc": "2.0", "id": 9001, "method": "session/request_permission",
                 "params": cfg["permission"]})
        elif not cfg.get("hangOnPrompt"):
            settle_prompt()
    elif method == "session/cancel":
        seen("cancel", params)
        cfg.setdefault("stopReason", "cancelled")
        settle_prompt()
    elif mid == 9001:
        seen("permission_response", msg)
        settle_prompt()
'''

ACCOUNT_FLASH = '["deepseek-account","deepseek-flash"]'
ACCOUNT_PRO = '["deepseek-account","deepseek-v4-pro"]'
OFFICIAL_FLASH = '["deepseek-official","deepseek-v4-flash"]'


def _config_options(account: bool = True) -> list[dict]:
    groups = [{"group": "deepseek-official", "name": "DeepSeek",
               "options": [{"value": OFFICIAL_FLASH, "name": "deepseek-v4-flash"}]}]
    if account:
        groups.append({"group": "deepseek-account", "name": "DeepSeek Account",
                       "options": [{"value": ACCOUNT_FLASH, "name": "DeepSeek-V41-Flash"},
                                   {"value": ACCOUNT_PRO, "name": "DeepSeek-V4-Pro"}]})
    return [{"id": "model", "category": "model", "type": "select",
             "currentValue": OFFICIAL_FLASH, "options": groups},
            {"id": "reasoning_effort", "type": "select", "currentValue": "high",
             "options": [{"value": "high", "name": "High"}]}]


@pytest.fixture()
def fake_runtime(tmp_path, monkeypatch):
    agent = tmp_path / "fake_acp_agent.py"
    agent.write_text(_FAKE_AGENT, encoding="utf-8")
    seen = tmp_path / "seen.txt"
    monkeypatch.setattr(dh, "resolve_command", lambda: ([sys.executable, str(agent)], ""))

    async def no_profile(_argv):
        return ""

    monkeypatch.setattr(dh, "ensure_profile", no_profile)

    def chat_dir(chat_id):
        path = tmp_path / "chats" / chat_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    monkeypatch.setattr(dh, "chat_cwd", chat_dir)

    def configure(**cfg):
        cfg.setdefault("configOptions", _config_options())
        monkeypatch.setenv("FAKE_ACP_CONFIG", json.dumps(cfg))
        monkeypatch.setenv("FAKE_ACP_SEEN", str(seen))
        return seen

    return configure


async def _turn(turn: TurnRequest, handle: TurnHandle | None = None):
    events: list[BotEvent] = []

    async def emit(ev: BotEvent) -> None:
        events.append(ev)

    result = await dh.DeepSeekHarnessProvider().send(turn, emit, handle or TurnHandle())
    return result, events


def _seen(path: Path) -> list[tuple[str, dict]]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        kind, _, payload = line.partition(":")
        rows.append((kind, json.loads(payload)))
    return rows


def _kinds(path: Path) -> list[str]:
    return [kind for kind, _ in _seen(path)]


class TestHelpers:
    def test_parse_model_value(self):
        assert dh.parse_model_value(ACCOUNT_PRO) == ("deepseek-account", "deepseek-v4-pro")
        assert dh.parse_model_value("") is None
        assert dh.parse_model_value("deepseek-v4-pro") is None
        assert dh.parse_model_value('["only-one"]') is None

    def test_model_options_flatten_groups(self):
        rows = dh.model_options_from(_config_options())
        assert rows[0] == {"value": OFFICIAL_FLASH, "label": "deepseek-v4-flash",
                           "group": "deepseek-official"}
        assert [r["group"] for r in rows] == ["deepseek-official", "deepseek-account",
                                              "deepseek-account"]

    def test_overlay_pins_tools_and_route(self):
        entries = rt.overlay_entries(("deepseek-account", "deepseek-flash"))
        permission = entries[0]["config"]
        assert permission["defaultPreset"] == rt.PERMISSION_PRESET
        assert permission["presets"][rt.PERMISSION_PRESET]["approval"] == "never"
        disabled = {e["id"] for e in entries if e.get("disabled")}
        assert {"tool-bash", "tool-fs", "tool-web", "tool-subagent"} <= disabled
        assert entries[-1] == {"id": "acp", "config": {"provider": "deepseek-account",
                                                       "model": "deepseek-flash"}}
        assert all(e["id"] != "acp" for e in rt.overlay_entries(None))

    def test_overlay_file_is_json(self, tmp_path):
        path = rt.write_turn_overlay(tmp_path, None)
        assert json.loads(path.read_text(encoding="utf-8")) == rt.overlay_entries(None)


class TestResolveCommand:
    def test_dsh_on_path(self, tmp_path, monkeypatch):
        exe = tmp_path / "dsh"
        monkeypatch.setattr(rt.sys, "platform", "linux")
        monkeypatch.setattr(rt.shutil, "which", lambda name: str(exe))
        assert rt.resolve_command() == ([str(exe)], "")

    def test_windows_cmd_runs_through_cmd_exe(self, tmp_path, monkeypatch):
        exe = tmp_path / "dsh.cmd"
        monkeypatch.setattr(rt.sys, "platform", "win32")
        monkeypatch.setattr(rt.shutil, "which", lambda name: str(exe))
        assert rt.resolve_command() == (["cmd.exe", "/d", "/s", "/c", str(exe)], "")

    def test_mac_app_command_is_the_fallback(self, monkeypatch):
        monkeypatch.setattr(rt.sys, "platform", "darwin")
        monkeypatch.setattr(rt.shutil, "which", lambda name: None)
        monkeypatch.setattr(Path, "is_file", lambda self: self == rt.MAC_APP_COMMAND)
        assert rt.resolve_command() == ([str(rt.MAC_APP_COMMAND)], "")

    def test_nothing_found(self, monkeypatch):
        monkeypatch.setattr(rt.sys, "platform", "linux")
        monkeypatch.setattr(rt.shutil, "which", lambda name: None)
        argv, reason = rt.resolve_command()
        assert argv is None and "npm install -g @deepseek-ai/dsh" in reason


class TestProbe:
    async def test_changed_command_is_probed_immediately(self, monkeypatch):
        current: list = [None, "dsh was not found"]
        monkeypatch.setattr(dh, "resolve_command", lambda: tuple(current))
        provider = dh.DeepSeekHarnessProvider()
        assert (await provider.probe()).available is False
        current[:] = [[sys.executable, "-c", "print('0.2.0-rc.2')"], ""]
        status = await provider.probe()
        assert status.available is True and status.version == "0.2.0-rc.2"


class TestTurn:
    async def test_streams_text_and_tool_lifecycle(self, fake_runtime):
        fake_runtime(updates=[
            {"sessionUpdate": "agent_message_chunk", "content": {"type": "text", "text": "hello "}},
            {"sessionUpdate": "tool_call", "toolCallId": "t1",
             "title": "mcp__comfytv__server_info", "rawInput": {"a": 1}},
            {"sessionUpdate": "tool_call_update", "toolCallId": "t1", "status": "completed",
             "content": [{"type": "content", "content": {"type": "text", "text": "ok"}}]},
            {"sessionUpdate": "agent_message_chunk", "content": {"type": "text", "text": "world"}},
        ])
        result, events = await _turn(TurnRequest(chat_id="c1", user_text="hi"))
        assert result.error == "" and result.resume_token == "sess-1"
        assert [(e.t, e.text or e.name) for e in events] == [
            ("session", ""), ("delta", "hello "), ("tool_use", "mcp__comfytv__server_info"),
            ("tool_result", "ok"), ("delta", "world")]
        tool_result = events[3]
        assert tool_result.name == "mcp__comfytv__server_info" and tool_result.id == "t1"
        assert events[2].input == {"a": 1}

    async def test_failed_tool_is_flagged(self, fake_runtime):
        fake_runtime(updates=[
            {"sessionUpdate": "tool_call", "toolCallId": "t2", "title": "mcp__comfytv__run_stage"},
            {"sessionUpdate": "tool_call_update", "toolCallId": "t2", "status": "failed",
             "content": [{"type": "content", "content": {"type": "text", "text": "boom"}}]},
        ])
        _result, events = await _turn(TurnRequest(chat_id="c1", user_text="hi"))
        failed = next(e for e in events if e.t == "tool_result")
        assert failed.is_error is True and failed.text == "boom"

    async def test_permission_request_is_rejected_without_deadlock(self, fake_runtime):
        seen = fake_runtime(permission={
            "sessionId": "s", "toolCall": {"toolCallId": "t3"},
            "options": [{"optionId": "allow-1", "kind": "allow_once"},
                        {"optionId": "deny-1", "kind": "reject_once"}]})
        result, _events = await _turn(TurnRequest(chat_id="c1", user_text="hi"))
        assert result.error == ""
        reply = dict(_seen(seen))["permission_response"]
        assert reply["result"]["outcome"] == {"outcome": "selected", "optionId": "deny-1"}

    async def test_non_protocol_stdout_does_not_break_the_reader(self, fake_runtime):
        fake_runtime(noise=True, updates=[
            {"sessionUpdate": "agent_message_chunk", "content": {"type": "text", "text": "still here"}}])
        result, events = await _turn(TurnRequest(chat_id="c1", user_text="hi"))
        assert result.error == ""
        assert [e.text for e in events if e.t == "delta"] == ["still here"]

    async def test_eof_mid_turn_is_an_error(self, fake_runtime):
        fake_runtime(eofAfterInitialize=True)
        result, _events = await _turn(TurnRequest(chat_id="c1", user_text="hi"))
        assert result.error and not result.aborted

    async def test_resume_failure_runs_nothing(self, fake_runtime):
        seen = fake_runtime(resumeError="session cwd does not match")
        result, _events = await _turn(
            TurnRequest(chat_id="c1", user_text="hi", resume_token="old-session"))
        assert "session cwd does not match" in result.error
        assert "prompt" not in _kinds(seen) and "new" not in _kinds(seen)

    async def test_default_model_is_the_first_account_option(self, fake_runtime):
        seen = fake_runtime()
        result, _events = await _turn(TurnRequest(chat_id="c1", user_text="hi"))
        assert result.error == ""
        kinds = _kinds(seen)
        assert kinds.index("set_config_option") < kinds.index("prompt")
        assert dict(_seen(seen))["set_config_option"] == {
            "sessionId": "sess-1", "configId": "model", "value": ACCOUNT_FLASH}

    async def test_saved_api_key_model_is_applied_verbatim(self, fake_runtime):
        seen = fake_runtime()
        result, _events = await _turn(
            TurnRequest(chat_id="c1", user_text="hi", model=OFFICIAL_FLASH))
        assert result.error == ""
        assert dict(_seen(seen))["set_config_option"]["value"] == OFFICIAL_FLASH

    async def test_no_account_route_never_falls_back_to_the_api_key(self, fake_runtime):
        seen = fake_runtime(configOptions=_config_options(account=False))
        result, _events = await _turn(TurnRequest(chat_id="c1", user_text="hi"))
        assert "No DeepSeek account model" in result.error
        assert "set_config_option" not in _kinds(seen) and "prompt" not in _kinds(seen)

    async def test_stale_saved_model_is_refused(self, fake_runtime):
        seen = fake_runtime()
        result, _events = await _turn(TurnRequest(
            chat_id="c1", user_text="hi", model='["deepseek-account","gone"]'))
        assert "no longer offered" in result.error
        assert "prompt" not in _kinds(seen)

    async def test_session_event_comes_first(self, fake_runtime):
        fake_runtime(sessionId="sess-42")
        result, events = await _turn(TurnRequest(chat_id="c1", user_text="hi"))
        assert result.resume_token == "sess-42"
        assert (events[0].t, events[0].id) == ("session", "sess-42")

    async def test_mcp_endpoint_and_cwd_reach_the_runtime(self, fake_runtime, tmp_path):
        seen = fake_runtime()
        url = "http://127.0.0.1:9999/comfytv/mcp?bot_chat=chat-abc"
        await _turn(TurnRequest(chat_id="chat-abc", user_text="hi", mcp_endpoint=url))
        sent = dict(_seen(seen))["new"]
        assert sent["mcpServers"] == [{"type": "http", "name": "comfytv", "url": url, "headers": []}]
        assert sent["cwd"] == str(tmp_path / "chats" / "chat-abc")

    async def test_image_is_refused_when_unsupported(self, fake_runtime):
        seen = fake_runtime(image=False)
        result, _events = await _turn(TurnRequest(
            chat_id="c1", user_text="look", attachments=[{"media_type": "image/png", "data": "AAAA"}]))
        assert "does not accept images" in result.error
        assert "prompt" not in _kinds(seen)

    async def test_image_is_sent_when_supported(self, fake_runtime):
        seen = fake_runtime(image=True)
        result, _events = await _turn(TurnRequest(
            chat_id="c1", user_text="look", attachments=[{"media_type": "image/png", "data": "AAAA"}]))
        assert result.error == ""
        assert dict(_seen(seen))["prompt"]["prompt"] == [
            {"type": "image", "mimeType": "image/png", "data": "AAAA"},
            {"type": "text", "text": "look"}]

    async def test_non_image_attachment_is_refused(self, fake_runtime):
        fake_runtime(image=True)
        result, _events = await _turn(TurnRequest(
            chat_id="c1", user_text="look", attachments=[{"media_type": "video/mp4", "data": "AAAA"}]))
        assert "only accepts image attachments" in result.error

    async def test_stop_reason_surfaces_as_an_error(self, fake_runtime):
        fake_runtime(stopReason="max_tokens")
        result, _events = await _turn(TurnRequest(chat_id="c1", user_text="hi"))
        assert "output token limit" in result.error and not result.aborted

    async def test_session_is_closed_after_the_turn(self, fake_runtime):
        seen = fake_runtime(sessionId="sess-close")
        await _turn(TurnRequest(chat_id="c1", user_text="hi"))
        assert dict(_seen(seen))["close"] == {"sessionId": "sess-close"}


class TestStop:
    async def test_cancel_mid_prompt_settles_as_aborted(self, fake_runtime, monkeypatch):
        seen = fake_runtime(hangOnPrompt=True, updates=[
            {"sessionUpdate": "tool_call", "toolCallId": "t5", "title": "mcp__comfytv__run_stage"}])
        monkeypatch.setattr(dh, "CANCEL_GRACE_S", 5.0)
        provider = dh.DeepSeekHarnessProvider()
        started = asyncio.Event()

        async def emit(ev: BotEvent) -> None:
            if ev.t == "tool_use":
                started.set()

        handle = TurnHandle()
        task = asyncio.create_task(provider.send(TurnRequest(chat_id="c1", user_text="hi"), emit, handle))
        await asyncio.wait_for(started.wait(), timeout=10)
        await provider.stop(handle)
        result = await asyncio.wait_for(task, timeout=20)
        assert result.aborted is True and result.resume_token == "sess-1"
        assert "cancel" in _kinds(seen)

    async def test_stop_before_the_prompt_runs_nothing(self, fake_runtime, monkeypatch):
        seen = fake_runtime()
        provider = dh.DeepSeekHarnessProvider()
        handle = TurnHandle()

        async def slow_profile(_argv):
            await provider.stop(handle)
            return ""

        monkeypatch.setattr(dh, "ensure_profile", slow_profile)

        async def emit(_ev):
            pass

        result = await provider.send(TurnRequest(chat_id="c1", user_text="hi"), emit, handle)
        assert result.aborted is True
        assert _kinds(seen) == []


class _ModelOptionsProvider(AgentProvider):
    id = "fake-model-options"
    label = "Fake Models"

    async def probe(self) -> ProviderStatus:
        return ProviderStatus(available=True, version="1.2.3")

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=True, tools="mcp")

    def model_options(self) -> list[dict]:
        return [{"value": ACCOUNT_PRO, "label": "DeepSeek-V4-Pro", "group": "deepseek-account"}]

    async def send(self, turn, emit, handle) -> TurnResult:
        return TurnResult()

    async def stop(self, handle) -> None:
        handle.stop_requested = True


class _SessionEventProvider(AgentProvider):
    id = "fake-session-event"
    label = "Session Event Fake"

    async def probe(self) -> ProviderStatus:
        return ProviderStatus(available=True, version="1")

    def capabilities(self) -> ProviderCaps:
        return ProviderCaps(stateful=True, tools="mcp")

    async def send(self, turn, emit, handle) -> TurnResult:
        await emit(BotEvent(t="session", id="sess-internal"))
        await emit(BotEvent(t="delta", text="done"))
        return TurnResult()

    async def stop(self, handle) -> None:
        handle.stop_requested = True


class TestApi:
    async def test_status_publishes_model_options(self, bot_client):
        register_provider(_ModelOptionsProvider())
        data = await (await bot_client.get("/comfytv/bot/status")).json()
        entry = next(p for p in data["providers"] if p["id"] == "fake-model-options")
        assert entry["model_options"] == [
            {"value": ACCOUNT_PRO, "label": "DeepSeek-V4-Pro", "group": "deepseek-account"}]
        assert entry["models"] == []

    async def test_status_omits_model_options_for_plain_providers(self, bot_client, fake_provider):
        data = await (await bot_client.get("/comfytv/bot/status")).json()
        entry = next(p for p in data["providers"] if p["id"] == "fake-test")
        assert "model_options" not in entry

    async def test_branch_is_refused_for_the_harness_provider(self, bot_client):
        from ComfyTV import storage

        chat = (await (await bot_client.post("/comfytv/bot/chats",
                                             json={"provider": "deepseek-harness"})).json())["chat"]
        message = storage.create_bot_message(chat_id=chat["id"], role="assistant",
                                             content="[]", status="done")
        resp = await bot_client.post(f"/comfytv/bot/chats/{chat['id']}/branch",
                                     json={"message_id": message["id"]})
        assert resp.status == 400
        assert "cannot be branched" in (await resp.json())["error"]

    async def test_branch_still_works_for_other_providers(self, bot_client, fake_provider):
        chat = (await (await bot_client.post("/comfytv/bot/chats",
                                             json={"provider": "fake-test"})).json())["chat"]
        await bot_client.post(f"/comfytv/bot/chats/{chat['id']}/send", json={"text": "one"})
        data = await _wait_done(bot_client, chat["id"])
        assistant_id = next(m["id"] for m in data["messages"] if m["role"] == "assistant")
        resp = await bot_client.post(f"/comfytv/bot/chats/{chat['id']}/branch",
                                     json={"message_id": assistant_id})
        assert resp.status == 200

    async def test_session_event_is_persisted_and_not_streamed(self, bot_client):
        register_provider(_SessionEventProvider())
        chat = (await (await bot_client.post("/comfytv/bot/chats",
                                             json={"provider": "fake-session-event"})).json())["chat"]
        await bot_client.post(f"/comfytv/bot/chats/{chat['id']}/send", json={"text": "hi"})
        data = await _wait_done(bot_client, chat["id"])
        assert data["chat"]["resume_token"] == "sess-internal"
        assistant = next(m for m in data["messages"] if m["role"] == "assistant")
        assert assistant["resume_token_after"] == "sess-internal"
        assert "sess-internal" not in json.dumps(assistant["content"])
