from __future__ import annotations

import io
import zipfile

import pytest
from aiohttp import FormData, web
from aiohttp.test_utils import TestClient, TestServer

from ComfyTV import skill_store

from test_skill_store import make_skill


@pytest.fixture()
def skill_dirs(tmp_path, monkeypatch, reset_db):
    builtin = tmp_path / "builtin-skills"
    user = tmp_path / "user-skills"
    builtin.mkdir()
    user.mkdir()
    monkeypatch.setattr(skill_store, "BUILTIN_SKILLS_DIR", builtin)
    monkeypatch.setattr(skill_store, "user_skills_dir", lambda: user)
    return builtin, user


@pytest.fixture()
async def client(skill_dirs):
    from ComfyTV import api  # noqa: F401 — registers routes on the stub PromptServer
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


def _zip_bytes(entries: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return buf.getvalue()


def _zip_form(payload: bytes) -> FormData:
    fd = FormData()
    fd.add_field("file", payload, filename="skill.zip")
    return fd


SKILL_MD = "---\nname: packed\ndescription: A packed skill\n---\n\nBody.\n"


async def _rows(client) -> list[dict]:
    resp = await client.get("/comfytv/skills")
    assert resp.status == 200
    return (await resp.json())["skills"]


class TestListToggle:
    async def test_list_and_toggle(self, client, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha")
        rows = await _rows(client)
        assert [r["name"] for r in rows] == ["alpha"]
        assert rows[0]["enabled"] is True
        assert "dir" not in rows[0]

        resp = await client.put("/comfytv/skills/alpha",
                                json={"enabled": False})
        assert resp.status == 200
        assert (await _rows(client))[0]["enabled"] is False

        resp = await client.put("/comfytv/skills/ghost",
                                json={"enabled": False})
        assert resp.status == 404
        resp = await client.put("/comfytv/skills/alpha",
                                json={"enabled": "nope"})
        assert resp.status == 400


class TestImport:
    async def test_import_with_folder_prefix(self, client, skill_dirs):
        _, user = skill_dirs
        payload = _zip_bytes({
            "packed/SKILL.md": SKILL_MD,
            "packed/references/deep.md": "deep",
        })
        resp = await client.post("/comfytv/skills/import",
                                 data=_zip_form(payload))
        assert resp.status == 200
        skill = (await resp.json())["skill"]
        assert skill["name"] == "packed"
        assert skill["source"] == "user"
        assert (user / "packed" / "SKILL.md").is_file()
        assert (user / "packed" / "references" / "deep.md").is_file()

    async def test_import_root_level_skill(self, client, skill_dirs):
        _, user = skill_dirs
        payload = _zip_bytes({"SKILL.md": SKILL_MD, "extra.md": "x"})
        resp = await client.post("/comfytv/skills/import",
                                 data=_zip_form(payload))
        assert resp.status == 200
        assert (user / "packed" / "extra.md").is_file()

    async def test_import_conflict_409(self, client, skill_dirs):
        payload = _zip_bytes({"packed/SKILL.md": SKILL_MD})
        assert (await client.post("/comfytv/skills/import",
                                  data=_zip_form(payload))).status == 200
        resp = await client.post("/comfytv/skills/import",
                                 data=_zip_form(payload))
        assert resp.status == 409

    async def test_import_no_skill_md(self, client, skill_dirs):
        payload = _zip_bytes({"whatever/readme.md": "x"})
        resp = await client.post("/comfytv/skills/import",
                                 data=_zip_form(payload))
        assert resp.status == 400

    async def test_import_two_skill_mds(self, client, skill_dirs):
        payload = _zip_bytes({"a/SKILL.md": SKILL_MD, "b/SKILL.md": SKILL_MD})
        resp = await client.post("/comfytv/skills/import",
                                 data=_zip_form(payload))
        assert resp.status == 400

    async def test_import_zip_slip_rejected(self, client, skill_dirs, tmp_path):
        payload = _zip_bytes({
            "packed/SKILL.md": SKILL_MD,
            "../evil.txt": "pwned",
        })
        resp = await client.post("/comfytv/skills/import",
                                 data=_zip_form(payload))
        assert resp.status == 400
        assert not (tmp_path / "evil.txt").exists()

    async def test_import_invalid_frontmatter(self, client, skill_dirs):
        payload = _zip_bytes({"packed/SKILL.md": "no frontmatter\n"})
        resp = await client.post("/comfytv/skills/import",
                                 data=_zip_form(payload))
        assert resp.status == 400

    async def test_import_not_a_zip(self, client, skill_dirs):
        resp = await client.post("/comfytv/skills/import",
                                 data=_zip_form(b"not a zip"))
        assert resp.status == 400


class TestDelete:
    async def test_delete_user_skill(self, client, skill_dirs):
        _, user = skill_dirs
        make_skill(user, "mine")
        await client.put("/comfytv/skills/mine", json={"enabled": False})
        resp = await client.delete("/comfytv/skills/mine")
        assert resp.status == 200
        assert not (user / "mine").exists()
        assert await _rows(client) == []
        assert "mine" not in skill_store.disabled_names()

    async def test_delete_builtin_rejected(self, client, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "core")
        resp = await client.delete("/comfytv/skills/core")
        assert resp.status == 400
        assert (builtin / "core").exists()

    async def test_delete_unknown_404(self, client, skill_dirs):
        assert (await client.delete("/comfytv/skills/ghost")).status == 404

