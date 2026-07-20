import json
import logging
import os
import uuid
from typing import Any, Optional

from sqlalchemy import desc, select

from . import db
from .db import (
    Asset, AssetCategory, AssetCategoryLink, ComfyServer, Entry, Output,
    Preset, Project, ProxyMedia, RemoteJob, Resource, StageParam,
)

logger = logging.getLogger(__name__)

DEFAULT_PROJECT_ID = "default"
DEFAULT_PROJECT_NAME = "Default"

OUTPUT_RETENTION_PER_STAGE = 50

def ensure_default_project() -> dict:
    with db.get_session() as s:
        proj = s.get(Project, DEFAULT_PROJECT_ID)
        if proj is None:
            proj = Project(id=DEFAULT_PROJECT_ID, name=DEFAULT_PROJECT_NAME)
            s.add(proj)
            s.commit()
            logger.info("[ComfyTV] created default project")
            _seed_defaults(s, DEFAULT_PROJECT_ID)
        return _project_to_dict(proj)


def list_projects() -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(select(Project).order_by(Project.updated_at.desc())).scalars().all()
        return [_project_to_dict(p) for p in rows]


def get_project(project_id: str) -> Optional[dict]:
    with db.get_session() as s:
        proj = s.get(Project, project_id)
        return _project_to_dict(proj) if proj else None


def create_project(name: str = "Untitled") -> dict:
    pid = uuid.uuid4().hex
    with db.get_session() as s:
        proj = Project(id=pid, name=name.strip() or "Untitled")
        s.add(proj)
        s.commit()
        _seed_defaults(s, pid)
        return _project_to_dict(proj)


def rename_project(project_id: str, name: str) -> Optional[dict]:
    with db.get_session() as s:
        proj = s.get(Project, project_id)
        if proj is None:
            return None
        proj.name = name.strip() or proj.name
        s.commit()
        return _project_to_dict(proj)


def delete_project(project_id: str) -> bool:
    if project_id == DEFAULT_PROJECT_ID:
        return False
    with db.get_session() as s:
        proj = s.get(Project, project_id)
        if proj is None:
            return False
        s.query(Output).filter(Output.project_id == project_id).delete()
        s.delete(proj)
        s.commit()
        return True


