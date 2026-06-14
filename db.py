import logging
import os
import threading
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    event,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    sessionmaker,
)


class Base(DeclarativeBase):
    """Our own Base so we control metadata independently of ComfyUI core."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "comfytv_projects"

    id:         Mapped[str] = mapped_column(String, primary_key=True)
    name:       Mapped[str] = mapped_column(String, default="Untitled")
    blueprint:  Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Workflow(Base):
    __tablename__ = "comfytv_workflows"
    __table_args__ = (UniqueConstraint("kind", "label", name="uq_workflow_kind_label"),)

    id:           Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind:         Mapped[str] = mapped_column(String, index=True)
    label:        Mapped[str] = mapped_column(String)
    file_path:    Mapped[str] = mapped_column(Text)
    file_mtime:   Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    api_json:     Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_:       Mapped[int] = mapped_column("order", Integer, default=100)
    description:  Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_type:  Mapped[Optional[str]] = mapped_column(String, nullable=True)
    result_node:  Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sizing_json:                 Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prune_when_missing_json:     Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class WorkflowInputBinding(Base):
    __tablename__ = "comfytv_workflow_input_bindings"

    workflow_id:  Mapped[int] = mapped_column(
        Integer, ForeignKey("comfytv_workflows.id", ondelete="CASCADE"), primary_key=True
    )
    node_id:      Mapped[str] = mapped_column(String, primary_key=True)
    input_name:   Mapped[str] = mapped_column(String, primary_key=True)
    from_:        Mapped[str] = mapped_column("from", String)
    default_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prefix:       Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    suffix:       Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    required:     Mapped[bool] = mapped_column(Boolean, default=False)
    error_msg:    Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cast_:        Mapped[Optional[str]] = mapped_column("cast", String, nullable=True)


class Entry(Base):
    __tablename__ = "comfytv_entries"

    id:         Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("comfytv_projects.id", ondelete="CASCADE"), index=True)
    kind:       Mapped[str] = mapped_column(String, index=True)
    label:      Mapped[str] = mapped_column(String, index=True)
    content:    Mapped[str] = mapped_column(Text, default="")
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Output(Base):
    __tablename__ = "comfytv_outputs"

    id:               Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id:       Mapped[str] = mapped_column(String, ForeignKey("comfytv_projects.id"), index=True)
    stage_class:      Mapped[str] = mapped_column(String, index=True)
    stage_node_id:    Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    stage_uid:        Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    output_type:      Mapped[str] = mapped_column(String)
    payload_url:      Mapped[str] = mapped_column(Text, default="")
    payload_json:     Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    params_json:      Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parent_output_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("comfytv_outputs.id", ondelete="SET NULL"), nullable=True
    )
    picked_index:     Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at:       Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


_engine = None
_Session: Optional[sessionmaker] = None
_init_lock = threading.Lock()


def _attach_pragmas(engine) -> None:
    @event.listens_for(engine, "connect")
    def _set_pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()


def _user_db_fallback_path() -> str:
    import folder_paths
    if hasattr(folder_paths, "get_user_directory"):
        user = folder_paths.get_user_directory()
    else:
        user = os.path.join(folder_paths.base_path, "user", "default")
    d = os.path.join(user, "comfytv")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "data.db")


def _init_engine() -> None:
    global _engine, _Session
    if _engine is not None:
        return

    try:
        from app.database.db import Session as core_Session, dependencies_available
        if dependencies_available() and core_Session is not None:
            bound = core_Session.kw.get("bind")
            if bound is not None:
                _engine = bound
                logging.info("[ComfyTV] using ComfyUI core DB engine")
    except (ImportError, KeyError, AttributeError) as e:
        logging.info(f"[ComfyTV] core DB unavailable ({e}); using standalone SQLite")

    if _engine is None:
        path = _user_db_fallback_path()
        _engine = create_engine(
            f"sqlite:///{path}",
            connect_args={"check_same_thread": False},
        )
        _attach_pragmas(_engine)
        logging.info(f"[ComfyTV] standalone DB at {path}")

    Base.metadata.create_all(_engine)
    _migrate_additive_columns(_engine)
    _Session = sessionmaker(bind=_engine, expire_on_commit=False)


def _migrate_additive_columns(engine) -> None:
    from sqlalchemy import inspect, text
    try:
        insp = inspect(engine)
        cols = {c["name"] for c in insp.get_columns("comfytv_outputs")}
        if "picked_index" not in cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_outputs ADD COLUMN picked_index INTEGER"
                ))
            logging.info("[ComfyTV] migrated: comfytv_outputs + picked_index")
        if "stage_uid" not in cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_outputs ADD COLUMN stage_uid VARCHAR"
                ))
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_comfytv_outputs_stage_uid "
                    "ON comfytv_outputs (stage_uid)"
                ))
            logging.info("[ComfyTV] migrated: comfytv_outputs + stage_uid")
    except Exception as e:
        logging.warning("[ComfyTV] additive migration failed: %s", e)


def init() -> None:
    with _init_lock:
        _init_engine()


def get_session() -> Session:
    if _Session is None:
        init()
    assert _Session is not None
    return _Session()
