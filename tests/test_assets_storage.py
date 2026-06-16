from __future__ import annotations


def _img(storage, name="pic", **kw):
    return storage.create_asset(
        name=name, payload_url=kw.pop("payload_url", f"/view?filename={name}.png&type=input"),
        **kw,
    )


class TestAssetCategories:
    def test_create_and_list(self, reset_db):
        from ComfyTV import storage
        a = storage.create_asset_category("人物")
        b = storage.create_asset_category("场景")
        assert a["name"] == "人物" and b["name"] == "场景"
        assert [c["name"] for c in storage.list_asset_categories()] == ["人物", "场景"]

    def test_duplicate_and_blank_rejected(self, reset_db):
        from ComfyTV import storage
        storage.create_asset_category("人物")
        assert storage.create_asset_category("人物") is None
        assert storage.create_asset_category("   ") is None

    def test_rename_and_clash(self, reset_db):
        from ComfyTV import storage
        a = storage.create_asset_category("人物")
        b = storage.create_asset_category("场景")
        assert storage.rename_asset_category(b["id"], "背景")["name"] == "背景"
        assert storage.rename_asset_category(b["id"], "人物") is None  # clashes with a
        assert storage.rename_asset_category(99999, "x") is None

    def test_delete_drops_tag_but_keeps_assets(self, reset_db):
        from ComfyTV import storage
        cat = storage.create_asset_category("人物")
        other = storage.create_asset_category("场景")
        a = _img(storage, "a", category_ids=[cat["id"], other["id"]])
        assert storage.delete_asset_category(cat["id"]) is True
        survived = next(r for r in storage.list_assets() if r["id"] == a["id"])
        assert survived["category_ids"] == [other["id"]]  # kept its other tag
        assert storage.delete_asset_category(99999) is False


class TestAssetCreate:
    def test_create_with_multiple_tags(self, reset_db):
        from ComfyTV import storage
        c1 = storage.create_asset_category("a")
        c2 = storage.create_asset_category("b")
        row = _img(storage, "multi", category_ids=[c1["id"], c2["id"]])
        assert row["category_ids"] == sorted([c1["id"], c2["id"]])

    def test_create_uncategorized(self, reset_db):
        from ComfyTV import storage
        assert _img(storage, "x")["category_ids"] == []

    def test_invalid_inputs_rejected(self, reset_db):
        from ComfyTV import storage
        assert storage.create_asset(name="x", payload_url="/v", media_type="video") is None
        assert storage.create_asset(name="x", payload_url="  ") is None
        assert storage.create_asset(name="x", payload_url="/v", category_ids=[9999]) is None


class TestAssetList:
    def test_list_all_newest_first(self, reset_db):
        from ComfyTV import storage
        a = _img(storage, "a")
        b = _img(storage, "b")
        assert [r["id"] for r in storage.list_assets()] == [b["id"], a["id"]]

    def test_list_by_category_includes_multi_tagged(self, reset_db):
        from ComfyTV import storage
        c = storage.create_asset_category("c")
        tagged = _img(storage, "tagged", category_ids=[c["id"]])
        _img(storage, "plain")
        assert [r["id"] for r in storage.list_assets(category_id=c["id"])] == [tagged["id"]]

    def test_list_uncategorized(self, reset_db):
        from ComfyTV import storage
        c = storage.create_asset_category("c")
        _img(storage, "tagged", category_ids=[c["id"]])
        plain = _img(storage, "plain")
        assert [r["id"] for r in storage.list_assets(uncategorized=True)] == [plain["id"]]


class TestAssetUpdate:
    def test_rename(self, reset_db):
        from ComfyTV import storage
        a = _img(storage, "a")
        assert storage.update_asset(a["id"], name="  new  ")["name"] == "new"

    def test_replace_and_clear_tags(self, reset_db):
        from ComfyTV import storage
        c1 = storage.create_asset_category("a")
        c2 = storage.create_asset_category("b")
        a = _img(storage, "a", category_ids=[c1["id"]])
        assert storage.update_asset(a["id"], category_ids=[c2["id"]])["category_ids"] == [c2["id"]]
        assert storage.update_asset(a["id"], category_ids=[])["category_ids"] == []

    def test_replace_with_bad_tag_rejected(self, reset_db):
        from ComfyTV import storage
        a = _img(storage, "a")
        assert storage.update_asset(a["id"], category_ids=[9999]) is None
        assert storage.update_asset(99999, name="x") is None


class TestAssetTagToggle:
    def test_add_is_idempotent_and_sorted(self, reset_db):
        from ComfyTV import storage
        c1 = storage.create_asset_category("a")
        c2 = storage.create_asset_category("b")
        a = _img(storage, "a")
        assert storage.add_asset_category(a["id"], c1["id"])["category_ids"] == [c1["id"]]
        assert storage.add_asset_category(a["id"], c1["id"])["category_ids"] == [c1["id"]]  # idempotent
        assert storage.add_asset_category(a["id"], c2["id"])["category_ids"] == sorted([c1["id"], c2["id"]])

    def test_add_invalid_rejected(self, reset_db):
        from ComfyTV import storage
        a = _img(storage, "a")
        assert storage.add_asset_category(a["id"], 9999) is None
        assert storage.add_asset_category(99999, 1) is None

    def test_remove_and_noop(self, reset_db):
        from ComfyTV import storage
        c1 = storage.create_asset_category("a")
        c2 = storage.create_asset_category("b")
        a = _img(storage, "a", category_ids=[c1["id"], c2["id"]])
        assert storage.remove_asset_category(a["id"], c1["id"])["category_ids"] == [c2["id"]]
        # removing a tag it no longer has is a no-op
        assert storage.remove_asset_category(a["id"], c1["id"])["category_ids"] == [c2["id"]]
        assert storage.remove_asset_category(99999, c1["id"]) is None


class TestAssetDelete:
    def test_delete_removes_row_and_links(self, reset_db):
        from ComfyTV import storage
        c = storage.create_asset_category("c")
        a = _img(storage, "a", category_ids=[c["id"]])
        assert storage.delete_asset(a["id"]) is True
        assert storage.delete_asset(a["id"]) is False
        assert storage.list_assets() == []

        assert storage.list_assets(category_id=c["id"]) == []
