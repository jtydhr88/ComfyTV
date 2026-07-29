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
