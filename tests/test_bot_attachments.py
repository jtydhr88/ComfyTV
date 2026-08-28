from __future__ import annotations

import asyncio
import json

import pytest

from conftest import FakeProvider, wait_bot_done as _wait_done
from ComfyTV.bot.providers import BotEvent, ProviderCaps, TurnResult, register_provider

@pytest.fixture()
def client(bot_client):
    return bot_client


class TestAttachments:
    def _make_image_asset(self, tmp_path, monkeypatch, name="ref"):
        from PIL import Image
        from ComfyTV import storage
        from ComfyTV.runners import media
        src = tmp_path / f"{name}.png"
        Image.new("RGB", (2400, 1200), (10, 200, 60)).save(src)
        monkeypatch.setattr(media, "localize", lambda url: src)
        return storage.create_asset(
            name=name, payload_url=f"/view?filename={name}.png",
            media_type="image")

    async def test_send_with_attachment(self, client, fake_provider,
                                        tmp_path, monkeypatch):
        import base64
        asset = self._make_image_asset(tmp_path, monkeypatch)
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "what colour?",
                                       "attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 200
        user_msg = (await resp.json())["user_message"]
        blocks = json.loads(user_msg["content"])
        assert blocks[0]["type"] == "image"
        assert blocks[0]["asset_id"] == asset["id"]
        assert blocks[1] == {"type": "text", "text": "what colour?"}

        await _wait_done(client, chat["id"])
        turn = fake_provider.last_turn
        assert len(turn.attachments) == 1
        att = turn.attachments[0]
        assert att["media_type"] == "image/jpeg"
        raw = base64.b64decode(att["data"])
        assert raw[:2] == b"\xff\xd8"
        assert "asset_refs" in turn.user_text
        assert f"asset #{asset['id']}" in turn.user_text

    async def test_attachment_only_no_text(self, client, fake_provider,
                                           tmp_path, monkeypatch):
        asset = self._make_image_asset(tmp_path, monkeypatch, "solo")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 200
        await _wait_done(client, chat["id"])
        assert "attached image" in fake_provider.last_turn.user_text.lower()

    async def test_attachment_validation(self, client, fake_provider):
        from ComfyTV import storage
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x",
                                       "attachments": [{"asset_id": 99999}]})
        assert resp.status == 400
        assert "not found" in (await resp.json())["error"]

        mesh = storage.create_asset(name="m", payload_url="/view?m.glb",
                                    media_type="model")
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x",
                                       "attachments": [{"asset_id": mesh["id"]}]})
        assert resp.status == 400
        assert "attachable types" in (await resp.json())["error"]

        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"attachments": []})
        assert resp.status == 400


class TestAVAttachments:
    def _make_asset(self, media_type, name="clip"):
        from ComfyTV import storage
        return storage.create_asset(
            name=name, payload_url=f"/view?filename={name}",
            media_type=media_type)

    async def test_video_attachment_frame_and_facts(self, client, fake_provider,
                                                    tmp_path, monkeypatch):
        from PIL import Image
        from ComfyTV.runners import media
        frame = tmp_path / "frame.png"
        Image.new("RGB", (640, 360), (5, 5, 5)).save(frame)
        monkeypatch.setattr(media, "get_video_info", lambda url: {
            "duration": 12.5, "fps": 24.0, "width": 1280, "height": 720,
            "has_audio": True})
        monkeypatch.setattr(media, "extract_frame",
                            lambda url, pos: "/view?frame.png")
        monkeypatch.setattr(media, "localize", lambda url: frame)

        asset = self._make_asset("video", "mv-take")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "看看这条",
                                       "attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 200
        blocks = json.loads((await resp.json())["user_message"]["content"])
        assert blocks[0]["type"] == "video"
        await _wait_done(client, chat["id"])
        turn = fake_provider.last_turn
        assert len(turn.attachments) == 1
        assert "12.50s 1280x720 @24fps with audio" in turn.user_text
        assert "middle frame" in turn.user_text
        assert f"asset #{asset['id']}" in turn.user_text

    async def test_audio_attachment_waveform_and_duration(
            self, client, fake_provider, tmp_path, monkeypatch):
        from PIL import Image
        from ComfyTV.api import bot as bot_api
        from ComfyTV.api import bot_media
        from ComfyTV.runners import audio_render, media
        wave = tmp_path / "wave.png"
        Image.new("RGB", (1200, 320), (0, 0, 0)).save(wave)
        monkeypatch.setattr(bot_media, "_audio_duration_s", lambda url: 187.4)
        monkeypatch.setattr(audio_render, "render_waveform_image",
                            lambda url, w, h: "/view?wave.png")
        monkeypatch.setattr(media, "localize", lambda url: wave)

        asset = self._make_asset("audio", "my-song")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 200
        blocks = json.loads((await resp.json())["user_message"]["content"])
        assert blocks[0]["type"] == "audio"
        await _wait_done(client, chat["id"])
        turn = fake_provider.last_turn
        assert len(turn.attachments) == 1
        assert "187.40s" in turn.user_text
        assert "waveform" in turn.user_text

    async def test_audio_degrades_without_waveform(self, client, fake_provider,
                                                   monkeypatch):
        from ComfyTV.api import bot as bot_api
        from ComfyTV.api import bot_media
        from ComfyTV.runners import audio_render

        def boom(url, w, h):
            raise RuntimeError("no decoder")

        monkeypatch.setattr(bot_media, "_audio_duration_s", lambda url: None)
        monkeypatch.setattr(audio_render, "render_waveform_image", boom)
        asset = self._make_asset("audio", "raw")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 200
        await _wait_done(client, chat["id"])
        turn = fake_provider.last_turn
        assert turn.attachments == []
        assert f"asset #{asset['id']}" in turn.user_text

    async def test_model_asset_rejected(self, client, fake_provider):
        asset = self._make_asset("model", "mesh")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x",
                                       "attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 400
        assert "attachable types" in (await resp.json())["error"]


