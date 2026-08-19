from __future__ import annotations

import json

import pytest

from ComfyTV.bot._cli_common import CORE_MCP_TOOLS
from ComfyTV.bot.local_llm import LocalLlmProvider
from ComfyTV.bot.providers import BotEvent, TurnHandle, TurnRequest


class TestConfig:
    async def test_probe_without_url(self):
        provider = LocalLlmProvider(base_url="")
        st = await provider.probe()
        assert st.available is False
        assert "Settings" in st.detail

    async def test_send_without_url(self):
        provider = LocalLlmProvider(base_url="")
        result = await provider.send(
            TurnRequest(chat_id="c", user_text="hi",
                        mcp_endpoint="http://x/mcp"),
            _collect([]), TurnHandle())
        assert "endpoint" in result.error

    def test_stateless_caps(self):
        caps = LocalLlmProvider(base_url="http://x/v1").capabilities()
        assert caps.stateful is False
        assert caps.attachments is False

    def test_api_key_from_env_only(self, monkeypatch):
        provider = LocalLlmProvider(base_url="http://x/v1")
        assert "Authorization" not in provider._api_headers()
        monkeypatch.setenv("COMFYTV_LOCAL_LLM_API_KEY", "local")
        assert provider._api_headers()["Authorization"] == "Bearer local"


class TestHistory:
    def test_roles_and_order(self):
        history = [
            {"role": "user", "text": "q1"},
            {"role": "assistant", "text": "a1"},
            {"role": "tool", "text": "ignored"},
            {"role": "user", "text": ""},
        ]
        msgs = LocalLlmProvider._history_messages(history)
        assert msgs == [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
        ]

    def test_char_cap_keeps_recent(self):
        history = [{"role": "user", "text": f"m{i}" + "x" * 9000}
                   for i in range(4)]
        msgs = LocalLlmProvider._history_messages(history)
        assert len(msgs) == 1
        assert msgs[0]["content"].startswith("m3")

    def test_none_history(self):
        assert LocalLlmProvider._history_messages(None) == []


class TestToolPlumbing:
    def test_build_tools_shape(self):
        tools = LocalLlmProvider._build_tools([
            {"name": "get_canvas", "description": " d ",
             "inputSchema": {"type": "object", "properties": {}}},
            {"name": "bare"},
        ])
        assert tools[0]["function"]["name"] == "get_canvas"
        assert tools[0]["function"]["description"] == "d"
        assert tools[1]["function"]["parameters"] == {
            "type": "object", "properties": {}}

    async def test_list_tools_filters_to_core(self, monkeypatch):
        provider = LocalLlmProvider(base_url="http://x/v1")

        async def fake_request(session, method, url, *, headers,
                               json_body=None, timeout=120):
            return {"result": {"tools": [
                {"name": "get_canvas"}, {"name": "scene_edit"},
                {"name": "wait_stage"}, {"name": "workflow_edit"},
            ]}}

        monkeypatch.setattr(provider, "_request_json", fake_request)
        tools = await provider._mcp_list_tools(None, "http://x/mcp")
        assert [t["name"] for t in tools] == [
            "get_canvas", "wait_stage", "workflow_edit"]
        assert all(t["name"] in CORE_MCP_TOOLS for t in tools)


class TestWaitLoop:
    async def test_slices_until_done(self, monkeypatch):
        provider = LocalLlmProvider(base_url="http://x/v1")
        calls = []

        async def fake_call(session, endpoint, name, arguments):
            calls.append(dict(arguments))
            if len(calls) < 3:
                return json.dumps({"status": "running",
                                   "after_output_id": 100 + len(calls)})
            return json.dumps({"status": "done", "output": {"id": 9}})

        monkeypatch.setattr(provider, "_mcp_call_tool", fake_call)
        monkeypatch.setattr(provider, "_lms_bin", lambda: "")
        raw = await provider._wait_stage_done(
            None, "http://x/mcp", {"node": "u1"}, "m", TurnHandle())
        assert json.loads(raw)["status"] == "done"
        assert len(calls) == 3
        assert calls[0]["timeout_s"] == 170
        assert calls[1]["after_output_id"] == 101
        assert calls[2]["after_output_id"] == 102


class TestAgentLoop:
    async def test_tool_call_then_answer(self, monkeypatch):
        provider = LocalLlmProvider(base_url="http://x/v1", model="m1")
        chat_responses = [
            {"choices": [{"message": {
                "content": "",
                "tool_calls": [{"id": "t1", "function": {
                    "name": "server_info", "arguments": "{}"}}],
            }}]},
            {"choices": [{"message": {"content": "all good",
                                      "tool_calls": []}}]},
        ]

        async def fake_request(session, method, url, *, headers,
                               json_body=None, timeout=120):
            if url.endswith("/chat/completions"):
                return chat_responses.pop(0)
            return {"result": {"tools": [{"name": "server_info"}]}}

        async def fake_call(session, endpoint, name, arguments):
            return '{"comfytv_version": "1.9.0"}'

        monkeypatch.setattr(provider, "_request_json", fake_request)
        monkeypatch.setattr(provider, "_mcp_call_tool", fake_call)
        events: list[BotEvent] = []
        result = await provider.send(
            TurnRequest(chat_id="c", user_text="check the server",
                        mcp_endpoint="http://x/mcp"),
            _collect(events), TurnHandle())
        assert result.error == ""
        assert [e.t for e in events] == ["tool_use", "tool_result", "delta"]
        assert events[0].name == "server_info"
        assert events[1].text == '{"comfytv_version": "1.9.0"}'
        assert events[-1].text == "all good"

    async def test_stop_aborts(self, monkeypatch):
        provider = LocalLlmProvider(base_url="http://x/v1", model="m1")
        handle = TurnHandle()

        async def fake_request(session, method, url, *, headers,
                               json_body=None, timeout=120):
            if url.endswith("/chat/completions"):
                handle.stop_requested = True
                return {"choices": [{"message": {
                    "content": "",
                    "tool_calls": [{"id": "t1", "function": {
                        "name": "get_canvas", "arguments": "{}"}}],
                }}]}
            return {"result": {"tools": [{"name": "get_canvas"}]}}

        monkeypatch.setattr(provider, "_request_json", fake_request)
        result = await provider.send(
            TurnRequest(chat_id="c", user_text="look",
                        mcp_endpoint="http://x/mcp"),
            _collect([]), handle)
        assert result.aborted is True


def _collect(events: list[BotEvent]):
    async def emit(ev: BotEvent) -> None:
        events.append(ev)
    return emit
