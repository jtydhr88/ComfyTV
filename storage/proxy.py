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
