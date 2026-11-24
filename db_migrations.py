import logging

from sqlalchemy import inspect, text
from sqlalchemy.schema import CreateTable

from .db import Asset, Base


def migrate_additive_columns(engine) -> None:
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
        if "duration_ms" not in cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_outputs ADD COLUMN duration_ms INTEGER"
                ))
            logging.info("[ComfyTV] migrated: comfytv_outputs + duration_ms")

        bot_msg_cols = {c["name"] for c in insp.get_columns("comfytv_bot_messages")}
        if "usage_json" not in bot_msg_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_bot_messages ADD COLUMN usage_json TEXT"
                ))
            logging.info("[ComfyTV] migrated: comfytv_bot_messages + usage_json")

        bot_chat_cols = {c["name"] for c in insp.get_columns("comfytv_bot_chats")}
        if "run_mode" not in bot_chat_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_bot_chats ADD COLUMN run_mode VARCHAR"
                ))
            logging.info("[ComfyTV] migrated: comfytv_bot_chats + run_mode")
        if "prefs_json" not in bot_chat_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_bot_chats ADD COLUMN prefs_json TEXT"
                ))
            logging.info("[ComfyTV] migrated: comfytv_bot_chats + prefs_json")

        eagle_cols = {c["name"] for c in insp.get_columns("comfytv_eagle_pending")}
        if "folder" not in eagle_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_eagle_pending ADD COLUMN folder VARCHAR"
                ))
            logging.info("[ComfyTV] migrated: comfytv_eagle_pending + folder")

        wf_cols = {c["name"] for c in insp.get_columns("comfytv_workflows")}
        if "link_type" not in wf_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_workflows ADD COLUMN link_type INTEGER "
                    "NOT NULL DEFAULT 0"
                ))
            logging.info("[ComfyTV] migrated: comfytv_workflows + link_type")
        if "is_default" not in wf_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_workflows ADD COLUMN is_default BOOLEAN "
                    "NOT NULL DEFAULT 0"
                ))
            logging.info("[ComfyTV] migrated: comfytv_workflows + is_default")
        if "is_favorite" not in wf_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_workflows ADD COLUMN is_favorite BOOLEAN "
                    "NOT NULL DEFAULT 0"
                ))
                conn.execute(text(
                    "UPDATE comfytv_workflows SET is_favorite = 1 WHERE is_default = 1"
                ))
            logging.info("[ComfyTV] migrated: comfytv_workflows + is_favorite")
        if "is_hidden" not in wf_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_workflows ADD COLUMN is_hidden BOOLEAN "
                    "NOT NULL DEFAULT 0"
                ))
            logging.info("[ComfyTV] migrated: comfytv_workflows + is_hidden")
        if "meta_json" not in wf_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_workflows ADD COLUMN meta_json TEXT"
                ))
            logging.info("[ComfyTV] migrated: comfytv_workflows + meta_json")

        asset_cols = {c["name"] for c in insp.get_columns("comfytv_assets")}
        if "is_hidden" not in asset_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE comfytv_assets ADD COLUMN is_hidden BOOLEAN "
                    "NOT NULL DEFAULT 0"
                ))
            logging.info("[ComfyTV] migrated: comfytv_assets + is_hidden")
    except Exception as e:
        logging.warning("[ComfyTV] additive migration failed: %s", e)


def migrate_asset_autoincrement(engine) -> None:
    """Rebuild comfytv_assets with AUTOINCREMENT (SQLite cannot ALTER it in).

    Follows SQLite's create-copy-drop-rename recipe with foreign keys off, so
    comfytv_asset_category_links keeps pointing at comfytv_assets and its rows
    are neither cascaded away nor rewritten."""
    if engine.dialect.name != "sqlite":
        return
    raw = engine.raw_connection()
    dbapi = raw.driver_connection
    prev_isolation = dbapi.isolation_level
    dbapi.isolation_level = None
    try:
        cur = raw.cursor()
        row = cur.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='comfytv_assets'"
        ).fetchone()
        if row is None or "AUTOINCREMENT" in (row[0] or "").upper():
            return
        fk_on = cur.execute("PRAGMA foreign_keys").fetchone()[0]
        cur.execute("PRAGMA foreign_keys=OFF")
        try:
            table = Asset.__table__
            cols = ", ".join(c.name for c in table.columns)
            ddl = str(CreateTable(table).compile(engine)).replace(
                "CREATE TABLE comfytv_assets", "CREATE TABLE comfytv_assets_new", 1)
            cur.execute("BEGIN")
            cur.execute(ddl)
            cur.execute(f"INSERT INTO comfytv_assets_new ({cols}) SELECT {cols} FROM comfytv_assets")
            cur.execute("DROP TABLE comfytv_assets")
            cur.execute("ALTER TABLE comfytv_assets_new RENAME TO comfytv_assets")
            for index in table.indexes:
                cur.execute(
                    f"CREATE INDEX IF NOT EXISTS {index.name} ON comfytv_assets "
                    f"({', '.join(c.name for c in index.columns)})")
            bad = [
                r for t in Base.metadata.sorted_tables
                if any(fk.column.table is table for fk in t.foreign_keys)
                for r in cur.execute(f"PRAGMA foreign_key_check({t.name})").fetchall()
            ]
            if bad:
                raise RuntimeError(f"foreign key check failed: {bad[:5]}")
            cur.execute("COMMIT")
        except Exception:
            cur.execute("ROLLBACK")
            raise
        finally:
            cur.execute(f"PRAGMA foreign_keys={'ON' if fk_on else 'OFF'}")
        logging.info("[ComfyTV] migrated: comfytv_assets ids no longer reused (AUTOINCREMENT)")
    except Exception as e:
        logging.warning("[ComfyTV] asset id migration failed: %s", e)
    finally:
        dbapi.isolation_level = prev_isolation
        raw.close()
