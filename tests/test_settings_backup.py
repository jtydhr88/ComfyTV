from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
def node_root(tmp_path, monkeypatch):
    from ComfyTV import settings
    d = tmp_path / "node_root"
    d.mkdir()
    monkeypatch.setattr(settings, "CUSTOM_NODE_DIR", str(d))
    return d


def _write_props(node_root: Path, text: str) -> None:
    (node_root / "comfytv.properties").write_text(text, encoding="utf-8")


def _make_data_dir(base: Path) -> Path:
    d = base / "data"
    (d / "workflows").mkdir(parents=True)
    (d / "workflows" / "wf.json").write_text("{}", encoding="utf-8")
    conn = sqlite3.connect(d / "data.db")
    conn.execute("CREATE TABLE marker (v TEXT)")
    conn.execute("INSERT INTO marker VALUES ('hello')")
    conn.commit()
    conn.close()
    return d


class TestProperties:
    def test_missing_file_gives_empty(self, node_root):
        from ComfyTV import settings
        assert settings.load_properties() == {}

    def test_parses_pairs_and_skips_comments(self, node_root):
        from ComfyTV import settings
        _write_props(node_root, "\n".join([
            "# comment",
            "! also comment",
            "",
            "enable-db-backup = false",
            "db-backup-max-count=5",
            "db-backup-path=D:\\backups",
            "no-equals-line",
        ]))
        assert settings.load_properties() == {
            "enable-db-backup": "false",
            "db-backup-max-count": "5",
            "db-backup-path": "D:\\backups",
        }

    @pytest.mark.parametrize("raw,expected", [
        ("true", True), ("TRUE", True), ("1", True), ("yes", True),
        ("false", False), ("0", False), ("off", False),
        ("banana", True), (None, True),
    ])
    def test_coerce_boolean(self, raw, expected):
        from ComfyTV import settings
        assert settings.coerce("enable-db-backup", raw) is expected

    @pytest.mark.parametrize("raw,expected", [
        ("5", 5), (" 3 ", 3), ("0", 10), ("-2", 10), ("abc", 10), (None, 10),
    ])
    def test_coerce_int(self, raw, expected):
        from ComfyTV import settings
        assert settings.coerce("db-backup-max-count", raw) == expected

    def test_effective_precedence(self, node_root):
        from ComfyTV import settings
        _write_props(node_root, "db-backup-max-count=5\ndb-backup-path=X:\\p")
        cfg = settings.effective_settings({"db-backup-max-count": "3"})
        assert cfg["db-backup-max-count"] == 3
        assert cfg["db-backup-path"] == "X:\\p"
        assert cfg["enable-db-backup"] is True


class TestSqliteRawRead:
    def test_missing_file(self, tmp_path):
        from ComfyTV import settings
        assert settings.read_raw_settings_from_sqlite(str(tmp_path / "nope.db")) == {}

    def test_missing_table(self, tmp_path):
        from ComfyTV import settings
        path = tmp_path / "plain.db"
        sqlite3.connect(path).close()
        assert settings.read_raw_settings_from_sqlite(str(path)) == {}

    def test_reads_rows(self, tmp_path):
        from ComfyTV import settings
        path = tmp_path / "data.db"
        conn = sqlite3.connect(path)
        conn.execute("CREATE TABLE comfytv_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)")
        conn.execute("INSERT INTO comfytv_settings (key, value) VALUES ('enable-db-backup', 'false')")
        conn.commit()
        conn.close()
        assert settings.read_raw_settings_from_sqlite(str(path)) == {
            "enable-db-backup": "false",
        }


