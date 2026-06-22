import importlib
import os
import sys
import types

PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

pkg = types.ModuleType("ctv")
pkg.__path__ = [PLUGIN_DIR]
sys.modules["ctv"] = pkg

db = importlib.import_module("ctv.db")

from sqlalchemy import create_engine          # noqa: E402
from sqlalchemy.orm import sessionmaker       # noqa: E402

engine = create_engine("sqlite:///:memory:")
db.Base.metadata.create_all(engine)
db._engine = engine
db._Session = sessionmaker(bind=engine, expire_on_commit=False)

storage = importlib.import_module("ctv.storage")


def check(name, cond):
    status = "ok" if cond else "FAIL"
    print(f"  [{status}] {name}")
    if not cond:
        sys.exit(1)


print("asset categories:")
cat = storage.create_asset_category("人物")
check("create category", cat is not None and cat["name"] == "人物")
check("duplicate name rejected", storage.create_asset_category("人物") is None)
check("blank name rejected", storage.create_asset_category("   ") is None)
cat2 = storage.create_asset_category("场景")
check("list", [c["name"] for c in storage.list_asset_categories()] == ["人物", "场景"])
check("rename", storage.rename_asset_category(cat2["id"], "背景")["name"] == "背景")
check("rename clash rejected", storage.rename_asset_category(cat2["id"], "人物") is None)

cat3 = storage.create_asset_category("道具")

print("assets:")
a = storage.create_asset(
    name="角色设定", payload_url="/view?filename=a.png&type=input",
    category_ids=[cat["id"], cat3["id"]], mime_type="image/png",
    width=512, height=768, size_bytes=1234, source="upload",
)
check("create with multiple tags",
      a is not None and a["category_ids"] == sorted([cat["id"], cat3["id"]]))
b = storage.create_asset(name="散图", payload_url="/view?filename=b.png&type=input")
check("create uncategorized", b is not None and b["category_ids"] == [])
check("bad media_type rejected",
      storage.create_asset(name="x", payload_url="/v", media_type="model") is None)
check("video media_type accepted",
      storage.create_asset(name="v", payload_url="/v.mp4", media_type="video") is not None)
check("audio media_type accepted",
      storage.create_asset(name="a", payload_url="/a.mp3", media_type="audio") is not None)
check("missing payload rejected", storage.create_asset(name="x", payload_url=" ") is None)
check("bad category rejected",
      storage.create_asset(name="x", payload_url="/v", category_ids=[9999]) is None)

check("list all (newest first)", [r["id"] for r in storage.list_assets()] == [b["id"], a["id"]])
check("list by category", [r["id"] for r in storage.list_assets(category_id=cat["id"])] == [a["id"]])
check("list by other tag", [r["id"] for r in storage.list_assets(category_id=cat3["id"])] == [a["id"]])
check("list uncategorized", [r["id"] for r in storage.list_assets(uncategorized=True)] == [b["id"]])

check("rename asset", storage.update_asset(a["id"], name=" 新名字 ")["name"] == "新名字")

print("tag add/remove:")
check("add tag", storage.add_asset_category(b["id"], cat["id"])["category_ids"] == [cat["id"]])
check("add tag idempotent",
      storage.add_asset_category(b["id"], cat["id"])["category_ids"] == [cat["id"]])
check("add second tag",
      storage.add_asset_category(b["id"], cat3["id"])["category_ids"] == sorted([cat["id"], cat3["id"]]))
check("add bad tag rejected", storage.add_asset_category(b["id"], 9999) is None)
check("add tag to missing asset rejected", storage.add_asset_category(9999, cat["id"]) is None)
check("remove tag", storage.remove_asset_category(b["id"], cat["id"])["category_ids"] == [cat3["id"]])
check("remove untagged is no-op",
      storage.remove_asset_category(b["id"], cat["id"])["category_ids"] == [cat3["id"]])

print("update replaces the whole tag set:")
check("set tags", storage.update_asset(b["id"], category_ids=[cat["id"]])["category_ids"] == [cat["id"]])
check("clear tags", storage.update_asset(b["id"], category_ids=[])["category_ids"] == [])
check("set bad tag rejected", storage.update_asset(b["id"], category_ids=[9999]) is None)

print("category delete drops the tag only:")
check("delete category", storage.delete_asset_category(cat["id"]) is True)
check("tag removed from asset", storage.list_assets(category_id=cat3["id"])[0]["id"] == a["id"])
check("asset survives, keeps other tags",
      storage.list_assets()[1]["id"] == a["id"]
      and storage.list_assets()[1]["category_ids"] == [cat3["id"]])
check("delete missing category", storage.delete_asset_category(9999) is False)

check("delete asset", storage.delete_asset(a["id"]) is True)
check("delete missing asset", storage.delete_asset(a["id"]) is False)
check("remaining", [r["id"] for r in storage.list_assets()] == [b["id"]])

print("all good")
