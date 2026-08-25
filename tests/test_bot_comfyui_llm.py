from __future__ import annotations

import json
import sys
import types

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from ComfyTV.bot import comfyui_llm_chat as chat
from ComfyTV.bot import comfyui_llm_engine as engine
from ComfyTV.bot.comfyui_llm_provider import ComfyUiLlmProvider
from ComfyTV.bot.local_llm import LocalLlmProvider
from ComfyTV.bot.providers import ProviderStatus


class TestRenderPrompt:
    def test_system_and_tools_block(self):
        prompt = chat.render_prompt(
            [{"role": "system", "content": "be helpful"},
             {"role": "user", "content": "hi"}],
            tools=[{"type": "function",
                    "function": {"name": "get_canvas", "parameters": {}}}])
        assert prompt.startswith("<|im_start|>system\nbe helpful")
        assert "<tools>" in prompt and "get_canvas" in prompt
        assert "return a json object with function name" in prompt
        assert prompt.endswith(
            "<|im_start|>assistant\n<think>\n\n</think>\n\n")

    def test_no_system_no_tools_skips_system_turn(self):
        prompt = chat.render_prompt([{"role": "user", "content": "hi"}])
        assert prompt.startswith("<|im_start|>user\nhi<|im_end|>\n")

    def test_thinking_omits_empty_think_block(self):
        prompt = chat.render_prompt([{"role": "user", "content": "hi"}],
                                    thinking=True)
        assert prompt.endswith("<|im_start|>assistant\n")

    def test_tool_results_merge_into_one_user_turn(self):
        prompt = chat.render_prompt([
            {"role": "user", "content": "q"},
            {"role": "assistant", "content": "",
             "tool_calls": [{"function": {"name": "a", "arguments": "{}"}}]},
            {"role": "tool", "content": "r1"},
            {"role": "tool", "content": "r2"},
        ])
        merged = ("<|im_start|>user\n<tool_response>\nr1\n</tool_response>\n"
                  "<tool_response>\nr2\n</tool_response><|im_end|>\n")
        assert merged in prompt

    def test_assistant_tool_call_replay(self):
        prompt = chat.render_prompt([
            {"role": "user", "content": "q"},
            {"role": "assistant", "content": "on it",
             "tool_calls": [{"function": {
                 "name": "run_stage", "arguments": {"uid": "s1"}}}]},
        ])
        assert "on it\n<tool_call>\n" in prompt
        assert '"name": "run_stage"' in prompt
        assert '{"uid": "s1"}' in prompt

    def test_content_part_arrays(self):
        prompt = chat.render_prompt([{"role": "user", "content": [
            {"type": "text", "text": "a"}, {"type": "text", "text": "b"}]}])
        assert "<|im_start|>user\na\nb<|im_end|>" in prompt

    def test_gemma3_family(self):
        prompt = chat.render_prompt(
            [{"role": "system", "content": "sys"},
             {"role": "user", "content": "hi"},
             {"role": "assistant", "content": "yo"},
             {"role": "tool", "content": "r1"}],
            family="gemma3")
        assert prompt.startswith("<start_of_turn>system\nsys<end_of_turn>\n")
        assert "<start_of_turn>user\nhi<end_of_turn>\n" in prompt
        assert "<start_of_turn>model\nyo<end_of_turn>\n" in prompt
        assert ("<start_of_turn>user\n<tool_response>\nr1\n</tool_response>"
                "<end_of_turn>\n") in prompt
        assert prompt.endswith("<start_of_turn>model\n")

    def test_gemma4_family(self):
        prompt = chat.render_prompt(
            [{"role": "user", "content": "hi"}], family="gemma4")
        assert prompt.startswith("<|turn>user\nhi<turn|>\n")
        assert prompt.endswith("<|turn>model\n<|channel>final\n")