class TestSettingsStorage:
    def test_seed_uses_properties_then_defaults(self, reset_db, node_root):
        from ComfyTV import storage
        _write_props(node_root, "db-backup-max-count=5")
        storage.seed_settings()
        rows = {r["key"]: r for r in storage.list_settings()}
        assert rows["db-backup-max-count"]["value"] == 5
        assert rows["enable-db-backup"]["value"] is True
        assert rows["db-backup-path"]["value"] == ""

    def test_seed_does_not_overwrite_existing(self, reset_db, node_root):
        from ComfyTV import storage
        storage.seed_settings()
        storage.set_settings({"db-backup-max-count": 3})
        _write_props(node_root, "db-backup-max-count=7")
        storage.seed_settings()
        assert storage.get_setting("db-backup-max-count") == 3

    def test_set_and_get(self, reset_db, node_root):
        from ComfyTV import storage
        storage.seed_settings()
        storage.set_settings({
            "enable-db-backup": False,
            "db-backup-path": "E:\\snap",
        })
        assert storage.get_setting("enable-db-backup") is False
        assert storage.get_setting("db-backup-path") == "E:\\snap"

    def test_set_rejects_unknown_key(self, reset_db, node_root):
        from ComfyTV import storage
        with pytest.raises(KeyError):
            storage.set_settings({"nope": 1})
        with pytest.raises(KeyError):
            storage.get_setting("nope")

    def test_set_coerces_invalid_to_default(self, reset_db, node_root):
        from ComfyTV import storage
        storage.set_settings({"db-backup-max-count": "banana"})
        assert storage.get_setting("db-backup-max-count") == 10


class TestBackup:
    def test_snapshot_copies_data_dir(self, tmp_path, node_root, monkeypatch):
        from ComfyTV import backup
        data = _make_data_dir(tmp_path)
        monkeypatch.setattr(backup, "data_dir", lambda: str(data))
        root = tmp_path / "dest"
        cfg = {"db-backup-path": str(root), "db-backup-max-count": 10}
        result = backup.run_backup(cfg, now=datetime(2026, 8, 5, 9, 30, 0))
        assert result["ok"] is True
        snap = root / "20260805-093000" / "comfytv"
        assert (snap / "workflows" / "wf.json").is_file()
        conn = sqlite3.connect(snap / "data.db")
        assert conn.execute("SELECT v FROM marker").fetchone() == ("hello",)
        conn.close()

    def test_default_root_is_node_dir_db_backup(self, tmp_path, node_root, monkeypatch):
        from ComfyTV import backup
        data = _make_data_dir(tmp_path)
        monkeypatch.setattr(backup, "data_dir", lambda: str(data))
        cfg = {"db-backup-path": "", "db-backup-max-count": 10}
        result = backup.run_backup(cfg, now=datetime(2026, 8, 5, 9, 30, 0))
        assert result["ok"] is True
        assert (node_root / "db-backup" / "20260805-093000" / "comfytv" / "data.db").is_file()

    def test_same_second_gets_suffix(self, tmp_path, node_root, monkeypatch):
        from ComfyTV import backup
        data = _make_data_dir(tmp_path)
        monkeypatch.setattr(backup, "data_dir", lambda: str(data))
        root = tmp_path / "dest"
        cfg = {"db-backup-path": str(root), "db-backup-max-count": 10}
        now = datetime(2026, 8, 5, 9, 30, 0)
        assert backup.run_backup(cfg, now=now)["snapshot"] == "20260805-093000"
        assert backup.run_backup(cfg, now=now)["snapshot"] == "20260805-093000-1"

    def test_rotation_prunes_oldest(self, tmp_path, node_root, monkeypatch):
        from ComfyTV import backup
        data = _make_data_dir(tmp_path)
        monkeypatch.setattr(backup, "data_dir", lambda: str(data))
        root = tmp_path / "dest"
        cfg = {"db-backup-path": str(root), "db-backup-max-count": 2}
        for minute in (1, 2, 3):
            backup.run_backup(cfg, now=datetime(2026, 8, 5, 9, minute, 0))
        names = sorted(p.name for p in root.iterdir())
        assert names == ["20260805-090200", "20260805-090300"]

    def test_rotation_prunes_readonly_files(self, tmp_path, node_root, monkeypatch):
        from ComfyTV import backup
        data = _make_data_dir(tmp_path)
        locked = data / "workflows" / "locked.json"
        locked.write_text("{}", encoding="utf-8")
        locked.chmod(0o444)
        monkeypatch.setattr(backup, "data_dir", lambda: str(data))
        root = tmp_path / "dest"
        cfg = {"db-backup-path": str(root), "db-backup-max-count": 1}
        for minute in (1, 2):
            assert backup.run_backup(cfg, now=datetime(2026, 8, 5, 9, minute, 0))["ok"] is True
        assert sorted(p.name for p in root.iterdir()) == ["20260805-090200"]

    def test_missing_data_dir_fails_cleanly(self, tmp_path, node_root, monkeypatch):
        from ComfyTV import backup
        monkeypatch.setattr(backup, "data_dir", lambda: str(tmp_path / "absent"))
        result = backup.run_backup({"db-backup-path": "", "db-backup-max-count": 10})
        assert result["ok"] is False

    def test_startup_backup_respects_disable(self, tmp_path, node_root, monkeypatch):
        from ComfyTV import backup
        data = _make_data_dir(tmp_path)
        monkeypatch.setattr(backup, "data_dir", lambda: str(data))
        _write_props(node_root, "enable-db-backup=false")
        backup.run_startup_backup()
        assert not (node_root / "db-backup").exists()

    def test_startup_backup_runs_when_enabled(self, tmp_path, node_root, monkeypatch):
        from ComfyTV import backup
        data = _make_data_dir(tmp_path)
        monkeypatch.setattr(backup, "data_dir", lambda: str(data))
        backup.run_startup_backup()
        snaps = list((node_root / "db-backup").iterdir())
        assert len(snaps) == 1
        assert (snaps[0] / "comfytv" / "data.db").is_file()

    def test_startup_backup_skips_before_first_db(self, tmp_path, node_root, monkeypatch):
        from ComfyTV import backup
        empty = tmp_path / "data"
        empty.mkdir()
        monkeypatch.setattr(backup, "data_dir", lambda: str(empty))
        backup.run_startup_backup()
        assert not (node_root / "db-backup").exists()


