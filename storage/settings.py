import logging
from typing import Any

from sqlalchemy import select

from .. import db, settings
from ..db import Setting

logger = logging.getLogger(__name__)

__all__ = ["seed_settings", "list_settings", "get_setting", "set_settings"]


def _raw_from_db(s) -> dict[str, str]:
    rows = s.execute(select(Setting)).scalars().all()
    return {r.key: r.value for r in rows}


def seed_settings() -> None:
    with db.get_session() as s:
        existing = set(_raw_from_db(s))
        props = settings.load_properties()
        added = []
        for key, spec in settings.SETTINGS_SPEC.items():
            if key in existing:
                continue
            value = settings.coerce(key, props.get(key)) if key in props else spec["default"]
            s.add(Setting(key=key, value=settings.to_stored(key, value)))
            added.append(key)
        if added:
            s.commit()
            logger.info("[ComfyTV/settings] seeded %s", ", ".join(added))


def list_settings() -> list[dict[str, Any]]:
    with db.get_session() as s:
        raw = _raw_from_db(s)
    effective = settings.effective_settings(raw)
    return [
        {
            "key": key,
            "type": spec["type"],
            "value": effective[key],
            "default": spec["default"],
        }
        for key, spec in settings.SETTINGS_SPEC.items()
    ]


def get_setting(key: str) -> Any:
    if key not in settings.SETTINGS_SPEC:
        raise KeyError(key)
    with db.get_session() as s:
        row = s.get(Setting, key)
        raw = {key: row.value} if row else {}
    return settings.effective_settings(raw)[key]


def set_settings(values: dict[str, Any]) -> list[dict[str, Any]]:
    unknown = [k for k in values if k not in settings.SETTINGS_SPEC]
    if unknown:
        raise KeyError(", ".join(unknown))
    with db.get_session() as s:
        for key, value in values.items():
            coerced = settings.coerce(key, value)
            row = s.get(Setting, key)
            if row is None:
                s.add(Setting(key=key, value=settings.to_stored(key, coerced)))
            else:
                row.value = settings.to_stored(key, coerced)
        s.commit()
    return list_settings()