class TestParseCompletion:
    def test_plain_text(self):
        content, calls = chat.parse_completion("hello there")
        assert content == "hello there"
        assert calls == []

    def test_tool_call_extraction(self):
        content, calls = chat.parse_completion(
            'ok\n<tool_call>\n{"name": "get_canvas", "arguments": '
            '{"q": 1}}\n</tool_call>')
        assert content == "ok"
        assert calls[0]["id"] == "call_0"
        assert calls[0]["function"]["name"] == "get_canvas"
        assert json.loads(calls[0]["function"]["arguments"]) == {"q": 1}

    def test_think_blocks_stripped(self):
        content, _ = chat.parse_completion(
            "<think>reasoning</think>answer")
        assert content == "answer"
        content, _ = chat.parse_completion("<think>ran out of tokens")
        assert content == ""

    def test_stop_markers_cut(self):
        content, _ = chat.parse_completion("done<|im_end|>garbage")
        assert content == "done"
        assert chat.parse_completion("ok<end_of_turn>x")[0] == "ok"
        assert chat.parse_completion("ok<turn|>x")[0] == "ok"

    def test_malformed_tool_call_skipped(self):
        content, calls = chat.parse_completion(
            "<tool_call>not json</tool_call>"
            '<tool_call>{"name": "ok", "arguments": {}}</tool_call>')
        assert [c["function"]["name"] for c in calls] == ["ok"]
        assert content == ""

    def test_string_arguments_kept_verbatim(self):
        _, calls = chat.parse_completion(
            '<tool_call>{"name": "x", "arguments": "{\\"a\\": 2}"}'
            '</tool_call>')
        assert json.loads(calls[0]["function"]["arguments"]) == {"a": 2}


class _FakeClip:
    def __init__(self, completion: str):
        self.completion = completion
        self.seen: dict = {}

    def tokenize(self, prompt, **kwargs):
        self.seen["prompt"] = prompt
        self.seen["tokenize_kwargs"] = kwargs
        return {"qwen3vl_8b": [[(1, 1.0)] * 7]}

    def generate(self, tokens, **kwargs):
        self.seen["generate_kwargs"] = kwargs
        return [5, 6, 7]

    def decode(self, ids, skip_special_tokens=True):
        self.seen["skip_special_tokens"] = skip_special_tokens
        return self.completion


class TestEngine:
    def test_model_filter(self):
        assert engine.is_generation_model("Qwen3-VL-8B_fp8.safetensors")
        assert engine.is_generation_model("qwen_3_8b_fp8mixed.safetensors")
        assert engine.is_generation_model("gemma_3_12B_it_fp4.safetensors")
        assert not engine.is_generation_model("gemma4_e4b_it_fp8.safetensors")
        assert not engine.is_generation_model("t5xxl_fp16.safetensors")
        assert not engine.is_generation_model("clip_l.safetensors")
        assert not engine.is_generation_model("qwen_2.5_vl_7b.safetensors")
        assert not engine.is_generation_model(
            "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors")

    def test_prompt_family_mapping(self):
        assert engine.prompt_family("qwen_3_8b_fp8mixed.safetensors") == \
            "chatml"
        assert engine.prompt_family("gemma_3_12B_it_fp4.safetensors") == \
            "gemma3"
        assert engine.prompt_family("gemma4_e4b_it_fp8.safetensors") is None
        assert engine.prompt_family("t5xxl.safetensors") is None

    def test_list_model_files_chatml_first(self, monkeypatch):
        monkeypatch.setattr(
            sys.modules["folder_paths"], "get_filename_list",
            lambda kind: ["gemma_3_12B.safetensors", "qwen3vl_8b.safetensors",
                          "clip_l.safetensors"]
            if kind == "text_encoders" else [], raising=False)
        assert engine.list_model_files() == [
            "qwen3vl_8b.safetensors", "gemma_3_12B.safetensors"]

    def test_generate_chat_plumbing(self, monkeypatch):
        clip = _FakeClip(
            '<tool_call>{"name": "get_canvas", "arguments": {}}</tool_call>')
        monkeypatch.setattr(engine, "_load", lambda name: clip)
        result = engine.generate_chat(
            "m.safetensors", [{"role": "user", "content": "hi"}], [],
            max_tokens=64, temperature=0.2, top_p=0.9, seed=7)
        assert clip.seen["prompt"].startswith("<|im_start|>")
        assert clip.seen["tokenize_kwargs"]["llama_template"] == "{}"
        assert clip.seen["generate_kwargs"]["seed"] == 7
        assert clip.seen["generate_kwargs"]["max_length"] == 64
        assert clip.seen["skip_special_tokens"] is False
        assert result["tool_calls"][0]["function"]["name"] == "get_canvas"
        assert result["finish_reason"] == "tool_calls"
        assert result["usage"] == {"prompt_tokens": 7,
                                   "completion_tokens": 3,
                                   "total_tokens": 10}

    def test_generate_chat_list_tokens(self, monkeypatch):
        clip = _FakeClip("hi")
        clip.tokenize = lambda prompt, **kw: [[(1, 1.0)] * 4]
        monkeypatch.setattr(engine, "_load", lambda name: clip)
        result = engine.generate_chat(
            "gemma_3_12B.safetensors", [{"role": "user", "content": "hi"}],
            [], max_tokens=8, temperature=0.2, top_p=0.9)
        assert result["usage"]["prompt_tokens"] == 4

    def test_thinking_leaves_reasoning_open(self, monkeypatch):
        clip = _FakeClip("<think>plan</think>done")
        monkeypatch.setattr(engine, "_load", lambda name: clip)
        result = engine.generate_chat(
            "qwen3vl_8b.safetensors", [{"role": "user", "content": "hi"}],
            [], max_tokens=8, temperature=0.2, top_p=0.9, thinking=True)
        assert clip.seen["prompt"].endswith("<|im_start|>assistant\n")
        assert result["content"] == "done"

    def test_thinking_ignored_for_gemma(self, monkeypatch):
        clip = _FakeClip("ok")
        seen = {}

        def fake_tokenize(prompt, **kw):
            seen["prompt"] = prompt
            return [[(1, 1.0)] * 4]
        clip.tokenize = fake_tokenize
        monkeypatch.setattr(engine, "_load", lambda name: clip)
        engine.generate_chat(
            "gemma_3_12B.safetensors", [{"role": "user", "content": "hi"}],
            [], max_tokens=8, temperature=0.2, top_p=0.9, thinking=True)
        assert seen["prompt"].endswith("<start_of_turn>model\n")

    def test_greedy_when_temperature_zero(self, monkeypatch):
        clip = _FakeClip("ok")
        monkeypatch.setattr(engine, "_load", lambda name: clip)
        result = engine.generate_chat(
            "m", [{"role": "user", "content": "hi"}], [],
            max_tokens=8, temperature=0.0, top_p=1.0)
        assert clip.seen["generate_kwargs"]["do_sample"] is False
        assert result["finish_reason"] == "stop"


