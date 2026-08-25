import logging
import os
import sqlite3
from typing import Any, Optional

logger = logging.getLogger(__name__)

CUSTOM_NODE_DIR = os.path.dirname(os.path.realpath(__file__))
PROPERTIES_FILENAME = "comfytv.properties"

SETTINGS_SPEC: dict[str, dict[str, Any]] = {
    "enable-v2": {"type": "boolean", "default": False},
    "enable-db-backup": {"type": "boolean", "default": True},
    "db-backup-max-count": {"type": "int", "default": 10, "min": 1},
    "db-backup-path": {"type": "string", "default": ""},
    "enable-mcp": {"type": "boolean", "default": False},
    "enable-bot": {"type": "boolean", "default": False},
    "bot-model-claude-code": {"type": "string", "default": ""},
    "bot-model-codex": {"type": "string", "default": ""},
    "bot-model-qwen-code": {"type": "string", "default": ""},
    "bot-model-local-llm": {"type": "string", "default": ""},
    "bot-model-comfyui-llm": {"type": "string", "default": ""},
    "bot-comfyui-llm-thinking": {"type": "boolean", "default": True},
    "bot-local-llm-url": {"type": "string", "default": ""},
    "bot-enable-comfy-mcp": {"type": "boolean", "default": False},
    "bot-comfy-mcp-command": {"type": "string", "default": ""},
    "enable-skills": {"type": "boolean", "default": True},
    "skills-disabled": {"type": "string", "default": "[]"},
}


def properties_path() -> str:
    return os.path.join(CUSTOM_NODE_DIR, PROPERTIES_FILENAME)


def load_properties(path: Optional[str] = None) -> dict[str, str]:
    path = path or properties_path()
    props: dict[str, str] = {}
    if not os.path.isfile(path):
        return props
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("!"):
                    continue
                if "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                if key:
                    props[key] = value.strip()
    except OSError as e:
        logger.warning("[ComfyTV/settings] failed to read %s: %s", path, e)
    return props


def coerce(key: str, raw: Any) -> Any:
    spec = SETTINGS_SPEC[key]
    kind = spec["type"]
    default = spec["default"]
    if raw is None:
        return default
    try:
        if kind == "boolean":
            if isinstance(raw, bool):
                return raw
            text = str(raw).strip().lower()
            if text in ("true", "1", "yes", "on"):
                return True
            if text in ("false", "0", "no", "off"):
                return False
            return default
        if kind == "int":
            value = int(str(raw).strip())
            lo = spec.get("min")
            if lo is not None and value < lo:
                return default
            hi = spec.get("max")
            if hi is not None and value > hi:
                return default
            return value
        return str(raw)
    except (ValueError, TypeError):
        return default


def to_stored(key: str, value: Any) -> str:
    spec = SETTINGS_SPEC[key]
    if spec["type"] == "boolean":
        return "true" if value else "false"
    return str(value)


def read_raw_settings_from_sqlite(db_path: str) -> dict[str, str]:
    if not os.path.isfile(db_path):
        return {}
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        try:
            rows = conn.execute(
                "SELECT key, value FROM comfytv_settings"
            ).fetchall()
            return {str(k): str(v) for k, v in rows if v is not None}
        finally:
            conn.close()
    except sqlite3.Error:
        return {}


def effective_settings(db_raw: Optional[dict[str, str]] = None) -> dict[str, Any]:
    props = load_properties()
    db_raw = db_raw or {}
    out: dict[str, Any] = {}
    for key in SETTINGS_SPEC:
        if key in db_raw:
            out[key] = coerce(key, db_raw[key])
        elif key in props:
            out[key] = coerce(key, props[key])
        else:
            out[key] = SETTINGS_SPEC[key]["default"]
    return out
