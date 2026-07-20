from __future__ import annotations

from pathlib import Path

import pytest
from aiohttp import FormData, web
from aiohttp.test_utils import TestClient, TestServer


@pytest.fixture()
def input_dir(tmp_path, monkeypatch):
    import folder_paths
    d = tmp_path / "input"
    d.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(folder_paths, "get_input_directory", lambda: str(d))
    return d


@pytest.fixture()
async def client(reset_db, input_dir):
    from ComfyTV import api  # noqa: F401 — registers routes on the stub PromptServer
    import server
    app = web.Application()
    app.router.add_routes(server.PromptServer.instance.routes)
    test_server = TestServer(app)
    test_client = TestClient(test_server)
    await test_client.start_server()
    yield test_client
    await test_client.close()


def _form(kind: str, filename: str, payload: bytes = b"data") -> FormData:
    fd = FormData()
    fd.add_field("kind", kind)
    fd.add_field("file", payload, filename=filename)
    return fd


async def _upload(client, kind="lut", filename="test.cube", payload=b"LUT_3D_SIZE 2\n"):
    return await client.post("/comfytv/resources", data=_form(kind, filename, payload))


async def _rows(client, kind: str | None = None) -> list[dict]:
    q = f"?kind={kind}" if kind else ""
    resp = await client.get(f"/comfytv/resources{q}")
    assert resp.status == 200
    return (await resp.json())["resources"]


class TestResourceCrud:
    async def test_upload_list_rename_delete(self, client, input_dir):
        resp = await _upload(client)
        assert resp.status == 200
        row = (await resp.json())["resource"]
        assert row["kind"] == "lut"
        assert row["name"] == "test"
        assert row["filename"] == "test.cube"
        assert row["subfolder"] == "comfytv/luts"
        assert row["size"] == len(b"LUT_3D_SIZE 2\n")
        assert len(row["sha256"]) == 64
        assert row["created_at"]
        assert row["missing"] is False
        assert row["url"] == "/view?filename=test.cube&subfolder=comfytv%2Fluts&type=input"
        assert (input_dir / "comfytv/luts" / "test.cube").is_file()

        rows = await _rows(client, "lut")
        assert [r["id"] for r in rows] == [row["id"]]

        resp = await client.patch(f"/comfytv/resources/{row['id']}",
                                  json={"name": "My LUT"})
        assert resp.status == 200
        renamed = (await resp.json())["resource"]
        assert renamed["name"] == "My LUT"
        assert renamed["filename"] == "test.cube"

        resp = await client.delete(f"/comfytv/resources/{row['id']}")
        assert resp.status == 200
        resp = await client.delete(f"/comfytv/resources/{row['id']}")
        assert resp.status == 404

    async def test_delete_keeps_file_on_disk(self, client, input_dir):
        row = (await (await _upload(client)).json())["resource"]
        path = input_dir / "comfytv/luts" / "test.cube"
        assert path.is_file()
        resp = await client.delete(f"/comfytv/resources/{row['id']}")
        assert resp.status == 200
        assert path.is_file()

    async def test_font_upload(self, client, input_dir):
        resp = await _upload(client, kind="font", filename="CoolFont.ttf", payload=b"\x00\x01")
        assert resp.status == 200
        row = (await resp.json())["resource"]
        assert row["kind"] == "font"
        assert row["name"] == "CoolFont"
        assert row["subfolder"] == "comfytv/fonts"
        assert (input_dir / "comfytv/fonts" / "CoolFont.ttf").is_file()

    async def test_extension_rejected_per_kind(self, client):
        resp = await _upload(client, kind="lut", filename="evil.exe")
        assert resp.status == 400
        resp = await _upload(client, kind="font", filename="lut.cube")
        assert resp.status == 400
        resp = await _upload(client, kind="lut", filename="font.ttf")
        assert resp.status == 400

    async def test_unknown_kind_rejected(self, client):
        resp = await _upload(client, kind="model", filename="x.cube")
        assert resp.status == 400
        resp = await client.get("/comfytv/resources?kind=model")
        assert resp.status == 400

    async def test_missing_file_field_rejected(self, client):
        fd = FormData()
        fd.add_field("kind", "lut")
        resp = await client.post("/comfytv/resources", data=fd)
        assert resp.status == 400

    async def test_upload_collision_gets_suffix(self, client, input_dir):
        first = (await (await _upload(client, payload=b"one")).json())["resource"]
        second = (await (await _upload(client, payload=b"two")).json())["resource"]
        third = (await (await _upload(client, payload=b"three")).json())["resource"]
        assert first["filename"] == "test.cube"
        assert second["filename"] == "test-1.cube"
        assert third["filename"] == "test-2.cube"
        d = input_dir / "comfytv/luts"
        assert (d / "test.cube").read_bytes() == b"one"
        assert (d / "test-1.cube").read_bytes() == b"two"
        assert (d / "test-2.cube").read_bytes() == b"three"
        assert len(await _rows(client, "lut")) == 3

    async def test_rename_requires_name(self, client):
        row = (await (await _upload(client)).json())["resource"]
        resp = await client.patch(f"/comfytv/resources/{row['id']}", json={"name": "  "})
        assert resp.status == 400
        resp = await client.patch("/comfytv/resources/9999", json={"name": "x"})
        assert resp.status == 404
        resp = await client.patch("/comfytv/resources/abc", json={"name": "x"})
        assert resp.status == 404