def _project_to_dict(p: Optional[Project]) -> dict:
    if p is None:
        return {}
    return {
        "id": p.id,
        "name": p.name,
        "blueprint": p.blueprint,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


import re as _re
_ENTRY_LABEL_RE = _re.compile(r"^[^\W\d][\w-]*$")

ENTRY_KINDS: tuple[str, ...] = ("fragment",)

_DEFAULT_FRAGMENTS = [
    ("subject",  "a young Asian businesswoman, 30s, sharp jawline"),
    ("style",    "cinematic photograph, golden hour, shallow depth of field"),
    ("lighting", "rim light from behind, soft fill from the front"),
]


def _entry_to_dict(e: Entry) -> dict:
    return {
        "id":         e.id,
        "kind":       e.kind,
        "label":      e.label,
        "content":    e.content or "",
        "metadata":   json.loads(e.metadata_json) if e.metadata_json else {},
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


def project_exists(project_id: str) -> bool:
    with db.get_session() as s:
        return s.get(Project, project_id) is not None


def list_entries(project_id: str) -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(
            select(Entry)
                .where(Entry.project_id == project_id)
                .order_by(Entry.kind, Entry.label, Entry.id)
        ).scalars().all()
        return [_entry_to_dict(e) for e in rows]


def upsert_entry(
    project_id: str,
    *,
    kind: str,
    label: str,
    content: str,
    metadata: Optional[dict] = None,
    entry_id: Optional[int] = None,
) -> Optional[dict]:
    label = (label or "").strip()
    if not _ENTRY_LABEL_RE.match(label):
        return None
    if kind not in ENTRY_KINDS:
        return None
    meta_json = json.dumps(metadata) if metadata else None
    with db.get_session() as s:
        if entry_id is not None:
            row = s.get(Entry, entry_id)
            if row is None or row.project_id != project_id:
                return None
            row.kind = kind
            row.label = label
            row.content = content or ""
            row.metadata_json = meta_json
        else:
            row = Entry(
                project_id=project_id, kind=kind, label=label,
                content=content or "", metadata_json=meta_json,
            )
            s.add(row)
        s.commit()
        return _entry_to_dict(row)


def delete_entry(project_id: str, entry_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(Entry, entry_id)
        if row is None or row.project_id != project_id:
            return False
        s.delete(row)
        s.commit()
        return True


def _seed_defaults(session, project_id: str) -> None:
    existing = session.execute(
        select(Entry.id).where(Entry.project_id == project_id).limit(1)
    ).scalar_one_or_none()
    if existing is not None:
        return
    for label, content in _DEFAULT_FRAGMENTS:
        session.add(Entry(project_id=project_id, kind="fragment", label=label, content=content))
    session.commit()

def persist_output(
    *,
    project_id: str,
    stage_class: str,
    stage_node_id: Optional[str],
    output_type: str,
    payload_url: str,
    payload_json: Any = None,
    params: Any = None,
    parent_output_id: Optional[int] = None,
    picked_index: Optional[int] = None,
) -> Optional[dict]:
    pid = (project_id or "").strip() or DEFAULT_PROJECT_ID
    if pid == DEFAULT_PROJECT_ID:
        ensure_default_project()

    with db.get_session() as s:
        proj = s.get(Project, pid)
        if proj is None:
            logger.warning("[ComfyTV] persist_output: project %s missing; falling back to default", pid)
            ensure_default_project()
            pid = DEFAULT_PROJECT_ID
        out = Output(
            project_id=pid,
            stage_class=stage_class,
            stage_node_id=str(stage_node_id) if stage_node_id is not None else None,
            output_type=output_type,
            payload_url=payload_url or "",
            payload_json=json.dumps(payload_json) if payload_json is not None else None,
            params_json=json.dumps(params, default=str) if params is not None else None,
            parent_output_id=parent_output_id,
            picked_index=int(picked_index) if picked_index is not None else None,
        )
        s.add(out)
        s.commit()
        new_id = out.id
        if stage_node_id is not None:
            from sqlalchemy import select
            keepers = select(Output.id).where(
                Output.project_id == pid,
                Output.stage_node_id == str(stage_node_id),
            ).order_by(Output.id.desc()).limit(OUTPUT_RETENTION_PER_STAGE)
            referenced_parents = (
                select(Output.parent_output_id)
                .where(Output.parent_output_id.isnot(None))
                .distinct()
            )
            s.query(Output).filter(
                Output.project_id == pid,
                Output.stage_node_id == str(stage_node_id),
                Output.id.notin_(keepers),
                Output.id.notin_(referenced_parents),
            ).delete(synchronize_session=False)
            s.commit()
        return _output_to_dict(out)


def list_outputs(project_id: str, stage_node_id: Optional[str] = None, limit: int = 50) -> list[dict]:
    with db.get_session() as s:
        q = select(Output).where(Output.project_id == project_id)
        if stage_node_id is not None:
            q = q.where(Output.stage_node_id == str(stage_node_id))
        q = q.order_by(desc(Output.id)).limit(limit)
        return [_output_to_dict(o) for o in s.execute(q).scalars().all()]


def latest_output(project_id: str, stage_node_id: str) -> Optional[dict]:
    rows = list_outputs(project_id, stage_node_id=stage_node_id, limit=1)
    return rows[0] if rows else None


def latest_output_by_uid(
    project_id: str, stage_uid: str, output_type: Optional[str] = None
) -> Optional[dict]:
    if not stage_uid:
        return None
    with db.get_session() as s:
        q = (
            select(Output)
            .where(Output.project_id == project_id, Output.stage_uid == str(stage_uid))
        )
        if output_type:
            q = q.where(Output.output_type == str(output_type))
        q = q.order_by(desc(Output.id)).limit(1)
        out = s.execute(q).scalars().first()
        return _output_to_dict(out) if out is not None else None


def set_output_stage_uid(output_id: int, stage_uid: str) -> Optional[dict]:
    if not stage_uid:
        return None
    with db.get_session() as s:
        out = s.get(Output, int(output_id))
        if out is None:
            return None
        out.stage_uid = str(stage_uid)
        s.commit()
        return _output_to_dict(out)


def adopt_outputs(
    project_id: str,
    stage_node_id: str,
    stage_class: str,
    stage_uid: str,
    output_type: Optional[str] = None,
) -> Optional[dict]:
    if not stage_uid or not stage_node_id or not stage_class:
        return None
    with db.get_session() as s:
        q = s.query(Output).filter(
            Output.project_id == project_id,
            Output.stage_node_id == str(stage_node_id),
            Output.stage_class == str(stage_class),
            Output.stage_uid.is_(None),
        )
        if output_type:
            q = q.filter(Output.output_type == str(output_type))
        rows = q.order_by(desc(Output.id)).all()
        if not rows:
            return None
        for r in rows:
            r.stage_uid = str(stage_uid)
        s.commit()
        return _output_to_dict(rows[0])


def update_output_picked_index(output_id: int, picked_index: int) -> Optional[dict]:
    with db.get_session() as s:
        out = s.get(Output, int(output_id))
        if out is None:
            return None
        out.picked_index = int(picked_index) if picked_index is not None else None
        s.commit()
        return _output_to_dict(out)


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


def _output_to_dict(o: Output) -> dict:
    return {
        "id": o.id,
        "project_id": o.project_id,
        "stage_class": o.stage_class,
        "stage_node_id": o.stage_node_id,
        "stage_uid": o.stage_uid,
        "output_type": o.output_type,
        "payload_url": o.payload_url,
        "payload_json": json.loads(o.payload_json) if o.payload_json else None,
        "params_json": json.loads(o.params_json) if o.params_json else None,
        "parent_output_id": o.parent_output_id,
        "picked_index": o.picked_index,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


STAGE_PARAM_TYPES: tuple[str, ...] = ("boolean", "int", "float", "string", "combo")

_UNSET = object()


def _slugify_param_key(label: str) -> str:
    base = _re.sub(r"[^a-z0-9]+", "_", (label or "").strip().lower()).strip("_")
    return base or "param"


def seed_system_stage_params() -> int:
    from .nodes.stages.common.caps import builtin_option_rows
    seeded = 0
    with db.get_session() as s:
        existing = {
            (r.kind, r.key)
            for r in s.execute(select(StageParam.kind, StageParam.key)).all()
        }
        for row in builtin_option_rows():
            kp = (row["kind"], row["key"])
            if kp in existing:
                continue
            s.add(StageParam(
                kind=row["kind"], key=row["key"], label=row["label"],
                type=row["type"], default_json=None, config_json=None,
                origin=0, order_=0,
            ))
            existing.add(kp)
            seeded += 1
        if seeded:
            s.commit()
    return seeded


def _stage_param_to_dict(p: StageParam) -> dict:
    return {
        "id": p.id,
        "kind": p.kind,
        "key": p.key,
        "label": p.label,
        "type": p.type,
        "default": json.loads(p.default_json) if p.default_json else None,
        "config": json.loads(p.config_json) if p.config_json else {},
        "origin": int(p.origin or 0),
        "order": p.order_,
    }


def list_stage_params(kind: Optional[str] = None) -> list[dict]:
    with db.get_session() as s:
        q = select(StageParam)
        if kind:
            q = q.where(StageParam.kind == kind)
        q = q.order_by(StageParam.kind, StageParam.order_, StageParam.id)
        rows = s.execute(q).scalars().all()
        return [_stage_param_to_dict(p) for p in rows]


def create_stage_param(
    *,
    kind: str,
    label: str,
    type: str,
    default=None,
    config: Optional[dict] = None,
    origin: int = 1,
) -> Optional[dict]:
    kind = (kind or "").strip()
    label = (label or "").strip()
    if not kind or not label:
        return None
    if type not in STAGE_PARAM_TYPES:
        return None
    with db.get_session() as s:
        base = _slugify_param_key(label)
        existing = set(s.execute(
            select(StageParam.key).where(StageParam.kind == kind)
        ).scalars().all())
        key = base
        n = 2
        while key in existing:
            key = f"{base}_{n}"
            n += 1
        max_order = s.execute(
            select(StageParam.order_).where(StageParam.kind == kind)
                .order_by(StageParam.order_.desc()).limit(1)
        ).scalar_one_or_none()
        row = StageParam(
            kind=kind,
            key=key,
            label=label,
            type=type,
            default_json=json.dumps(default) if default is not None else None,
            config_json=json.dumps(config) if config else None,
            origin=int(origin),
            order_=(max_order or 0) + 10,
        )
        s.add(row)
        s.commit()
        return _stage_param_to_dict(row)


def update_stage_param(
    param_id: int,
    *,
    label: Optional[str] = None,
    type: Optional[str] = None,
    default=_UNSET,
    config=_UNSET,
    order: Optional[int] = None,
) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(StageParam, param_id)
        if row is None:
            return None
        if row.origin == 0:
            return None
        if label is not None:
            label = label.strip()
            if label:
                row.label = label
        if type is not None and type in STAGE_PARAM_TYPES:
            row.type = type
        if default is not _UNSET:
            row.default_json = json.dumps(default) if default is not None else None
        if config is not _UNSET:
            row.config_json = json.dumps(config) if config else None
        if order is not None:
            row.order_ = int(order)
        s.commit()
        return _stage_param_to_dict(row)


def delete_stage_param(param_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(StageParam, param_id)
        if row is None or row.origin == 0:
            return False
        s.delete(row)
        s.commit()
        return True


def _preset_to_dict(p: Preset) -> dict:
    try:
        config = json.loads(p.config) if p.config else {}
    except ValueError:
        config = {}
    return {
        "id": p.id,
        "kind": p.kind,
        "name": p.name,
        "config": config if isinstance(config, dict) else {},
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def list_presets(kind: Optional[str] = None) -> list[dict]:
    with db.get_session() as s:
        q = select(Preset)
        if kind:
            q = q.where(Preset.kind == kind)
        rows = s.execute(q.order_by(Preset.name, Preset.id)).scalars().all()
        return [_preset_to_dict(p) for p in rows]


def save_preset(kind: str, name: str, config: dict) -> Optional[dict]:
    kind = (kind or "").strip()
    name = (name or "").strip()
    if not kind or not name or not isinstance(config, dict):
        return None
    with db.get_session() as s:
        row = s.execute(
            select(Preset).where(Preset.kind == kind, Preset.name == name).limit(1)
        ).scalar_one_or_none()
        if row is None:
            row = Preset(kind=kind, name=name, config=json.dumps(config))
            s.add(row)
        else:
            row.config = json.dumps(config)
        s.commit()
        return _preset_to_dict(row)


def update_preset(
    preset_id: int,
    *,
    name: Optional[str] = None,
    config: Optional[dict] = None,
) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(Preset, preset_id)
        if row is None:
            return None
        if name is not None:
            name = name.strip()
            if not name:
                return None
            clash = s.execute(
                select(Preset.id)
                    .where(Preset.kind == row.kind, Preset.name == name,
                           Preset.id != preset_id)
                    .limit(1)
            ).scalar_one_or_none()
            if clash is not None:
                return None
            row.name = name
        if config is not None:
            if not isinstance(config, dict):
                return None
            row.config = json.dumps(config)
        s.commit()
        return _preset_to_dict(row)


def delete_preset(preset_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(Preset, preset_id)
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True


def _resource_to_dict(r: Resource) -> dict:
    return {
        "id": r.id,
        "kind": r.kind,
        "name": r.name,
        "filename": r.filename,
        "subfolder": r.subfolder,
        "size": r.size,
        "sha256": r.sha256,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def list_resources(kind: Optional[str] = None) -> list[dict]:
    with db.get_session() as s:
        q = select(Resource)
        if kind:
            q = q.where(Resource.kind == kind)
        rows = s.execute(q.order_by(Resource.name, Resource.id)).scalars().all()
        return [_resource_to_dict(r) for r in rows]


def register_resource(
    kind: str,
    filename: str,
    subfolder: str,
    *,
    name: Optional[str] = None,
    size: Optional[int] = None,
    sha256: Optional[str] = None,
) -> Optional[dict]:
    kind = (kind or "").strip()
    filename = (filename or "").strip()
    if not kind or not filename:
        return None
    with db.get_session() as s:
        row = s.execute(
            select(Resource)
                .where(Resource.kind == kind, Resource.filename == filename)
                .limit(1)
        ).scalar_one_or_none()
        if row is None:
            row = Resource(
                kind=kind,
                name=(name or "").strip() or os.path.splitext(filename)[0],
                filename=filename,
                subfolder=subfolder or "",
                size=size,
                sha256=sha256,
            )
            s.add(row)
        else:
            if subfolder:
                row.subfolder = subfolder
            if size is not None:
                row.size = size
            if sha256 is not None:
                row.sha256 = sha256
        s.commit()
        return _resource_to_dict(row)


def rename_resource(resource_id: int, name: str) -> Optional[dict]:
    name = (name or "").strip()
    if not name:
        return None
    with db.get_session() as s:
        row = s.get(Resource, resource_id)
        if row is None:
            return None
        row.name = name
        s.commit()
        return _resource_to_dict(row)


def unregister_resource(resource_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(Resource, resource_id)
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True


def _server_to_dict(r: ComfyServer) -> dict:
    return {
        "id": r.id,
        "label": r.label,
        "host": r.host,
        "port": int(r.port or 8188),
        "enabled": bool(r.enabled),
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def list_servers() -> list[dict]:
    with db.get_session() as s:
        rows = s.execute(select(ComfyServer).order_by(ComfyServer.id)).scalars().all()
        return [_server_to_dict(r) for r in rows]


def get_server(server_id: int) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(ComfyServer, server_id)
        return _server_to_dict(row) if row else None


def create_server(*, label: str, host: str, port: int) -> Optional[dict]:
    label = (label or "").strip()
    host = (host or "").strip()
    if not label or not host:
        return None
    with db.get_session() as s:
        exists = s.execute(
            select(ComfyServer.id).where(ComfyServer.label == label)
        ).scalar_one_or_none()
        if exists is not None:
            return None
        row = ComfyServer(label=label, host=host, port=int(port or 8188))
        s.add(row)
        s.commit()
        return _server_to_dict(row)


def update_server(
    server_id: int,
    *,
    label: Optional[str] = None,
    host: Optional[str] = None,
    port: Optional[int] = None,
    enabled: Optional[bool] = None,
) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(ComfyServer, server_id)
        if row is None:
            return None
        if label is not None and label.strip():
            clash = s.execute(
                select(ComfyServer.id)
                    .where(ComfyServer.label == label.strip())
                    .where(ComfyServer.id != server_id)
            ).scalar_one_or_none()
            if clash is not None:
                return None
            row.label = label.strip()
        if host is not None and host.strip():
            row.host = host.strip()
        if port is not None:
            row.port = int(port)
        if enabled is not None:
            row.enabled = bool(enabled)
        s.commit()
        return _server_to_dict(row)


def delete_server(server_id: int) -> bool:
    with db.get_session() as s:
        row = s.get(ComfyServer, server_id)
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True


def _remote_job_to_dict(j: RemoteJob) -> dict:
    return {
        "id": j.id,
        "server_id": j.server_id,
        "server_label": j.server_label or "",
        "project_id": j.project_id,
        "stage_node_id": j.stage_node_id,
        "stage_uid": j.stage_uid,
        "status": j.status,
        "remote_prompt_id": j.remote_prompt_id,
        "error_text": j.error_text,
        "output_id": j.output_id,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "updated_at": j.updated_at.isoformat() if j.updated_at else None,
    }


def create_remote_job(
    *,
    job_id: str,
    server_id: int,
    server_label: str,
    project_id: str,
    stage_node_id: str,
    stage_uid: Optional[str] = None,
) -> dict:
    with db.get_session() as s:
        row = RemoteJob(
            id=job_id,
            server_id=server_id,
            server_label=server_label or "",
            project_id=project_id or "",
            stage_node_id=str(stage_node_id),
            stage_uid=stage_uid,
            status="queued",
        )
        s.add(row)
        s.commit()
        return _remote_job_to_dict(row)


def update_remote_job(
    job_id: str,
    *,
    status: Optional[str] = None,
    remote_prompt_id: Optional[str] = None,
    error_text: Optional[str] = None,
    output_id: Optional[int] = None,
) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(RemoteJob, job_id)
        if row is None:
            return None
        if status is not None:
            row.status = status
        if remote_prompt_id is not None:
            row.remote_prompt_id = remote_prompt_id
        if error_text is not None:
            row.error_text = error_text
        if output_id is not None:
            row.output_id = int(output_id)
        s.commit()
        return _remote_job_to_dict(row)


def get_remote_job(job_id: str) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(RemoteJob, job_id)
        return _remote_job_to_dict(row) if row else None


def list_remote_jobs(status: Optional[str] = None, limit: int = 100) -> list[dict]:
    with db.get_session() as s:
        q = select(RemoteJob)
        if status:
            q = q.where(RemoteJob.status == status)
        q = q.order_by(desc(RemoteJob.created_at)).limit(limit)
        rows = s.execute(q).scalars().all()
        return [_remote_job_to_dict(j) for j in rows]


def _proxy_to_dict(p: ProxyMedia) -> dict:
    return {
        "id": p.id,
        "src_path": p.src_path,
        "src_url": p.src_url,
        "src_size": p.src_size,
        "src_mtime_ns": p.src_mtime_ns,
        "profile": p.profile,
        "status": p.status,
        "proxy_path": p.proxy_path,
        "width": p.width,
        "height": p.height,
        "error": p.error,
    }


def get_proxy(src_path: str, profile: str) -> Optional[dict]:
    with db.get_session() as s:
        row = s.execute(
            select(ProxyMedia)
                .where(ProxyMedia.src_path == src_path,
                       ProxyMedia.profile == profile)
                .limit(1)
        ).scalar_one_or_none()
        return None if row is None else _proxy_to_dict(row)


def get_proxy_by_id(proxy_id: int) -> Optional[dict]:
    with db.get_session() as s:
        row = s.get(ProxyMedia, proxy_id)
        return None if row is None else _proxy_to_dict(row)


def create_or_reset_proxy(src_path: str, profile: str, *, src_url: str = "",
                          src_size: int = 0, src_mtime_ns: int = 0) -> dict:
    with db.get_session() as s:
        row = s.execute(
            select(ProxyMedia)
                .where(ProxyMedia.src_path == src_path,
                       ProxyMedia.profile == profile)
                .limit(1)
        ).scalar_one_or_none()
        if row is None:
            row = ProxyMedia(src_path=src_path, profile=profile)
            s.add(row)
        row.src_url = src_url
        row.src_size = src_size
        row.src_mtime_ns = src_mtime_ns
        row.status = "pending"
        row.proxy_path = None
        row.width = None
        row.height = None
        row.error = None
        s.commit()
        return _proxy_to_dict(row)


def set_proxy_status(proxy_id: int, status: str, *, proxy_path: Optional[str] = None,
                     width: Optional[int] = None, height: Optional[int] = None,
                     error: Optional[str] = None) -> None:
    with db.get_session() as s:
        row = s.get(ProxyMedia, proxy_id)
        if row is None:
            return
        row.status = status
        if proxy_path is not None:
            row.proxy_path = proxy_path
        if width is not None:
            row.width = width
        if height is not None:
            row.height = height
        row.error = error
        s.commit()


def asset_payload_urls() -> set:
    with db.get_session() as s:
        rows = s.execute(select(Asset.payload_url)).scalars().all()
        return set(rows)
