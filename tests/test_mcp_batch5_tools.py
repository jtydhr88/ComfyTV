from __future__ import annotations

import pytest


class TestStageParamsTool:
    async def test_create_list_update_delete(self, reset_db):
        from ComfyTV.api.mcp_tools import _stage_params_tool
        out = await _stage_params_tool({
            "action": "create", "kind": "video", "label": "Guidance Scale",
            "type": "float", "default": 7.5,
            "config": {"min": 1, "max": 20, "step": 0.5},
        })
        param = out["param"]
        assert param["key"]
        pid = param["id"]

        out = await _stage_params_tool({"action": "list", "kind": "video"})
        assert any(p["id"] == pid for p in out["params"])

        out = await _stage_params_tool({"action": "update", "id": pid,
                                        "label": "CFG"})
        assert out["param"]["label"] == "CFG"

        out = await _stage_params_tool({"action": "delete", "id": pid})
        assert out["ok"] is True

    async def test_validation(self, reset_db):
        from ComfyTV.api.mcp_tools import _stage_params_tool
        with pytest.raises(ValueError, match="kind is required"):
            await _stage_params_tool({"action": "create", "label": "x",
                                      "type": "int"})
        with pytest.raises(ValueError, match="unknown type"):
            await _stage_params_tool({"action": "create", "kind": "video",
                                      "label": "x", "type": "vector"})
        with pytest.raises(ValueError, match="not found"):
            await _stage_params_tool({"action": "delete", "id": 99999})


class TestMediaTools:
    async def test_probe_requires_url(self, reset_db):
        from ComfyTV.api.mcp_tools import _media_probe, _media_frame, _media_waveform
        for tool in (_media_probe, _media_frame, _media_waveform):
            with pytest.raises(ValueError, match="url is required"):
                await tool({})

    async def test_probe_delegates(self, reset_db, monkeypatch):
        from ComfyTV.api import mcp_tools
        from ComfyTV.runners import media
        monkeypatch.setattr(media, "get_video_info", lambda url: {
            "duration": 4.0, "fps": 24.0, "width": 1280, "height": 720,
            "has_audio": True, "_url": url,
        })
        out = await mcp_tools._media_probe({"url": "/view?x"})
        assert out["duration"] == 4.0
        assert out["_url"] == "/view?x"

    async def test_frame_delegates_with_position(self, reset_db, monkeypatch):
        from ComfyTV.api import mcp_tools
        from ComfyTV.runners import media
        seen = {}

        def fake_extract(url, position):
            seen["args"] = (url, position)
            return "/view?frame.png"

        monkeypatch.setattr(media, "extract_frame", fake_extract)
        out = await mcp_tools._media_frame({"url": "/view?x", "position": "25%"})
        assert out == {"image": "/view?frame.png"}
        assert seen["args"] == ("/view?x", "25%")

    async def test_waveform_clamps_size(self, reset_db, monkeypatch):
        from ComfyTV.api import mcp_tools
        from ComfyTV.runners import audio_render
        seen = {}

        def fake_wave(url, width, height):
            seen["args"] = (url, width, height)
            return "/view?wave.png"

        monkeypatch.setattr(audio_render, "render_waveform_image", fake_wave)
        out = await mcp_tools._media_waveform({"url": "/view?a", "width": 99999,
                                              "height": 1})
        assert out == {"image": "/view?wave.png"}
        assert seen["args"] == ("/view?a", 4000, 100)


