import json
import logging
import os
import re as _re
import uuid
from typing import Any, Optional

from sqlalchemy import desc, select

from .. import db
from ..db import (
    Asset, AssetCategory, AssetCategoryLink, ComfyServer, Entry, Output,
    Preset, Project, ProxyMedia, RemoteJob, Resource, StageParam,
)

logger = logging.getLogger(__name__)


ASSET_MEDIA_TYPES: tuple[str, ...] = ("image", "video", "audio", "model")


def _asset_category_to_dict(c: AssetCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _asset_to_dict(a: Asset, category_ids: list[int]) -> dict:
    return {
        "id": a.id,
        "category_ids": category_ids,
        "name": a.name or "",
        "media_type": a.media_type,
        "payload_url": a.payload_url,
        "mime_type": a.mime_type,
        "width": a.width,
        "height": a.height,
        "size_bytes": a.size_bytes,
        "source": a.source,
        "metadata": json.loads(a.metadata_json) if a.metadata_json else {},
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


def _category_map(s, asset_ids: list[int]) -> dict[int, list[int]]:
    if not asset_ids:
        return {}
    rows = s.execute(
        select(AssetCategoryLink.asset_id, AssetCategoryLink.category_id)
            .where(AssetCategoryLink.asset_id.in_(asset_ids))
    ).all()
    out: dict[int, list[int]] = {}
    for aid, cid in rows:
        out.setdefault(aid, []).append(cid)
    for ids in out.values():
        ids.sort()
    return out


def _asset_dict_for(s, a: Asset) -> dict:
    return _asset_to_dict(a, _category_map(s, [a.id]).get(a.id, []))


def _normalize_category_ids(category_ids) -> list[int]:
    if not category_ids:
        return []
    seen: list[int] = []
    for cid in category_ids:
        try:
            n = int(cid)
        except (TypeError, ValueError):
            continue
        if n not in seen:
            seen.append(n)
    return seen


def _existing_category_ids(s, category_ids: list[int]) -> Optional[list[int]]:
    if not category_ids:
        return []
    found = set(s.execute(
        select(AssetCategory.id).where(AssetCategory.id.in_(category_ids))
    ).scalars().all())
    if found != set(category_ids):
        return None
    return category_ids


def list_asset_categories() -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(
            select(AssetCategory).order_by(AssetCategory.order_, AssetCategory.name, AssetCategory.id)
        ).scalars().all()
        return [_asset_category_to_dict(c) for c in rows]


def create_asset_category(name: str) -> Optional[dict]:
    name = (name or "").strip()
    if not name:
        return None
    with db.get_session() as s:
        exists = s.execute(
            select(AssetCategory.id).where(AssetCategory.name == name).limit(1)
        ).scalar_one_or_none()
        if exists is not None:
            return None
        cat = AssetCategory(name=name)
        s.add(cat)
        s.commit()
        return _asset_category_to_dict(cat)


def rename_asset_category(category_id: int, name: str) -> Optional[dict]:
    name = (name or "").strip()
    if not name:
        return None
    with db.get_session() as s:
        cat = s.get(AssetCategory, category_id)
        if cat is None:
            return None
        clash = s.execute(
            select(AssetCategory.id)
                .where(AssetCategory.name == name, AssetCategory.id != category_id)
                .limit(1)
        ).scalar_one_or_none()
        if clash is not None:
            return None
        cat.name = name
        s.commit()
        return _asset_category_to_dict(cat)


def delete_asset_category(category_id: int) -> bool:
    with db.get_session() as s:
        cat = s.get(AssetCategory, category_id)
        if cat is None:
            return False
        s.query(AssetCategoryLink) \
            .filter(AssetCategoryLink.category_id == category_id) \
            .delete(synchronize_session=False)
        s.delete(cat)
        s.commit()
        return True


def list_assets(
    category_id: Optional[int] = None,
    *,
    uncategorized: bool = False,
    limit: int = 200,
    offset: int = 0,
) -> list[dict]:
    with db.get_session() as s:
        q = select(Asset)
        if uncategorized:
            q = q.where(Asset.id.not_in(select(AssetCategoryLink.asset_id)))
        elif category_id is not None:
            q = q.where(Asset.id.in_(
                select(AssetCategoryLink.asset_id)
                    .where(AssetCategoryLink.category_id == category_id)
            ))
        q = q.order_by(desc(Asset.id)).limit(limit).offset(offset)
        rows = s.execute(q).scalars().all()
        cmap = _category_map(s, [a.id for a in rows])
        return [_asset_to_dict(a, cmap.get(a.id, [])) for a in rows]


def create_asset(
    *,
    name: str,
    payload_url: str,
    media_type: str = "image",
    category_ids: Optional[list[int]] = None,
    mime_type: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    size_bytes: Optional[int] = None,
    source: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Optional[dict]:
    payload_url = (payload_url or "").strip()
    if not payload_url:
        return None
    if media_type not in ASSET_MEDIA_TYPES:
        return None
    ids = _normalize_category_ids(category_ids)
    with db.get_session() as s:
        valid = _existing_category_ids(s, ids)
        if valid is None:
            return None
        asset = Asset(
            name=(name or "").strip(),
            payload_url=payload_url,
            media_type=media_type,
            mime_type=mime_type,
            width=int(width) if width is not None else None,
            height=int(height) if height is not None else None,
            size_bytes=int(size_bytes) if size_bytes is not None else None,
            source=source,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
        s.add(asset)
        s.flush()
        for cid in valid:
            s.add(AssetCategoryLink(asset_id=asset.id, category_id=cid))
        s.commit()
        return _asset_to_dict(asset, sorted(valid))


def update_asset(
    asset_id: int,
    *,
    name: Optional[str] = None,
    category_ids: Optional[list[int]] = None,
) -> Optional[dict]:
    with db.get_session() as s:
        asset = s.get(Asset, asset_id)
        if asset is None:
            return None
        if name is not None:
            asset.name = name.strip()
        if category_ids is not None:
            ids = _normalize_category_ids(category_ids)
            valid = _existing_category_ids(s, ids)
            if valid is None:
                return None
            s.query(AssetCategoryLink) \
                .filter(AssetCategoryLink.asset_id == asset_id) \
                .delete(synchronize_session=False)
            for cid in valid:
                s.add(AssetCategoryLink(asset_id=asset_id, category_id=cid))
        s.commit()
        return _asset_dict_for(s, asset)


def add_asset_category(asset_id: int, category_id: int) -> Optional[dict]:
    with db.get_session() as s:
        asset = s.get(Asset, asset_id)
        if asset is None or s.get(AssetCategory, category_id) is None:
            return None
        exists = s.get(AssetCategoryLink, (asset_id, category_id))
        if exists is None:
            s.add(AssetCategoryLink(asset_id=asset_id, category_id=category_id))
            s.commit()
        return _asset_dict_for(s, asset)


def remove_asset_category(asset_id: int, category_id: int) -> Optional[dict]:
    with db.get_session() as s:
        asset = s.get(Asset, asset_id)
        if asset is None:
            return None
        s.query(AssetCategoryLink) \
            .filter(
                AssetCategoryLink.asset_id == asset_id,
                AssetCategoryLink.category_id == category_id,
            ) \
            .delete(synchronize_session=False)
        s.commit()
        return _asset_dict_for(s, asset)


def delete_asset(asset_id: int) -> bool:
    with db.get_session() as s:
        asset = s.get(Asset, asset_id)
        if asset is None:
            return False
        s.query(AssetCategoryLink) \
            .filter(AssetCategoryLink.asset_id == asset_id) \
            .delete(synchronize_session=False)
        s.delete(asset)
        s.commit()
        return True


def asset_payload_urls() -> set:
    with db.get_session() as s:
        rows = s.execute(select(Asset.payload_url)).scalars().all()
        return set(rows)
