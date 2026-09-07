import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
async def client(reset_db):
    from ComfyTV.api import fx_preview  # noqa: F401
    from ComfyTV.api._common import routes
    app = web.Application()
    app.add_routes(routes)
    test_client = TestClient(TestServer(app))
    await test_client.start_server()
    yield test_client
    await test_client.close()


def _cls(name):
    from ComfyTV.api import presets
    import asyncio
    return asyncio.run(presets._stage_class_map())[f"ComfyTV.{name}"]


class TestPreviewKind:
    def test_spec_render_and_multi_input_are_told_apart_without_running(self):
        from ComfyTV.api.fx_preview import preview_kind
        assert preview_kind(_cls("VideoColorStage")) == "spec"
        assert preview_kind(_cls("VideoChromaKeyStage")) == "renders"
        assert preview_kind(_cls("VideoConcatStage")) == "multi_input"


class TestGate:
    async def _post(self, client, node, params=None):
        return await client.post("/comfytv/fx_preview", json={
            "node_id": f"ComfyTV.{node}", "video": "/view?filename=nope.mp4&type=output",
            "params": params or {}})

    async def test_direct_render_stage_is_refused_before_any_work(self, client, monkeypatch):
        from ComfyTV.nodes.stages import video_keying
        def boom(cls, video="", project_id="", **kw):
            raise AssertionError("must not run")
        monkeypatch.setattr(video_keying.VideoChromaKeyStage, "execute", classmethod(boom))
        r = await self._post(client, "VideoChromaKeyStage")
        assert r.status == 400
        assert "renders its result directly" in (await r.json())["error"]

    async def test_multi_input_stage_gets_its_own_message(self, client):
        r = await self._post(client, "VideoConcatStage")
        assert r.status == 400
        assert "single-source FX only" in (await r.json())["error"]

    async def test_neutral_params_say_nothing_to_preview(self, client):
        r = await self._post(client, "VideoColorStage")
        assert r.status == 400
        assert "nothing to preview" in (await r.json())["error"]

    async def test_bad_combo_value_lists_the_choices(self, client):
        r = await self._post(client, "VideoCurvesStage", {"preset": "s-curve"})
        assert r.status == 400
        err = (await r.json())["error"]
        assert err.startswith("preset must be one of: none, color_negative")
        assert "'s-curve'" in err


class TestMcpTool:
    async def test_mcp_fx_preview_uses_the_same_gate(self, reset_db, monkeypatch):
        from ComfyTV.api.mcp_tools.media import _fx_preview
        from ComfyTV.nodes.stages import video_keying

        def boom(cls, video="", project_id="", **kw):
            raise AssertionError("must not run")
        monkeypatch.setattr(video_keying.VideoChromaKeyStage, "execute", classmethod(boom))
        with pytest.raises(ValueError, match="renders its result directly"):
            await _fx_preview({"node_class": "ComfyTV.VideoChromaKeyStage",
                               "video": "/view?filename=x.mp4&type=output"})
        with pytest.raises(ValueError, match="preset must be one of"):
            await _fx_preview({"node_class": "ComfyTV.VideoCurvesStage",
                               "video": "/view?filename=x.mp4&type=output",
                               "params": {"preset": "s-curve"}})
        with pytest.raises(ValueError, match="single-source FX only"):
            await _fx_preview({"node_class": "ComfyTV.VideoConcatStage",
                               "video": "/view?filename=x.mp4&type=output"})
