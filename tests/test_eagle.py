from __future__ import annotations

import json
from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


def _mk_library(root: Path) -> Path:
    lib = root / "TestLib.library"
    (lib / "images").mkdir(parents=True)
    (lib / "metadata.json").write_text(json.dumps({
        "folders": [
            {"id": "F1", "name": "Refs", "children": [
                {"id": "F2", "name": "Faces", "children": []},
            ]},
        ],
    }), encoding="utf-8")
    (lib / "mtime.json").write_text("{}", encoding="utf-8")

    def add_item(item_id, name, ext, *, tags=(), folders=(), mtime=0, deleted=False):
        d = lib / "images" / f"{item_id}.info"
        d.mkdir()
        (d / f"{name}.{ext}").write_bytes(b"\x89PNG fake")
        (d / f"{name}_thumbnail.png").write_bytes(b"\x89PNG thumb")
        (d / "metadata.json").write_text(json.dumps({
            "id": item_id, "name": name, "ext": ext, "width": 64, "height": 32,
            "size": 9, "tags": list(tags), "folders": list(folders),
            "annotation": "", "star": 0, "modificationTime": mtime,
            "isDeleted": deleted,
        }), encoding="utf-8")

    add_item("AAA1", "hero", "png", tags=("girl",), folders=("F1",), mtime=300)
    add_item("BBB2", "clip", "mp4", folders=("F2",), mtime=200)
    add_item("CCC3", "gone", "png", mtime=100, deleted=True)
    return lib


@pytest.fixture()
def library(tmp_path):
    return _mk_library(tmp_path)


@pytest.fixture()
def eagle_env(reset_db, library, monkeypatch):
    """Enabled integration, pinned to the fake library, Eagle app offline."""
    from ComfyTV import storage
    from ComfyTV.runners import eagle, eagle_lib

    storage.set_settings({
        "enable-eagle": True,
        "eagle-library-path": str(library),
    })

    async def _no_api(*a, **k):
        raise ConnectionError("eagle offline in tests")

    monkeypatch.setattr(eagle, "_request", _no_api)
    monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
    eagle._folder_cache.clear()
    eagle_lib._cache.clear()
    return library


@pytest.fixture()
async def client(eagle_env):
    from ComfyTV import api  # noqa: F401 — registers routes
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_client = TestClient(TestServer(app))
    await test_client.start_server()
    yield test_client
    await test_client.close()


class TestEagleLib:
    def test_read_items_skips_trash_and_sorts(self, library):
        from ComfyTV.runners import eagle_lib
        eagle_lib._cache.clear()
        items = eagle_lib.read_items(library)
        assert [i["id"] for i in items] == ["AAA1", "BBB2"]
        assert items[0]["width"] == 64 and items[0]["tags"] == ["girl"]

    def test_cache_invalidates_on_mtime_change(self, library):
        from ComfyTV.runners import eagle_lib
        eagle_lib._cache.clear()
        assert len(eagle_lib.read_items(library)) == 2
        d = library / "images" / "DDD4.info"
        d.mkdir()
        (d / "x.png").write_bytes(b"x")
        (d / "metadata.json").write_text(json.dumps({
            "id": "DDD4", "name": "x", "ext": "png", "modificationTime": 999,
        }), encoding="utf-8")
        assert len(eagle_lib.read_items(library)) == 2  # cached
        (library / "mtime.json").write_text('{"changed": 1}', encoding="utf-8")
        assert len(eagle_lib.read_items(library)) == 3

    def test_filters(self, library):
        from ComfyTV.runners import eagle_lib
        eagle_lib._cache.clear()
        items = eagle_lib.read_items(library)
        assert [i["id"] for i in eagle_lib.filter_items(items, keyword="girl")] == ["AAA1"]
        assert [i["id"] for i in eagle_lib.filter_items(items, folder="F2")] == ["BBB2"]
        assert [i["id"] for i in eagle_lib.filter_items(items, media_type="video")] == ["BBB2"]

    def test_item_files_and_id_validation(self, library):
        from ComfyTV.runners import eagle_lib
        assert eagle_lib.item_main_file(library, "AAA1").name == "hero.png"
        assert eagle_lib.item_thumb_file(library, "AAA1").name == "hero_thumbnail.png"
        assert not eagle_lib.valid_item_id("../evil")
        assert eagle_lib.item_dir(library, "../evil") is None

    def test_read_folders(self, library):
        from ComfyTV.runners import eagle_lib
        folders = eagle_lib.read_folders(library)
        assert [(f["id"], f["depth"]) for f in folders] == [("F1", 0), ("F2", 1)]