class NoAttachProvider(FakeProvider):
    id = "fake-noattach"
    label = "FakeNoAttach"

    def capabilities(self):
        return ProviderCaps(stateful=True, tools="mcp", attachments=False)


class TestAttachmentCapability:
    async def test_status_exposes_attachments_cap(self, client, fake_provider):
        register_provider(NoAttachProvider())
        resp = await client.get("/comfytv/bot/status")
        entries = {p["id"]: p for p in (await resp.json())["providers"]}
        assert entries["fake-test"]["attachments"] is True
        assert entries["fake-noattach"]["attachments"] is False

    async def test_send_rejects_attachments_for_incapable_provider(
            self, client, fake_provider):
        from ComfyTV import storage
        register_provider(NoAttachProvider())
        asset = storage.create_asset(name="i", payload_url="/view?i.png",
                                     media_type="image")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-noattach"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "look",
                                       "attachments": [{"asset_id": asset["id"]}]})
        assert resp.status == 400
        assert "does not support attachments" in (await resp.json())["error"]


class TestSendWithSkill:
    @pytest.fixture()
    def skill_dirs(self, tmp_path, monkeypatch):
        from ComfyTV import skill_store
        builtin = tmp_path / "builtin-skills"
        user = tmp_path / "user-skills"
        builtin.mkdir()
        user.mkdir()
        monkeypatch.setattr(skill_store, "BUILTIN_SKILLS_DIR", builtin)
        monkeypatch.setattr(skill_store, "user_skills_dir", lambda: user)
        return builtin, user

    async def test_send_with_skill_prepends_directive(
            self, client, fake_provider, skill_dirs):
        from test_skill_store import make_skill
        builtin, _ = skill_dirs
        make_skill(builtin, "trailer-cutter")
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "cut a trailer",
                                       "skill": "trailer-cutter"})
        assert resp.status == 200
        user_msg = (await resp.json())["user_message"]
        blocks = json.loads(user_msg["content"])
        assert blocks[0] == {"type": "skill", "name": "trailer-cutter"}
        assert blocks[1] == {"type": "text", "text": "cut a trailer"}

        await _wait_done(client, chat["id"])
        sent = fake_provider.last_turn.user_text
        assert sent.startswith("Use the ComfyTV skill 'trailer-cutter'")
        assert "action='read'" in sent
        assert sent.endswith("cut a trailer")

    async def test_send_with_unknown_or_disabled_skill(
            self, client, fake_provider, skill_dirs):
        from ComfyTV import skill_store
        from test_skill_store import make_skill
        builtin, _ = skill_dirs
        resp = await client.post("/comfytv/bot/chats",
                                 json={"provider": "fake-test"})
        chat = (await resp.json())["chat"]
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x", "skill": "ghost"})
        assert resp.status == 400
        make_skill(builtin, "off-skill")
        skill_store.set_skill_enabled("off-skill", False)
        resp = await client.post(f"/comfytv/bot/chats/{chat['id']}/send",
                                 json={"text": "x", "skill": "off-skill"})
        assert resp.status == 400