class TestAdoptionScan:
    async def test_dropped_file_is_adopted(self, client, input_dir):
        d = input_dir / "comfytv/luts"
        d.mkdir(parents=True, exist_ok=True)
        (d / "dropped.cube").write_bytes(b"LUT_3D_SIZE 2\n")
        (d / "notes.txt").write_text("ignored")
        rows = await _rows(client, "lut")
        assert [r["filename"] for r in rows] == ["dropped.cube"]
        row = rows[0]
        assert row["name"] == "dropped"
        assert row["size"] == len(b"LUT_3D_SIZE 2\n")
        assert len(row["sha256"]) == 64
        assert row["missing"] is False

    async def test_adoption_is_idempotent(self, client, input_dir):
        d = input_dir / "comfytv/fonts"
        d.mkdir(parents=True, exist_ok=True)
        (d / "cool.otf").write_bytes(b"\x00")
        first = await _rows(client, "font")
        second = await _rows(client, "font")
        assert [r["id"] for r in first] == [r["id"] for r in second]

    async def test_unfiltered_list_scans_all_kinds(self, client, input_dir):
        (input_dir / "comfytv/luts").mkdir(parents=True, exist_ok=True)
        (input_dir / "comfytv/fonts").mkdir(parents=True, exist_ok=True)
        (input_dir / "comfytv/luts" / "a.cube").write_bytes(b"x")
        (input_dir / "comfytv/fonts" / "b.ttf").write_bytes(b"y")
        rows = await _rows(client)
        assert {(r["kind"], r["filename"]) for r in rows} == {
            ("lut", "a.cube"), ("font", "b.ttf"),
        }

    async def test_deleted_on_disk_flags_missing_but_keeps_row(self, client, input_dir):
        row = (await (await _upload(client)).json())["resource"]
        (input_dir / "comfytv/luts" / "test.cube").unlink()
        rows = await _rows(client, "lut")
        assert [r["id"] for r in rows] == [row["id"]]
        assert rows[0]["missing"] is True
        rows = await _rows(client, "lut")
        assert [r["id"] for r in rows] == [row["id"]]


class TestLutCompat:
    async def test_list_shape_and_adoption(self, client, input_dir):
        d = input_dir / "comfytv/luts"
        d.mkdir(parents=True, exist_ok=True)
        (d / "b.cube").write_bytes(b"x")
        (d / "a.cube").write_bytes(b"y")
        resp = await client.get("/comfytv/luts")
        assert resp.status == 200
        assert (await resp.json()) == {"luts": ["a.cube", "b.cube"]}
        rows = await _rows(client, "lut")
        assert {r["filename"] for r in rows} == {"a.cube", "b.cube"}

    async def test_list_omits_missing_files(self, client, input_dir):
        await _upload(client)
        (input_dir / "comfytv/luts" / "test.cube").unlink()
        resp = await client.get("/comfytv/luts")
        assert (await resp.json()) == {"luts": []}

    async def test_upload_shape_and_overwrite(self, client, input_dir):
        fd = FormData()
        fd.add_field("file", b"one", filename="same.cube")
        resp = await client.post("/comfytv/luts", data=fd)
        assert resp.status == 200
        assert (await resp.json()) == {"ok": True, "name": "same.cube"}

        fd = FormData()
        fd.add_field("file", b"two", filename="same.cube")
        resp = await client.post("/comfytv/luts", data=fd)
        assert (await resp.json()) == {"ok": True, "name": "same.cube"}
        assert (input_dir / "comfytv/luts" / "same.cube").read_bytes() == b"two"
        rows = await _rows(client, "lut")
        assert [r["filename"] for r in rows] == ["same.cube"]

    async def test_upload_bad_extension(self, client):
        fd = FormData()
        fd.add_field("file", b"zzz", filename="evil.exe")
        resp = await client.post("/comfytv/luts", data=fd)
        assert resp.status == 400

    async def test_upload_registers_resource_row(self, client):
        fd = FormData()
        fd.add_field("file", b"x", filename="shared.cube")
        await client.post("/comfytv/luts", data=fd)
        rows = await _rows(client, "lut")
        assert [r["filename"] for r in rows] == ["shared.cube"]
        assert rows[0]["name"] == "shared"