class TestLogitsPatch:
    @staticmethod
    def _clip(lm_head, embed=None):
        model = types.SimpleNamespace(embed_tokens=embed)
        if lm_head is not None:
            model.lm_head = lm_head
        transformer = types.SimpleNamespace(model=model,
                                            logits=lambda x: "core")

        class Wrapper:
            clip = "q"
        wrapper = Wrapper()
        wrapper.q = types.SimpleNamespace(transformer=transformer)
        return types.SimpleNamespace(cond_stage_model=wrapper), transformer

    def test_uses_untied_lm_head(self):
        pytest.importorskip("torch")
        import torch
        head = types.SimpleNamespace(comfy_cast_weights=False,
                                     weight=torch.eye(3))
        clip, transformer = self._clip(head)
        engine._patch_logits(clip)
        x = torch.arange(6, dtype=torch.float32).reshape(1, 2, 3)
        out = transformer.logits(x)
        assert torch.equal(out, x[:, -1:])

    def test_tied_falls_back_to_embeddings(self):
        pytest.importorskip("torch")
        import torch
        embed = types.SimpleNamespace(comfy_cast_weights=False,
                                      weight=torch.eye(3) * 2)
        clip, transformer = self._clip(None, embed=embed)
        engine._patch_logits(clip)
        x = torch.ones(1, 2, 3)
        assert torch.equal(transformer.logits(x), torch.full((1, 1, 3), 2.0))

    def test_nan_logits_sanitized(self):
        pytest.importorskip("torch")
        import torch
        head = types.SimpleNamespace(comfy_cast_weights=False,
                                     weight=torch.eye(3))
        clip, transformer = self._clip(head)
        engine._patch_logits(clip)
        x = torch.tensor([[[1.0, float("nan"), float("inf")]]])
        out = transformer.logits(x)
        assert torch.isfinite(out).all()

    def test_skips_non_generate_models(self):
        clip, transformer = self._clip(None)
        transformer.logits = None
        engine._patch_logits(clip)
        assert transformer.logits is None


