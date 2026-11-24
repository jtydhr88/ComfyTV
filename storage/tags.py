from typing import Optional

from .. import db
from ..db import CATEGORY_LINKS, Entry, Preset, Resource, StageGroup
from .assets import _existing_category_ids, _normalize_category_ids

TAG_TARGETS: dict[str, type] = {
    "entry": Entry,
    "preset": Preset,
    "stage_group": StageGroup,
    "resource": Resource,
}


def with_categories(s, kind: str, rows: list[dict]) -> list[dict]:
    links = CATEGORY_LINKS[kind]
    ids = [r["id"] for r in rows]
    found: dict[int, list[int]] = {}
    if ids:
        for tid, cid in s.execute(
            links.select().where(links.c.target_id.in_(ids)).order_by(links.c.category_id)
        ).all():
            found.setdefault(tid, []).append(cid)
    for r in rows:
        r["category_ids"] = found.get(r["id"], [])
    return rows


def drop_category_links(s, kind: str, target_ids) -> None:
    links = CATEGORY_LINKS[kind]
    s.execute(links.delete().where(links.c.target_id.in_(target_ids)))


def set_target_categories(kind: str, target_id: int, category_ids) -> Optional[list[int]]:
    model = TAG_TARGETS.get(kind)
    if model is None:
        return None
    links = CATEGORY_LINKS[kind]
    ids = _normalize_category_ids(category_ids)
    with db.get_session() as s:
        if s.get(model, target_id) is None or _existing_category_ids(s, ids) is None:
            return None
        drop_category_links(s, kind, [target_id])
        if ids:
            s.execute(links.insert(), [{"target_id": target_id, "category_id": cid} for cid in ids])
        s.commit()
        return sorted(ids)
