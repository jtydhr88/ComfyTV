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
from .entries import _seed_defaults


DEFAULT_PROJECT_ID = "default"


DEFAULT_PROJECT_NAME = "Default"


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