class TestEagleApi:
    async def test_status_disk_mode(self, client):
        data = await (await client.get("/comfytv/eagle/status")).json()
        assert data["enabled"] is True
        assert data["mode"] == "disk"
        assert data["online"] is False

    async def test_disabled_gates_endpoints(self, client):
        from ComfyTV import storage
        storage.set_settings({"enable-eagle": False})
        data = await (await client.get("/comfytv/eagle/status")).json()
        assert data == {"enabled": False, "mode": "disabled", "pending": 0}
        assert (await client.get("/comfytv/eagle/items")).status == 403

    async def test_items_disk_listing_and_filters(self, client):
        data = await (await client.get("/comfytv/eagle/items")).json()
        assert data["mode"] == "disk"
        assert [i["id"] for i in data["items"]] == ["AAA1", "BBB2"]
        data = await (await client.get("/comfytv/eagle/items?media_type=image")).json()
        assert [i["id"] for i in data["items"]] == ["AAA1"]
        assert (await client.get("/comfytv/eagle/items?media_type=nope")).status == 400

    async def test_folders(self, client):
        data = await (await client.get("/comfytv/eagle/folders")).json()
        assert [f["name"] for f in data["folders"]] == ["Refs", "Faces"]

    async def test_thumb_and_file(self, client):
        r = await client.get("/comfytv/eagle/thumb?id=AAA1")
        assert r.status == 200
        assert await r.read() == b"\x89PNG thumb"
        r = await client.get("/comfytv/eagle/file?id=AAA1")
        assert await r.read() == b"\x89PNG fake"
        assert (await client.get("/comfytv/eagle/thumb?id=..%2Fevil")).status == 400
        assert (await client.get("/comfytv/eagle/thumb?id=ZZZ9")).status == 404

    async def test_import_creates_asset_once(self, client):
        r = await client.post("/comfytv/eagle/import", json={"id": "AAA1"})
        assert r.status == 200
        asset = (await r.json())["asset"]
        assert asset["source"] == "eagle"
        assert asset["media_type"] == "image"
        assert "comfytv%2Feagle" in asset["payload_url"] \
            or "comfytv/eagle" in asset["payload_url"]

        r = await client.post("/comfytv/eagle/import", json={"id": "AAA1"})
        assert (await r.json()).get("existed") is True

    async def test_send_queues_when_offline_and_flushes(self, client, eagle_env, monkeypatch):
        import folder_paths
        from ComfyTV import storage
        from ComfyTV.runners import eagle

        src_dir = Path(folder_paths.get_input_directory()) / "comfytv" / "media"
        src_dir.mkdir(parents=True, exist_ok=True)
        (src_dir / "out.png").write_bytes(b"img")
        url = "/view?filename=out.png&subfolder=comfytv/media&type=input"

        r = await client.post("/comfytv/eagle/send",
                              json={"payload_url": url, "name": "out"})
        data = await r.json()
        assert data["sent"] is False and data["queued"] is True
        assert storage.eagle_pending_count() == 1

        # duplicate send does not double-queue
        await client.post("/comfytv/eagle/send", json={"payload_url": url})
        assert storage.eagle_pending_count() == 1

        sent_paths = []

        async def _fake_send_now(path, **kw):
            sent_paths.append(Path(path).name)

        monkeypatch.setattr(eagle, "send_now", _fake_send_now)
        r = await client.post("/comfytv/eagle/flush")
        data = await r.json()
        assert data["sent"] == 1 and data["remaining"] == 0
        assert sent_paths == ["out.png"]

    async def test_send_missing_file_404(self, client):
        r = await client.post("/comfytv/eagle/send",
                              json={"payload_url": "/view?filename=nope.png&type=input"})
        assert r.status == 404

    async def test_pending_list_and_delete(self, client, eagle_env):
        import folder_paths
        src_dir = Path(folder_paths.get_input_directory()) / "comfytv" / "media"
        src_dir.mkdir(parents=True, exist_ok=True)
        (src_dir / "q.png").write_bytes(b"img")
        url = "/view?filename=q.png&subfolder=comfytv/media&type=input"
        await client.post("/comfytv/eagle/send", json={"payload_url": url})

        rows = (await (await client.get("/comfytv/eagle/pending")).json())["pending"]
        assert len(rows) == 1 and rows[0]["payload_url"] == url

        r = await client.delete(f"/comfytv/eagle/pending/{rows[0]['id']}")
        assert r.status == 200
        rows = (await (await client.get("/comfytv/eagle/pending")).json())["pending"]
        assert rows == []