class TestPickOutput:
    async def test_pick_roundtrip(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.api.mcp_tools import _pick_output
        storage.ensure_default_project()
        row = storage.persist_output(
            project_id="default", stage_class="ImageStage",
            stage_node_id="5", output_type="image", payload_url="/view?i",
        )
        out = await _pick_output({"output_id": row["id"], "picked_index": 2})
        assert out["output"]["picked_index"] == 2

    async def test_validation(self, reset_db):
        from ComfyTV.api.mcp_tools import _pick_output
        with pytest.raises(ValueError, match="output_id"):
            await _pick_output({"picked_index": 0})
        with pytest.raises(ValueError, match="picked_index"):
            await _pick_output({"output_id": 1, "picked_index": -1})
        with pytest.raises(ValueError, match="not found"):
            await _pick_output({"output_id": 99999, "picked_index": 0})


class TestCommandPassthrough:
    @pytest.fixture()
    def fake_submit(self, monkeypatch):
        from ComfyTV.api import mcp_tools
        calls = {}

        async def submit(action, payload, timeout=15.0):
            calls["action"] = action
            calls["payload"] = payload
            calls["timeout"] = timeout
            return {"ok": True}

        monkeypatch.setattr(mcp_tools, "submit_command", submit)
        return calls

    async def test_cancel_stage(self, reset_db, fake_submit):
        from ComfyTV.api.mcp_tools import _cancel_stage
        await _cancel_stage({"node": "u1"})
        assert fake_submit["action"] == "cancel_stage"
        assert fake_submit["payload"]["node"] == "u1"
        assert fake_submit["timeout"] == 30.0
        with pytest.raises(ValueError, match="node is required"):
            await _cancel_stage({})

    async def test_get_stage(self, reset_db, fake_submit):
        from ComfyTV.api.mcp_tools import _get_stage
        await _get_stage({"node": "7", "project_id": "p1"})
        assert fake_submit["action"] == "get_stage"
        assert fake_submit["payload"] == {"node": "7", "project_id": "p1"}
        with pytest.raises(ValueError, match="node is required"):
            await _get_stage({})


class TestDirectorPassthrough:
    @pytest.fixture()
    def fake_submit(self, monkeypatch):
        from ComfyTV.api import mcp_tools
        calls = {}

        async def submit(action, payload, timeout=15.0):
            calls["action"] = action
            calls["payload"] = payload
            calls["timeout"] = timeout
            return {"ok": True}

        monkeypatch.setattr(mcp_tools, "submit_command", submit)
        return calls

    async def test_director_get(self, reset_db, fake_submit):
        from ComfyTV.api.mcp_tools import _director_get
        await _director_get({"node": "u1"})
        assert fake_submit["action"] == "director_get"
        assert fake_submit["payload"]["node"] == "u1"
        with pytest.raises(ValueError, match="node is required"):
            await _director_get({})

    async def test_director_edit_validates_ops(self, reset_db, fake_submit):
        from ComfyTV.api.mcp_tools import _director_edit
        await _director_edit({"node": "u1", "ops": [{"op": "reroll"}]})
        assert fake_submit["action"] == "director_edit"
        assert fake_submit["payload"]["ops"] == [{"op": "reroll"}]
        assert fake_submit["timeout"] == 30.0
        with pytest.raises(ValueError, match="non-empty array"):
            await _director_edit({"node": "u1", "ops": []})
        with pytest.raises(ValueError, match="'op' field"):
            await _director_edit({"node": "u1", "ops": [{"nope": 1}]})


class TestViewImage:
    async def test_returns_image_block_data(self, reset_db, tmp_path, monkeypatch):
        from PIL import Image
        import base64

        from ComfyTV.api import mcp_tools
        from ComfyTV.runners import media

        src = tmp_path / "big.png"
        Image.new("RGB", (2000, 1000), (200, 40, 40)).save(src)
        monkeypatch.setattr(media, "localize", lambda url: src)

        out = await mcp_tools._view_image({"url": "/view?filename=big.png"})
        assert out["source_width"] == 2000
        assert out["width"] <= 768 and out["height"] <= 768
        assert out["width"] / out["height"] == pytest.approx(2.0, abs=0.02)
        img = out["_images"][0]
        assert img["mime"] == "image/jpeg"
        raw = base64.b64decode(img["data"])
        assert raw[:2] == b"\xff\xd8"

    async def test_max_px_clamped(self, reset_db, tmp_path, monkeypatch):
        from PIL import Image

        from ComfyTV.api import mcp_tools
        from ComfyTV.runners import media

        src = tmp_path / "s.png"
        Image.new("RGB", (3000, 3000), (0, 0, 0)).save(src)
        monkeypatch.setattr(media, "localize", lambda url: src)
        out = await mcp_tools._view_image({"url": "/view?x", "max_px": 99999})
        assert out["width"] == 1200
        out = await mcp_tools._view_image({"url": "/view?x", "max_px": 1})
        assert out["width"] == 256

    async def test_non_image_hints_media_frame(self, reset_db, tmp_path, monkeypatch):
        from ComfyTV.api import mcp_tools
        from ComfyTV.runners import media

        src = tmp_path / "clip.mp4"
        src.write_bytes(b"not an image")
        monkeypatch.setattr(media, "localize", lambda url: src)
        with pytest.raises(ValueError, match="media_frame"):
            await mcp_tools._view_image({"url": "/view?clip.mp4"})

    async def test_url_required(self, reset_db):
        from ComfyTV.api.mcp_tools import _view_image
        with pytest.raises(ValueError, match="url is required"):
            await _view_image({})


class TestImageContentBlocks:
    async def test_tools_call_emits_image_blocks(self, monkeypatch):
        from ComfyTV.api import mcp
        from ComfyTV.api.mcp_tools import TOOLS

        async def fake_handler(args):
            return {"info": 1, "_images": [{"data": "QUJD", "mime": "image/jpeg"}]}

        monkeypatch.setitem(TOOLS, "fake_img_tool", {
            "description": "x",
            "inputSchema": {"type": "object", "properties": {}},
            "handler": fake_handler,
        })
        out = await mcp._tools_call({"name": "fake_img_tool", "arguments": {}})
        assert out["isError"] is False
        assert [b["type"] for b in out["content"]] == ["text", "image"]
        assert out["content"][1]["data"] == "QUJD"
        assert out["content"][1]["mimeType"] == "image/jpeg"
        assert "_images" not in out["content"][0]["text"]

    async def test_plain_payloads_unchanged(self, monkeypatch):
        from ComfyTV.api import mcp
        from ComfyTV.api.mcp_tools import TOOLS

        async def fake_handler(args):
            return {"plain": True}

        monkeypatch.setitem(TOOLS, "fake_plain_tool", {
            "description": "x",
            "inputSchema": {"type": "object", "properties": {}},
            "handler": fake_handler,
        })
        out = await mcp._tools_call({"name": "fake_plain_tool", "arguments": {}})
        assert [b["type"] for b in out["content"]] == ["text"]
