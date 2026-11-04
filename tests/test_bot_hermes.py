from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from ComfyTV.bot import hermes as hm
from ComfyTV.bot.providers import BotEvent, TurnHandle, TurnRequest

_FAKE_HERMES = r'''
import json, os, sys

def out(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()

def seen(kind, payload):
    with open(os.environ["FAKE_ACP_SEEN"], "a", encoding="utf-8") as fh:
        fh.write(kind + ":" + json.dumps(payload) + "\n")

seen("argv", sys.argv[1:])
models = {"currentModelId": "custom:deepseek", "availableModels": [
    {"modelId": "custom:deepseek", "name": "DeepSeek"},
    {"modelId": "anthropic:claude-sonnet-5", "name": "Anthropic · claude-sonnet-5"}]}
for raw in sys.stdin:
    msg = json.loads(raw)
    method, mid, params = msg.get("method"), msg.get("id"), msg.get("params") or {}
    if method == "initialize":
        out({"jsonrpc": "2.0", "id": mid, "result": {"protocolVersion": 1, "agentCapabilities": {
            "loadSession": True, "promptCapabilities": {"image": True},
            "sessionCapabilities": {"fork": {}, "list": {}, "resume": {}}}}})
    elif method in ("session/new", "session/resume"):
        seen(method.split("/")[1], params)
        if method == "session/resume":
            out({"jsonrpc": "2.0", "method": "session/update", "params": {"sessionId": "h-1", "update": {
                "sessionUpdate": "agent_message_chunk", "content": {"type": "text", "text": "old answer"}}}})
        out({"jsonrpc": "2.0", "id": mid, "result": {"sessionId": "h-1", "models": models}})
    elif method == "session/set_model":
        seen("set_model", params)
        out({"jsonrpc": "2.0", "id": mid, "result": {}})
    elif method == "session/prompt":
        seen("prompt", params)
        out({"jsonrpc": "2.0", "method": "session/update", "params": {"sessionId": "h-1", "update": {
            "sessionUpdate": "agent_message_chunk", "content": {"type": "text", "text": "pong"}}}})
        out({"jsonrpc": "2.0", "id": mid, "result": {"stopReason": "end_turn"}})
    elif mid is not None:
        seen("unexpected", msg)
        out({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "nope"}})
'''

ENDPOINT = "http://127.0.0.1:8188/comfytv/mcp?bot_chat=c1"


@pytest.fixture()
def fake_hermes(tmp_path, monkeypatch):
    agent = tmp_path / "fake_hermes.py"
    agent.write_text(_FAKE_HERMES, encoding="utf-8")
    seen = tmp_path / "seen.txt"
    monkeypatch.setenv("FAKE_ACP_SEEN", str(seen))
    monkeypatch.setattr(hm, "ssh_host", lambda: "")
    monkeypatch.setattr(hm, "profile", lambda: "comfytv")
    monkeypatch.setattr(hm.HermesProvider, "_command", lambda self: ([sys.executable, str(agent)], ""))

    def chat_dir(chat_id):
        path = tmp_path / "chats" / chat_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    monkeypatch.setattr(hm, "chat_cwd", chat_dir)
    return seen


def _seen(path: Path) -> list[tuple[str, object]]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        kind, _, payload = line.partition(":")
        rows.append((kind, json.loads(payload)))
    return rows


async def _turn(provider: hm.HermesProvider, turn: TurnRequest):
    events: list[BotEvent] = []

    async def emit(ev: BotEvent) -> None:
        events.append(ev)

    return await provider.send(turn, emit, TurnHandle()), events


class TestHelpers:
    def test_tunnel_points_mcp_at_the_remote_port(self):
        forward, url = hm.tunnel(ENDPOINT, 23456)
        assert forward == ["-o", "ExitOnForwardFailure=yes", "-R", "23456:127.0.0.1:8188"]
        assert url == "http://127.0.0.1:23456/comfytv/mcp?bot_chat=c1"
        assert hm.tunnel("", 23456) == ([], "")

    def test_model_options_group_by_provider_prefix(self):
        rows = hm.model_options_from({"availableModels": [
            {"modelId": "anthropic:claude-sonnet-5", "name": "Sonnet"}, {"modelId": "plain"}, {"name": "no id"}]})
        assert rows == [{"value": "anthropic:claude-sonnet-5", "label": "Sonnet", "group": "anthropic"},
                        {"value": "plain", "label": "plain", "group": ""}]
        assert hm.model_options_from(None) == []