class TestV2:
    @staticmethod
    def _v2_fake(library, *, ai_ready=False, get_log=None, query_log=None,
                 get_rows=None, query_rows=None, page_clamp=None):
        default_get = [{"id": "QQQ1", "name": "hit", "ext": "png",
                        "width": 8, "height": 8, "size": 1,
                        "tags": [], "folders": [], "modificationTime": 5}]
        get_data = default_get if get_rows is None else get_rows

        async def _fake_request(method, path, *, params=None, json_body=None, **kw):
            if path == "/api/v2/app/info":
                return {"version": "4.0.0", "buildVersion": "20260401"}
            if path == "/api/v2/library/info":
                return {"path": str(library), "name": "TestLib"}
            if path == "/api/v2/aiSearch/isReady":
                return ai_ready
            if path in ("/api/v2/item/get", "/api/v2/item/query"):
                dataset = get_data if path.endswith("get") else list(query_rows or [])
                log = get_log if path.endswith("get") else query_log
                if log is not None:
                    log.append(json_body)
                limit = json_body.get("limit", 50)
                if page_clamp:
                    limit = min(limit, page_clamp)
                off = json_body.get("offset", 0)
                return {"data": dataset[off:off + limit],
                        "total": len(dataset), "offset": off, "limit": limit}
            raise ConnectionError(path)
        return _fake_request

    async def test_probe_detects_v2(self, eagle_env, monkeypatch, library):
        from ComfyTV.runners import eagle
        monkeypatch.setattr(eagle, "_request", self._v2_fake(library))
        monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
        status = await eagle.probe()
        assert status["api_version"] == "v2"
        assert status["mode"] == "api"
        assert status["ai_ready"] is False

    async def test_list_items_v2_folder_uses_item_get(self, eagle_env, monkeypatch, library):
        from ComfyTV.runners import eagle
        log = []
        rows = [{"id": f"R{i}", "name": f"r{i}", "ext": "png",
                 "modificationTime": i} for i in range(3)]
        monkeypatch.setattr(eagle, "_request", self._v2_fake(
            library, get_log=log, get_rows=rows))
        monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
        status = await eagle.probe()
        result = await eagle.list_items(status, folder="F1", limit=1, offset=1)
        assert result["total"] == 3
        assert [i["id"] for i in result["items"]] == ["R1"]
        body = log[0]
        assert body["folders"] == ["F1"]
        assert body["offset"] == 1  # real item offset, not V1 page index
        assert body["limit"] == 1
        assert "ext" not in body

    async def test_list_items_v2_media_type_filters_locally(self, eagle_env, monkeypatch, library):
        # item/get's ext only takes a single string — media types span
        # several extensions, so the client filters a big page locally.
        from ComfyTV.runners import eagle
        log = []
        monkeypatch.setattr(eagle, "_request", self._v2_fake(library, get_log=log))
        monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
        status = await eagle.probe()
        result = await eagle.list_items(
            status, folder="F1", media_type="video", limit=50, offset=0)
        assert result["items"] == [] and result["total"] == 0  # fake row is png
        body = log[0]
        assert body["folders"] == ["F1"]
        assert body["limit"] == eagle.QUERY_PAGE_LIMIT
        assert "ext" not in body

    async def test_list_items_v2_keyword_filters_locally(self, eagle_env, monkeypatch, library):
        # item/query ignores folders/ext on build 20260401 — the client must
        # filter its results itself.
        from ComfyTV.runners import eagle
        log = []
        rows = [
            {"id": "AA1", "name": "hit-a", "ext": "png", "folders": ["F1"],
             "modificationTime": 2},
            {"id": "BB2", "name": "hit-b", "ext": "png", "folders": ["F2"],
             "modificationTime": 1},
            {"id": "CC3", "name": "hit-c", "ext": "mp4", "folders": ["F1"],
             "modificationTime": 3},
        ]
        monkeypatch.setattr(eagle, "_request", self._v2_fake(
            library, query_log=log, query_rows=rows))
        monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
        status = await eagle.probe()
        result = await eagle.list_items(
            status, keyword="hit", folder="F1", media_type="image",
            limit=50, offset=0)
        assert [i["id"] for i in result["items"]] == ["AA1"]
        assert result["total"] == 1
        body = log[0]
        assert body["query"] == "hit"
        assert body["limit"] == eagle.QUERY_PAGE_LIMIT
        assert "folders" not in body and "ext" not in body

    async def test_fetch_all_v2_pages_until_total(self, eagle_env, monkeypatch, library):
        # Server clamps every page to 2 rows — the client must keep paging
        # (advancing by rows actually returned) until total is exhausted.
        from ComfyTV.runners import eagle
        log = []
        rows = [{"id": f"P{i}", "name": f"page-hit-{i}", "ext": "png",
                 "modificationTime": i} for i in range(5)]
        monkeypatch.setattr(eagle, "_request", self._v2_fake(
            library, query_log=log, query_rows=rows, page_clamp=2))
        monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
        status = await eagle.probe()
        result = await eagle.list_items(
            status, keyword="page-hit", media_type="image",
            limit=50, offset=0)
        assert [i["id"] for i in result["items"]] == ["P0", "P1", "P2", "P3", "P4"]
        assert result["total"] == 5
        assert [b["offset"] for b in log] == [0, 2, 4]

    async def test_ai_search_requires_ready(self, eagle_env, monkeypatch, library):
        from ComfyTV.runners import eagle
        monkeypatch.setattr(eagle, "_request", self._v2_fake(library, ai_ready=False))
        monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
        status = await eagle.probe()
        with pytest.raises(eagle.EagleUnavailable):
            await eagle.ai_search(status, text="cat")

    async def test_ai_search_parses_scored_entries(self, eagle_env, monkeypatch, library):
        from ComfyTV.runners import eagle

        async def _fake_request(method, path, *, params=None, json_body=None, **kw):
            if path == "/api/v2/app/info":
                return {"version": "4.0.0"}
            if path == "/api/v2/library/info":
                return {"path": str(library)}
            if path == "/api/v2/aiSearch/isReady":
                return True
            if path == "/api/v2/aiSearch/searchByText":
                return [{"item": {"id": "SSS1", "name": "cat", "ext": "png",
                                  "modificationTime": 1}, "score": 0.9}]
            raise ConnectionError(path)

        monkeypatch.setattr(eagle, "_request", _fake_request)
        monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
        status = await eagle.probe()
        items = await eagle.ai_search(status, text="cat")
        assert items[0]["id"] == "SSS1" and items[0]["score"] == 0.9

    async def test_similar_endpoint_409_without_ai(self, client):
        r = await client.get("/comfytv/eagle/similar?id=AAA1")
        assert r.status == 409

    async def test_items_endpoint_reports_disk_total(self, client):
        data = await (await client.get("/comfytv/eagle/items")).json()
        assert data["total"] == 2


