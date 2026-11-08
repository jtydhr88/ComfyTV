import json
from typing import Optional

from sqlalchemy import select

from .. import db
from ..db import Asset, StageGroup


def _group_to_dict(s, g: StageGroup) -> dict:
    try:
        data = json.loads(g.data) if g.data else {}
    except ValueError:
        data = {}
    thumb = s.get(Asset, g.thumbnail_asset_id) if g.thumbnail_asset_id is not None else None
    return {
        "id": g.id,
        "name": g.name,
        "data": data if isinstance(data, dict) else {},
        "thumbnail_url": thumb.payload_url if thumb is not None else None,
        "created_at": g.created_at.isoformat() if g.created_at else None,
    }


def _drop_thumbnail(s, asset_id: Optional[int]) -> None:
    if asset_id is None:
        return
    asset = s.get(Asset, asset_id)
    if asset is not None and asset.is_hidden:
        s.delete(asset)


def list_stage_groups() -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(select(StageGroup).order_by(StageGroup.name, StageGroup.id)).scalars().all()
        return [_group_to_dict(s, g) for g in rows]


def save_stage_group(name: str, data: dict, thumbnail_asset_id: Optional[int]) -> dict:
    with db.get_session() as s:
        row = s.execute(select(StageGroup).where(StageGroup.name == name).limit(1)).scalar_one_or_none()
        if row is None:
            row = StageGroup(name=name, data=json.dumps(data), thumbnail_asset_id=thumbnail_asset_id)
            s.add(row)
        else:
            if row.thumbnail_asset_id != thumbnail_asset_id:
                _drop_thumbnail(s, row.thumbnail_asset_id)
            row.data = json.dumps(data)
            row.thumbnail_asset_id = thumbnail_asset_id
        s.commit()
        return _group_to_dict(s, row)


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
        return _group_to_dict(s, row)


def delete_stage_group(group_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(StageGroup, group_id)
        if row is None:
            return False
        _drop_thumbnail(s, row.thumbnail_asset_id)
        s.delete(row)
        s.commit()
        return True
