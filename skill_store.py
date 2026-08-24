import json
import logging
import re
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

BUILTIN_SKILLS_DIR = Path(__file__).resolve().parent / "skills"
SKILL_FILE = "SKILL.md"
OPENAI_META = Path("agents") / "openai.yaml"
DISABLED_SETTING = "skills-disabled"
ENABLE_SETTING = "enable-skills"

NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
NAME_MAX = 64
DESCRIPTION_MAX = 1024
FILE_BYTES_MAX = 512 * 1024


def user_skills_dir() -> Path:
    import folder_paths
    return Path(folder_paths.get_user_directory()) / "comfytv" / "skills"


def skills_enabled() -> bool:
    from . import storage
    try:
        return bool(storage.get_setting(ENABLE_SETTING))
    except Exception:
        logger.exception("[ComfyTV/skills] enable-skills lookup failed")
        return False


def disabled_names() -> set[str]:
    from . import storage
    try:
        raw = storage.get_setting(DISABLED_SETTING)
        data = json.loads(str(raw) or "[]")
    except Exception:
        return set()
    if not isinstance(data, list):
        return set()
    return {str(n) for n in data}


def set_skill_enabled(name: str, enabled: bool) -> None:
    from . import storage
    names = disabled_names()
    if enabled:
        names.discard(name)
    else:
        names.add(name)
    storage.set_settings({DISABLED_SETTING: json.dumps(sorted(names))})


def parse_frontmatter(text: str) -> tuple[Optional[dict], str]:
    if not text.startswith("---"):
        return None, text
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return None, text
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            import yaml
            try:
                meta = yaml.safe_load("".join(lines[1:i]))
            except yaml.YAMLError:
                return None, text
            body = "".join(lines[i + 1:])
            return (meta if isinstance(meta, dict) else None), body
    return None, text


def _display_meta(skill_dir: Path) -> dict:
    path = skill_dir / OPENAI_META
    if not path.is_file():
        return {}
    import yaml
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, yaml.YAMLError):
        return {}
    interface = data.get("interface") if isinstance(data, dict) else None
    if not isinstance(interface, dict):
        return {}
    out = {}
    if interface.get("display_name"):
        out["display_name"] = str(interface["display_name"])
    return out


def scan_dir(skill_dir: Path, source: str) -> Optional[dict]:
    path = skill_dir / SKILL_FILE
    if not path.is_file():
        return None
    entry: dict[str, Any] = {
        "name": skill_dir.name,
        "description": "",
        "display_name": "",
        "source": source,
        "dir": str(skill_dir),
        "valid": False,
        "error": "",
    }
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        entry["error"] = f"unreadable SKILL.md: {e}"
        return entry
    meta, _ = parse_frontmatter(raw)
    if meta is None:
        entry["error"] = "SKILL.md has no valid YAML frontmatter"
        return entry
    name = str(meta.get("name") or skill_dir.name).strip()
    description = str(meta.get("description") or "").strip()
    if not NAME_RE.match(name) or len(name) > NAME_MAX:
        entry["error"] = f"invalid skill name {name!r}"
        return entry
    if not description:
        entry["name"] = name
        entry["error"] = "frontmatter is missing a description"
        return entry
    entry.update({
        "name": name,
        "description": description[:DESCRIPTION_MAX],
        "valid": True,
    })
    entry.update(_display_meta(skill_dir))
    return entry


def _scan_root(root: Path, source: str) -> list[dict]:
    if not root.is_dir():
        return []
    out = []
    try:
        children = sorted(p for p in root.iterdir()
                          if p.is_dir() and not p.name.startswith("."))
    except OSError:
        return []
    for child in children:
        entry = scan_dir(child, source)
        if entry is not None:
            out.append(entry)
    return out


def scan() -> list[dict]:
    disabled = disabled_names()
    merged: dict[str, dict] = {}
    for entry in _scan_root(BUILTIN_SKILLS_DIR, "builtin"):
        merged[entry["name"]] = entry
    for entry in _scan_root(user_skills_dir(), "user"):
        if entry["name"] in merged:
            entry["overrides_builtin"] = True
        merged[entry["name"]] = entry
    out = list(merged.values())
    for entry in out:
        entry["enabled"] = entry["valid"] and entry["name"] not in disabled
    return out


def enabled_skills() -> list[dict]:
    if not skills_enabled():
        return []
    return [s for s in scan() if s["enabled"]]


def find(name: str) -> Optional[dict]:
    for entry in scan():
        if entry["name"] == name:
            return entry
    return None


def find_enabled(name: str) -> Optional[dict]:
    for entry in enabled_skills():
        if entry["name"] == name:
            return entry
    return None


def read_skill(name: str) -> str:
    entry = find(name)
    if entry is None:
        raise ValueError(f"unknown skill {name!r}")
    return (Path(entry["dir"]) / SKILL_FILE).read_text(
        encoding="utf-8", errors="replace")


def read_skill_file(name: str, relpath: str) -> str:
    entry = find(name)
    if entry is None:
        raise ValueError(f"unknown skill {name!r}")
    rel = Path(str(relpath).replace("\\", "/"))
    if rel.is_absolute() or ".." in rel.parts or not rel.parts:
        raise ValueError(f"invalid path {relpath!r}")
    root = Path(entry["dir"]).resolve()
    target = (root / rel).resolve()
    if root not in target.parents:
        raise ValueError(f"invalid path {relpath!r}")
    if not target.is_file():
        raise ValueError(f"no file {relpath!r} in skill {name!r}")
    if target.stat().st_size > FILE_BYTES_MAX:
        raise ValueError(f"{relpath!r} is too large to read (>512KB)")
    return target.read_text(encoding="utf-8", errors="replace")
