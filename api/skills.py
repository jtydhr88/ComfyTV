import io
import logging
import os
import shutil
import stat
import zipfile
from pathlib import Path, PurePosixPath

from aiohttp import web

from .. import skill_store
from ._common import routes

_log = logging.getLogger(__name__)

MAX_ZIP_BYTES = 16 * 1024 * 1024
MAX_UNPACKED_BYTES = 64 * 1024 * 1024


def _payload(entry: dict) -> dict:
    return {k: v for k, v in entry.items() if k != "dir"}


@routes.get("/comfytv/skills")
async def list_skills(_request: web.Request) -> web.Response:
    return web.json_response({
        "enabled": skill_store.skills_enabled(),
        "skills": [_payload(e) for e in skill_store.scan()],
    })


@routes.put("/comfytv/skills/{name}")
async def toggle_skill(request: web.Request) -> web.Response:
    name = request.match_info["name"]
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({"error": f"invalid json: {e}"}, status=400)
    enabled = body.get("enabled")
    if not isinstance(enabled, bool):
        return web.json_response({"error": "enabled must be a boolean"}, status=400)
    if skill_store.find(name) is None:
        return web.json_response({"error": f"unknown skill {name!r}"}, status=404)
    skill_store.set_skill_enabled(name, enabled)
    return web.json_response({"ok": True})


def _zip_member_relpath(member: str) -> PurePosixPath | None:
    path = PurePosixPath(member.replace("\\", "/"))
    if path.is_absolute() or ".." in path.parts or not path.parts:
        return None
    if any(p.endswith(":") for p in path.parts):
        return None
    return path


def _skill_root_prefix(names: list[str]) -> str | None:
    roots = set()
    for member in names:
        path = _zip_member_relpath(member)
        if path is None:
            return None
        if path.name != skill_store.SKILL_FILE:
            continue
        if len(path.parts) == 1:
            roots.add("")
        elif len(path.parts) == 2:
            roots.add(path.parts[0] + "/")
    if len(roots) != 1:
        return None
    return roots.pop()


def _extract_skill(zf: zipfile.ZipFile, prefix: str, dest: Path) -> None:
    total = 0
    for info in zf.infolist():
        if info.is_dir():
            continue
        member = info.filename
        path = _zip_member_relpath(member)
        if path is None:
            raise ValueError(f"unsafe zip entry {member!r}")
        if prefix and not member.replace("\\", "/").startswith(prefix):
            continue
        rel = PurePosixPath(member.replace("\\", "/")[len(prefix):])
        if not rel.parts:
            continue
        total += info.file_size
        if total > MAX_UNPACKED_BYTES:
            raise ValueError("skill unpacks to more than 64MB")
        target = dest / Path(*rel.parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(info) as src, open(target, "wb") as out:
            shutil.copyfileobj(src, out)


def _rmtree(path: Path) -> None:
    def _onexc(fn, p, _exc):
        os.chmod(p, stat.S_IWRITE)
        fn(p)
    shutil.rmtree(path, onexc=_onexc)


@routes.post("/comfytv/skills/import")
async def import_skill(request: web.Request) -> web.Response:
    try:
        reader = await request.multipart()
    except (AssertionError, ValueError) as e:
        return web.json_response(
            {"error": f"expected multipart body: {e}"}, status=400)
    field = None
    while True:
        part = await reader.next()
        if part is None:
            break
        if part.name == "file":
            field = part
            break
    if field is None:
        return web.json_response(
            {"error": "expected multipart field 'file'"}, status=400)
    buf = io.BytesIO()
    size = 0
    while True:
        chunk = await field.read_chunk()
        if not chunk:
            break
        size += len(chunk)
        if size > MAX_ZIP_BYTES:
            return web.json_response(
                {"error": "zip too large (>16MB)"}, status=400)
        buf.write(chunk)
    try:
        zf = zipfile.ZipFile(buf)
    except zipfile.BadZipFile:
        return web.json_response({"error": "not a zip file"}, status=400)
    with zf:
        prefix = _skill_root_prefix(zf.namelist())
        if prefix is None:
            return web.json_response(
                {"error": "zip must contain exactly one SKILL.md at its root "
                          "or inside one top-level folder"}, status=400)
        user_dir = skill_store.user_skills_dir()
        user_dir.mkdir(parents=True, exist_ok=True)
        staging = user_dir / ".import-staging"
        if staging.exists():
            _rmtree(staging)
        try:
            _extract_skill(zf, prefix, staging)
        except ValueError as e:
            _rmtree(staging)
            return web.json_response({"error": str(e)}, status=400)
    entry = skill_store.scan_dir(staging, "user")
    if entry is None or not entry["valid"]:
        detail = (entry or {}).get("error") or "missing SKILL.md"
        _rmtree(staging)
        return web.json_response(
            {"error": f"invalid skill: {detail}"}, status=400)
    dest = user_dir / entry["name"]
    if dest.exists():
        _rmtree(staging)
        return web.json_response(
            {"error": f"skill {entry['name']!r} already exists — delete it "
                      "first to re-import"}, status=409)
    staging.rename(dest)
    fresh = skill_store.find(entry["name"])
    return web.json_response({"ok": True, "skill": _payload(fresh or entry)})


@routes.delete("/comfytv/skills/{name}")
async def delete_skill(request: web.Request) -> web.Response:
    name = request.match_info["name"]
    entry = skill_store.find(name)
    if entry is None:
        return web.json_response({"error": f"unknown skill {name!r}"}, status=404)
    if entry["source"] != "user":
        return web.json_response(
            {"error": "built-in skills cannot be deleted — disable instead"},
            status=400)
    try:
        _rmtree(Path(entry["dir"]))
    except OSError as e:
        _log.exception("[ComfyTV/skills] delete failed for %s", name)
        return web.json_response({"error": f"delete failed: {e}"}, status=500)
    skill_store.set_skill_enabled(name, True)
    return web.json_response({"ok": True})
