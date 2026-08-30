import json

from .. import db
from ..db import CollabDoc

__all__ = ["load_collab_doc", "save_collab_doc", "delete_collab_doc"]


def load_collab_doc(project_id: str) -> dict | None:
    with db.get_session() as s:
        row = s.get(CollabDoc, project_id)
        if row is None:
            return None
        try:
            return json.loads(row.state)
        except Exception:
            return None


def save_collab_doc(project_id: str, state: dict) -> None:
    with db.get_session() as s:
        row = s.get(CollabDoc, project_id)
        if row is None:
            row = CollabDoc(project_id=project_id)
            s.add(row)
        row.state = json.dumps(state)
        s.commit()


def delete_collab_doc(project_id: str) -> None:
    with db.get_session() as s:
        row = s.get(CollabDoc, project_id)
        if row is not None:
            s.delete(row)
            s.commit()