class TestProvider:
    def test_base_url_points_at_shim(self):
        url = ComfyUiLlmProvider()._base_url()
        assert url == "http://127.0.0.1:8188/comfytv/llm/v1"

    def test_base_url_override(self):
        provider = ComfyUiLlmProvider(base_url="http://x/v1/")
        assert provider._base_url() == "http://x/v1"

    def test_lms_never_used(self):
        assert ComfyUiLlmProvider()._lms_bin() == ""

    async def test_probe_rewords_no_models(self, monkeypatch):
        async def fake_probe(self):
            return ProviderStatus(
                available=False,
                detail="the endpoint is up but reports no models — load "
                       "a model first")
        monkeypatch.setattr(LocalLlmProvider, "probe", fake_probe)
        status = await ComfyUiLlmProvider().probe()
        assert status.available is False
        assert "text_encoders" in status.detail


@pytest.fixture()
async def client(reset_db):
    from ComfyTV import api  # noqa: F401
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


def _enable_bot():
    from ComfyTV import storage
    storage.set_settings({"enable-mcp": True, "enable-bot": True})


class TestLlmApi:
    async def test_models_gated_when_disabled(self, client):
        resp = await client.get("/comfytv/llm/v1/models")
        assert resp.status == 403

    async def test_chat_gated_when_disabled(self, client):
        resp = await client.post("/comfytv/llm/v1/chat/completions", json={})
        assert resp.status == 403

    async def test_models_list(self, client, monkeypatch):
        _enable_bot()
        monkeypatch.setattr(engine, "list_model_files",
                            lambda: ["qwen3vl_8b.safetensors"])
        resp = await client.get("/comfytv/llm/v1/models")
        assert resp.status == 200
        body = await resp.json()
        assert body["data"] == [{"id": "qwen3vl_8b.safetensors",
                                 "object": "model", "owned_by": "comfyui"}]

    async def test_stream_rejected(self, client):
        _enable_bot()
        resp = await client.post("/comfytv/llm/v1/chat/completions", json={
            "stream": True,
            "messages": [{"role": "user", "content": "hi"}]})
        assert resp.status == 400

    async def test_empty_messages_rejected(self, client):
        _enable_bot()
        resp = await client.post("/comfytv/llm/v1/chat/completions", json={
            "messages": []})
        assert resp.status == 400

    async def test_no_model_available(self, client, monkeypatch):
        _enable_bot()
        monkeypatch.setattr(engine, "list_model_files", lambda: [])
        resp = await client.post("/comfytv/llm/v1/chat/completions", json={
            "messages": [{"role": "user", "content": "hi"}]})
        assert resp.status == 400
        body = await resp.json()
        assert "text_encoders" in body["error"]["message"]

    async def test_chat_completion_shape(self, client, monkeypatch):
        _enable_bot()
        seen = {}

        def fake_generate(model, messages, tools, **kwargs):
            seen.update(model=model, messages=messages, tools=tools,
                        **kwargs)
            return {"content": "done",
                    "tool_calls": [{"id": "call_0", "type": "function",
                                    "function": {"name": "get_canvas",
                                                 "arguments": "{}"}}],
                    "finish_reason": "tool_calls",
                    "usage": {"prompt_tokens": 1, "completion_tokens": 2,
                              "total_tokens": 3}}
        monkeypatch.setattr(engine, "generate_chat", fake_generate)
        resp = await client.post("/comfytv/llm/v1/chat/completions", json={
            "model": "m.safetensors",
            "messages": [{"role": "user", "content": "hi"}],
            "tools": [{"type": "function", "function": {"name": "t"}}],
            "max_tokens": 4096, "temperature": 0.2})
        assert resp.status == 200
        body = await resp.json()
        assert body["object"] == "chat.completion"
        assert body["model"] == "m.safetensors"
        choice = body["choices"][0]
        assert choice["finish_reason"] == "tool_calls"
        assert choice["message"]["content"] == "done"
        assert choice["message"]["tool_calls"][0]["function"]["name"] == \
            "get_canvas"
        assert seen["model"] == "m.safetensors"
        assert seen["max_tokens"] == 4096
        assert seen["temperature"] == 0.2

    async def test_model_not_found_maps_404(self, client, monkeypatch):
        _enable_bot()

        def fake_generate(model, messages, tools, **kwargs):
            raise FileNotFoundError(model)
        monkeypatch.setattr(engine, "generate_chat", fake_generate)
        resp = await client.post("/comfytv/llm/v1/chat/completions", json={
            "model": "missing.safetensors",
            "messages": [{"role": "user", "content": "hi"}]})
        assert resp.status == 404