@pytest.fixture()
async def client(reset_db, node_root):
    from ComfyTV import api  # noqa: F401
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


class TestSettingsApi:
    async def test_list_shape(self, client):
        resp = await client.get("/comfytv/settings")
        assert resp.status == 200
        rows = (await resp.json())["settings"]
        assert {r["key"] for r in rows} == {
            "enable-v2",
            "enable-db-backup", "db-backup-max-count", "db-backup-path",
            "enable-mcp", "enable-bot",
            "bot-model-claude-code", "bot-model-codex", "bot-model-qwen-code",
            "bot-model-local-llm", "bot-model-comfyui-llm",
            "bot-comfyui-llm-thinking", "bot-local-llm-url",
            "bot-enable-comfy-mcp", "bot-comfy-mcp-command",
            "enable-skills", "skills-disabled",
            "enable-eagle", "eagle-api-url", "eagle-library-path",
            "eagle-send-folder", "eagle-auto-send",
            "blender-bridge-url",
        }
        for r in rows:
            assert set(r) == {"key", "type", "value", "default"}

    async def test_put_updates(self, client):
        resp = await client.put("/comfytv/settings", json={
            "values": {"enable-db-backup": False, "db-backup-max-count": 4},
        })
        assert resp.status == 200
        rows = {r["key"]: r["value"] for r in (await resp.json())["settings"]}
        assert rows["enable-db-backup"] is False
        assert rows["db-backup-max-count"] == 4

    async def test_put_rejects_unknown(self, client):
        resp = await client.put("/comfytv/settings", json={"values": {"nope": 1}})
        assert resp.status == 400

    async def test_put_rejects_empty(self, client):
        resp = await client.put("/comfytv/settings", json={"values": {}})
        assert resp.status == 400

    async def test_backup_endpoint(self, client, node_root):
        resp = await client.post("/comfytv/settings/backup")
        assert resp.status == 200
        body = await resp.json()
        assert body["ok"] is True
        assert Path(body["path"]).joinpath("data.db").is_file()
