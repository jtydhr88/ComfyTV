import json
from typing import Optional

from sqlalchemy import select

from .. import db
from ..db import StageGroup


def _group_to_dict(g: StageGroup) -> dict:
    try:
        data = json.loads(g.data) if g.data else {}
    except ValueError:
        data = {}
    return {
        "id": g.id,
        "name": g.name,
        "data": data if isinstance(data, dict) else {},
        "created_at": g.created_at.isoformat() if g.created_at else None,
    }


def list_stage_groups() -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(select(StageGroup).order_by(StageGroup.name, StageGroup.id)).scalars().all()
        return [_group_to_dict(g) for g in rows]


def save_stage_group(name: str, data: dict) -> dict:
    with db.get_session() as s:
        row = s.execute(select(StageGroup).where(StageGroup.name == name).limit(1)).scalar_one_or_none()
        if row is None:
            row = StageGroup(name=name, data=json.dumps(data))
            s.add(row)
        else:
            row.data = json.dumps(data)
        s.commit()
        return _group_to_dict(row)


def rename_stage_group(group_id: int, name: str) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(StageGroup, group_id)
        if row is None:
            return None
        clash = s.execute(
            select(StageGroup.id).where(StageGroup.name == name, StageGroup.id != group_id).limit(1)
        ).scalar_one_or_none()
        if clash is not None:
            return None
        row.name = name
        s.commit()
        return _group_to_dict(row)


def delete_stage_group(group_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(StageGroup, group_id)
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True