class TestCommand:
    def test_local_hermes_on_path(self, monkeypatch):
        monkeypatch.setattr(hm, "ssh_host", lambda: "")
        monkeypatch.setattr(hm, "profile", lambda: "")
        monkeypatch.setattr(hm.shutil, "which", lambda name: "/usr/bin/hermes" if name == "hermes" else None)
        argv, _ = hm.HermesProvider()._command()
        assert argv == ["/usr/bin/hermes"]
        assert hm.HermesProvider()._version_argv(argv) == ["/usr/bin/hermes", "--version"]

    def test_profile_is_passed_to_local_hermes(self, monkeypatch):
        monkeypatch.setattr(hm, "ssh_host", lambda: "")
        monkeypatch.setattr(hm, "profile", lambda: "comfytv")
        assert hm.HermesProvider()._version_argv(["/usr/bin/hermes"]) == [
            "/usr/bin/hermes", "-p", "comfytv", "--version"]

    def test_invalid_profile_is_refused(self, monkeypatch):
        monkeypatch.setattr(hm, "profile", lambda: "a b; rm -rf ~")
        argv, reason = hm.HermesProvider()._command()
        assert argv is None and "not valid" in reason

    def test_nothing_found_mentions_the_ssh_setting(self, monkeypatch):
        monkeypatch.setattr(hm, "ssh_host", lambda: "")
        monkeypatch.setattr(hm, "profile", lambda: "")
        monkeypatch.setattr(hm.shutil, "which", lambda name: None)
        argv, reason = hm.HermesProvider()._command()
        assert argv is None and "SSH host" in reason

    async def test_remote_runs_hermes_acp_through_a_login_shell(self, monkeypatch, tmp_path):
        monkeypatch.setattr(hm, "ssh_host", lambda: "spark")
        monkeypatch.setattr(hm, "profile", lambda: "comfytv")
        monkeypatch.setattr(hm.shutil, "which", lambda name: "/usr/bin/ssh" if name == "ssh" else None)
        monkeypatch.setattr(hm, "chat_cwd", lambda chat_id: tmp_path)
        monkeypatch.setattr(hm.random, "randint", lambda lo, hi: 31337)
        provider = hm.HermesProvider()
        argv, _ = provider._command()
        assert argv == ["/usr/bin/ssh", "spark"]
        assert provider._version_argv(argv)[-2:] == ["spark", "sh -lc 'hermes -p comfytv --version'"]
        launch, _ = await provider._launch(TurnRequest(chat_id="c1", user_text="hi", mcp_endpoint=ENDPOINT), argv)
        assert launch.argv == ["/usr/bin/ssh", "-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10",
                               "-o", "ExitOnForwardFailure=yes", "-R", "31337:127.0.0.1:8188",
                               "spark", "sh -lc 'exec hermes -p comfytv acp'"]
        assert launch.session_cwd == "."
        assert launch.mcp_url == "http://127.0.0.1:31337/comfytv/mcp?bot_chat=c1"


class TestTurn:
    async def test_current_model_is_not_switched_again(self, fake_hermes):
        result, _events = await _turn(hm.HermesProvider(), TurnRequest(
            chat_id="c1", user_text="hi", model="custom:deepseek", mcp_endpoint=ENDPOINT))
        assert result.error == ""
        assert [k for k, _ in _seen(fake_hermes)] == ["argv", "new", "prompt"]

    async def test_switching_model_reattaches_the_mcp_server(self, fake_hermes):
        result, _events = await _turn(hm.HermesProvider(), TurnRequest(
            chat_id="c1", user_text="hi", model="anthropic:claude-sonnet-5", mcp_endpoint=ENDPOINT))
        assert result.error == ""
        rows = _seen(fake_hermes)
        assert [k for k, _ in rows] == ["argv", "new", "set_model", "resume", "prompt"]
        assert rows[3][1]["mcpServers"] == [{"type": "http", "name": "comfytv", "url": ENDPOINT, "headers": []}]

    async def test_new_session_uses_hermes_default_model(self, fake_hermes):
        provider = hm.HermesProvider()
        result, events = await _turn(provider, TurnRequest(chat_id="c1", user_text="hi", mcp_endpoint=ENDPOINT))
        assert result.error == "" and result.resume_token == "h-1"
        assert [e.text for e in events if e.t == "delta"] == ["pong"]
        rows = _seen(fake_hermes)
        assert rows[0] == ("argv", ["-p", "comfytv", "acp"])
        assert [k for k, _ in rows] == ["argv", "new", "prompt"]
        assert dict(rows)["new"]["mcpServers"] == [{"type": "http", "name": "comfytv", "url": ENDPOINT, "headers": []}]
        assert dict(rows)["prompt"]["prompt"] == [{"type": "text", "text": hm.SESSION_PREAMBLE},
                                                  {"type": "text", "text": "hi"}]
        assert [r["value"] for r in provider.model_options()] == ["custom:deepseek", "anthropic:claude-sonnet-5"]

    async def test_resume_with_saved_model_switches_it(self, fake_hermes):
        result, _events = await _turn(hm.HermesProvider(), TurnRequest(
            chat_id="c1", user_text="hi", resume_token="h-1", model="anthropic:claude-sonnet-5"))
        assert result.error == ""
        assert [e.text for e in _events if e.t == "delta"] == ["pong"]
        rows = _seen(fake_hermes)
        assert [k for k, _ in rows] == ["argv", "resume", "set_model", "resume", "prompt"]
        assert dict(rows)["set_model"] == {"sessionId": "h-1", "modelId": "anthropic:claude-sonnet-5"}
        assert dict(rows)["prompt"]["prompt"] == [{"type": "text", "text": "hi"}]
