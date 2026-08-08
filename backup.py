import logging
import os
import re
import shutil
import sqlite3
import stat
from datetime import datetime
from typing import Any, Optional

from . import settings

logger = logging.getLogger(__name__)

DEFAULT_BACKUP_DIRNAME = "db-backup"
SNAPSHOT_SUBDIR = "comfytv"
_SNAPSHOT_RE = re.compile(r"^\d{8}-\d{6}(-\d+)?$")
_DB_FILES = ("data.db", "data.db-wal", "data.db-shm")


def data_dir() -> str:
    import folder_paths
    if hasattr(folder_paths, "get_user_directory"):
        user = folder_paths.get_user_directory()
    else:
        user = os.path.join(folder_paths.base_path, "user", "default")
    return os.path.join(user, "comfytv")


def resolve_backup_root(cfg: dict[str, Any]) -> str:
    path = (cfg.get("db-backup-path") or "").strip()
    if path:
        return path
    return os.path.join(settings.CUSTOM_NODE_DIR, DEFAULT_BACKUP_DIRNAME)


def _snapshot_dir_name(root: str, now: datetime) -> str:
    base = now.strftime("%Y%m%d-%H%M%S")
    name = base
    suffix = 0
    while os.path.exists(os.path.join(root, name)):
        suffix += 1
        name = f"{base}-{suffix}"
    return name


def _copy_sqlite_db(src_db: str, dst_db: str) -> None:
    src_conn = sqlite3.connect(f"file:{src_db}?mode=ro", uri=True)
    try:
        dst_conn = sqlite3.connect(dst_db)
        try:
            src_conn.backup(dst_conn)
        finally:
            dst_conn.close()
    finally:
        src_conn.close()


def _rmtree_force(path: str) -> None:
    def _onexc(func, p, _exc):
        os.chmod(p, stat.S_IWRITE)
        func(p)
    try:
        shutil.rmtree(path, onexc=_onexc)
    except TypeError:
        shutil.rmtree(path, onerror=_onexc)


def prune_old_snapshots(root: str, max_count: int) -> list[str]:
    if max_count < 1 or not os.path.isdir(root):
        return []
    snapshots = sorted(
        name for name in os.listdir(root)
        if _SNAPSHOT_RE.match(name) and os.path.isdir(os.path.join(root, name))
    )
    removed: list[str] = []
    for name in snapshots[:-max_count]:
        target = os.path.join(root, name)
        try:
            _rmtree_force(target)
            removed.append(name)
        except OSError as e:
            logger.warning("[ComfyTV/backup] failed to prune %s: %s", target, e)
    if removed:
        logger.info("[ComfyTV/backup] pruned %d old snapshot(s): %s",
                    len(removed), ", ".join(removed))
    return removed


def run_backup(cfg: Optional[dict[str, Any]] = None,
               now: Optional[datetime] = None) -> dict[str, Any]:
    if cfg is None:
        cfg = settings.effective_settings(
            settings.read_raw_settings_from_sqlite(
                os.path.join(data_dir(), "data.db")))
    src = data_dir()
    if not os.path.isdir(src):
        return {"ok": False, "error": "data directory does not exist", "src": src}

    root = resolve_backup_root(cfg)
    try:
        os.makedirs(root, exist_ok=True)
        name = _snapshot_dir_name(root, now or datetime.now())
    except OSError as e:
        logger.warning("[ComfyTV/backup] invalid backup root %s: %s", root, e)
        return {"ok": False, "error": str(e)}
    dest = os.path.join(root, name, SNAPSHOT_SUBDIR)

    try:
        shutil.copytree(
            src, dest,
            ignore=lambda _d, names: [n for n in names if n in _DB_FILES],
        )
        src_db = os.path.join(src, "data.db")
        if os.path.isfile(src_db):
            _copy_sqlite_db(src_db, os.path.join(dest, "data.db"))
    except (OSError, sqlite3.Error) as e:
        logger.warning("[ComfyTV/backup] backup failed: %s", e)
        try:
            _rmtree_force(os.path.join(root, name))
        except OSError:
            pass
        return {"ok": False, "error": str(e)}

    prune_old_snapshots(root, int(cfg.get("db-backup-max-count") or 1))
    logger.info("[ComfyTV/backup] snapshot written to %s", dest)
    return {"ok": True, "path": dest, "snapshot": name}


def run_startup_backup() -> None:
    try:
        db_path = os.path.join(data_dir(), "data.db")
        cfg = settings.effective_settings(
            settings.read_raw_settings_from_sqlite(db_path))
        if not cfg.get("enable-db-backup", True):
            logger.info("[ComfyTV/backup] startup backup disabled by settings")
            return
        if not os.path.isfile(db_path):
            logger.info("[ComfyTV/backup] no data.db yet; skipping startup backup")
            return
        run_backup(cfg)
    except Exception:
        logger.exception("[ComfyTV/backup] startup backup failed")
