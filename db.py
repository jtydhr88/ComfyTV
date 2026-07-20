import logging
import os
import threading
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    BigInteger,
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


LINK_TYPE_MANAGED = 0
LINK_TYPE_NATIVE = 1


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
    link_type:    Mapped[int] = mapped_column(Integer, default=LINK_TYPE_MANAGED,
                                              server_default="0")
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


class AssetCategory(Base):
    __tablename__ = "comfytv_asset_categories"

    id:         Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name:       Mapped[str] = mapped_column(String, unique=True)
    order_:     Mapped[int] = mapped_column("order", Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Asset(Base):
    __tablename__ = "comfytv_assets"

    id:          Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name:        Mapped[str] = mapped_column(String, default="")
    media_type:  Mapped[str] = mapped_column(String, default="image", index=True)
    payload_url: Mapped[str] = mapped_column(Text, default="")
    mime_type:   Mapped[Optional[str]] = mapped_column(String, nullable=True)
    width:       Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height:      Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    size_bytes:  Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    source:      Mapped[Optional[str]] = mapped_column(String, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class StageParam(Base):
    __tablename__ = "comfytv_stage_params"
    __table_args__ = (UniqueConstraint("kind", "key", name="uq_stage_param_kind_key"),)

    id:           Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind:         Mapped[str] = mapped_column(String, index=True)
    key:          Mapped[str] = mapped_column(String)
    label:        Mapped[str] = mapped_column(String, default="")
    type:         Mapped[str] = mapped_column(String, default="string")
    default_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    config_json:  Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    origin:       Mapped[int] = mapped_column(Integer, default=1)  # 0=system, 1=user
    order_:       Mapped[int] = mapped_column("order", Integer, default=100)
    created_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Preset(Base):
    __tablename__ = "comfytv_presets"
    __table_args__ = (UniqueConstraint("kind", "name", name="uq_preset_kind_name"),)

    id:         Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind:       Mapped[str] = mapped_column(String, index=True)
    name:       Mapped[str] = mapped_column(String)
    config:     Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Resource(Base):
    __tablename__ = "comfytv_resources"
    __table_args__ = (UniqueConstraint("kind", "filename", name="uq_resource_kind_filename"),)

    id:         Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind:       Mapped[str] = mapped_column(String, index=True)
    name:       Mapped[str] = mapped_column(String, default="")
    filename:   Mapped[str] = mapped_column(String)
    subfolder:  Mapped[str] = mapped_column(String, default="")
    size:       Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sha256:     Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ProxyMedia(Base):
    __tablename__ = "comfytv_proxies"
    __table_args__ = (UniqueConstraint("src_path", "profile", name="uq_proxy_src_profile"),)

    id:           Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    src_path:     Mapped[str] = mapped_column(Text, index=True)
    src_url:      Mapped[str] = mapped_column(Text, default="")
    src_size:     Mapped[int] = mapped_column(BigInteger, default=0)
    src_mtime_ns: Mapped[int] = mapped_column(BigInteger, default=0)
    profile:      Mapped[str] = mapped_column(String, default="")
    status:       Mapped[str] = mapped_column(String, default="pending", index=True)
    proxy_path:   Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    width:        Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height:       Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error:        Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class ComfyServer(Base):
    __tablename__ = "comfytv_servers"

    id:         Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label:      Mapped[str] = mapped_column(String, unique=True)
    host:       Mapped[str] = mapped_column(String)
    port:       Mapped[int] = mapped_column(Integer, default=8188)
    enabled:    Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class RemoteJob(Base):
    __tablename__ = "comfytv_remote_jobs"

    id:               Mapped[str] = mapped_column(String, primary_key=True)
    server_id:        Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("comfytv_servers.id", ondelete="SET NULL"), nullable=True
    )
    server_label:     Mapped[str] = mapped_column(String, default="")
    project_id:       Mapped[str] = mapped_column(String, index=True)
    stage_node_id:    Mapped[str] = mapped_column(String, index=True)
    stage_uid:        Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status:           Mapped[str] = mapped_column(String, default="queued", index=True)
    remote_prompt_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error_text:       Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    output_id:        Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("comfytv_outputs.id", ondelete="SET NULL"), nullable=True
    )
    created_at:       Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at:       Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class AssetCategoryLink(Base):
    __tablename__ = "comfytv_asset_category_links"

    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("comfytv_assets.id", ondelete="CASCADE"),
        primary_key=True,
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("comfytv_asset_categories.id", ondelete="CASCADE"),
        primary_key=True, index=True,
    )


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

        wf_cols = {c["name"] for c in insp.get_columns("comfytv_workflows")}
        if "link_type" not in wf_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_workflows ADD COLUMN link_type INTEGER "
                    "NOT NULL DEFAULT 0"
                ))
            logging.info("[ComfyTV] migrated: comfytv_workflows + link_type")
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