class TestAnnotation:
    def test_format_annotation(self):
        from ComfyTV.runners import eagle
        text = eagle.format_annotation(
            stage_class="ImageStage", project_name="雨夜追逐",
            params={"prompt": "a cat", "steps": 20, "empty": "", "nested": {"a": 1}},
            created_at="2026-08-26T04:00:00")
        assert text.splitlines()[0] == "ComfyTV · ImageStage · 2026-08-26T04:00:00"
        assert "project: 雨夜追逐" in text
        assert "prompt: a cat" in text
        assert "steps: 20" in text
        assert 'nested: {"a": 1}' in text
        assert "empty" not in text

    def test_annotation_for_url_recovers_params(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.runners import eagle
        storage.persist_output(
            project_id="", stage_class="VideoStage", stage_node_id="7",
            output_type="video",
            payload_url="/view?filename=v.mp4&type=output",
            params={"prompt": "rain chase", "fps": 24})
        text = eagle.annotation_for_url("/view?filename=v.mp4&type=output")
        assert "VideoStage" in text
        assert "prompt: rain chase" in text
        assert "project: Default" in text
        assert eagle.annotation_for_url("/view?filename=none.png") == ""


class TestAutoSend:
    def _prep(self, library, *, auto=True):
        from ComfyTV import storage
        storage.set_settings({
            "enable-eagle": True,
            "eagle-auto-send": auto,
            "eagle-library-path": str(library),
        })

    def test_disabled_toggle_is_noop(self, eagle_env):
        from ComfyTV import storage
        from ComfyTV.runners import eagle
        self._prep(eagle_env, auto=False)
        assert eagle.auto_send_output(
            payload_url="/view?filename=a.png&type=output",
            output_type="image", project_id="", stage_class="ImageStage") is False
        assert storage.eagle_pending_count() == 0

    def test_enqueues_with_project_folder_and_annotation(self, eagle_env):
        from ComfyTV import storage
        from ComfyTV.runners import eagle
        self._prep(eagle_env)
        proj = storage.create_project("雨夜追逐")
        assert eagle.auto_send_output(
            payload_url="/view?filename=a.png&type=output",
            output_type="image", project_id=proj["id"],
            stage_class="ImageStage", params={"prompt": "cat"}) is True
        rows = storage.list_eagle_pending()
        assert rows[0]["folder"] == "雨夜追逐"
        assert rows[0]["name"] == "ImageStage"
        assert "prompt: cat" in rows[0]["annotation"]
        assert rows[0]["tags"] == ["comfytv", "雨夜追逐"]

    def test_images_batch_enqueues_each_url(self, eagle_env):
        from ComfyTV import storage
        from ComfyTV.runners import eagle
        self._prep(eagle_env)
        assert eagle.auto_send_output(
            payload_url="",
            output_type="images", project_id="", stage_class="ImageStage",
            payload_json={"images": [
                {"index": "1", "image_url": "/view?filename=b1.png&type=output"},
                {"index": "2", "image_url": "/view?filename=b2.png&type=output"},
                {"index": "3", "image_url": "not-a-view"},
            ]}) is True
        rows = storage.list_eagle_pending()
        assert [r["payload_url"] for r in rows] == [
            "/view?filename=b1.png&type=output",
            "/view?filename=b2.png&type=output",
        ]
        assert rows[0]["name"] == "ImageStage #1"
        assert rows[1]["name"] == "ImageStage #2"

    def test_skips_non_media_and_non_view(self, eagle_env):
        from ComfyTV import storage
        from ComfyTV.runners import eagle
        self._prep(eagle_env)
        assert eagle.auto_send_output(
            payload_url="/view?filename=a.txt&type=output",
            output_type="text", project_id="", stage_class="TextStage") is False
        assert eagle.auto_send_output(
            payload_url="not-a-view-url",
            output_type="image", project_id="", stage_class="ImageStage") is False
        assert storage.eagle_pending_count() == 0

    async def test_flush_sends_row_folder(self, eagle_env, monkeypatch):
        import folder_paths
        from ComfyTV import storage
        from ComfyTV.runners import eagle
        self._prep(eagle_env)
        src_dir = Path(folder_paths.get_input_directory()) / "comfytv" / "media"
        src_dir.mkdir(parents=True, exist_ok=True)
        (src_dir / "f.png").write_bytes(b"x")
        storage.enqueue_eagle_send(
            payload_url="/view?filename=f.png&subfolder=comfytv/media&type=input",
            name="f", folder="ProjX")

        seen = {}

        async def _fake_send_now(path, **kw):
            seen.update(kw)

        monkeypatch.setattr(eagle, "send_now", _fake_send_now)
        result = await eagle.flush_pending()
        assert result["sent"] == 1
        assert seen["folder"] == "ProjX"


class TestProbeModes:
    async def test_probe_api_mode_when_library_matches(self, eagle_env, monkeypatch, library):
        from ComfyTV.runners import eagle

        async def _fake_request(method, path, **kw):
            if path == "/api/application/info":
                return {"version": "4.0.0"}
            if path == "/api/library/info":
                return {"library": {"path": str(library)}}
            raise ConnectionError(path)

        monkeypatch.setattr(eagle, "_request", _fake_request)
        monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
        status = await eagle.probe()
        assert status["mode"] == "api" and status["library_match"] is True

    async def test_probe_disk_mode_on_library_mismatch(self, eagle_env, monkeypatch):
        from ComfyTV.runners import eagle

        async def _fake_request(method, path, **kw):
            if path == "/api/application/info":
                return {"version": "4.0.0"}
            if path == "/api/library/info":
                return {"library": {"path": "C:\\Other.library"}}
            raise AssertionError(path)

        monkeypatch.setattr(eagle, "_request", _fake_request)
        monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
        status = await eagle.probe()
        assert status["online"] is True
        assert status["library_match"] is False
        assert status["mode"] == "disk"

    async def test_send_now_refuses_on_mismatch(self, eagle_env, monkeypatch, tmp_path):
        from ComfyTV.runners import eagle

        async def _fake_request(method, path, **kw):
            if path == "/api/application/info":
                return {"version": "4.0.0"}
            if path == "/api/library/info":
                return {"library": {"path": "C:\\Other.library"}}
            raise AssertionError(f"unexpected write {path}")

        monkeypatch.setattr(eagle, "_request", _fake_request)
        monkeypatch.setattr(eagle, "_probe_cache", {"at": 0.0, "status": None})
        f = tmp_path / "x.png"
        f.write_bytes(b"x")
        with pytest.raises(eagle.EagleUnavailable):
            await eagle.send_now(f)
