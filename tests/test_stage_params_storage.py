from __future__ import annotations


def _mk(storage, kind="audio", label="Guidance", type="float", **kw):
    return storage.create_stage_param(kind=kind, label=label, type=type, **kw)


class TestStageParamCreate:
    def test_create_basic(self, reset_db):
        from ComfyTV import storage
        row = _mk(storage, label="Guidance", type="float", default=5.0,
                  config={"min": 0, "max": 10, "step": 0.5})
        assert row is not None
        assert row["kind"] == "audio"
        assert row["key"] == "guidance"
        assert row["type"] == "float"
        assert row["default"] == 5.0
        assert row["config"] == {"min": 0, "max": 10, "step": 0.5}
        assert row["origin"] == 1  # user

    def test_key_slugified_and_deduped(self, reset_db):
        from ComfyTV import storage
        a = _mk(storage, label="Top P", type="float")
        b = _mk(storage, label="Top P", type="float")  # same label, same kind
        assert a["key"] == "top_p"
        assert b["key"] == "top_p_2"

    def test_same_label_different_kind_keeps_key(self, reset_db):
        from ComfyTV import storage
        a = _mk(storage, kind="audio", label="Strength", type="float")
        b = _mk(storage, kind="image", label="Strength", type="float")
        assert a["key"] == "strength"
        assert b["key"] == "strength"

    def test_invalid_inputs_rejected(self, reset_db):
        from ComfyTV import storage
        assert _mk(storage, label="", type="float") is None
        assert _mk(storage, label="X", type="tensor") is None
        assert storage.create_stage_param(kind="", label="X", type="int") is None

    def test_all_supported_types(self, reset_db):
        from ComfyTV import storage
        for t in ("boolean", "int", "float", "string", "combo"):
            row = _mk(storage, label=f"p_{t}", type=t)
            assert row is not None and row["type"] == t


class TestStageParamList:
    def test_list_filtered_by_kind_and_ordered(self, reset_db):
        from ComfyTV import storage
        _mk(storage, kind="audio", label="A")
        _mk(storage, kind="audio", label="B")
        _mk(storage, kind="image", label="C")
        audio = storage.list_stage_params("audio")
        assert [p["label"] for p in audio] == ["A", "B"]
        assert len(storage.list_stage_params()) == 3


class TestStageParamUpdateDelete:
    def test_update_fields(self, reset_db):
        from ComfyTV import storage
        row = _mk(storage, label="Guidance", type="float", default=5.0)
        upd = storage.update_stage_param(row["id"], label="CFG", default=7.0,
                                         config={"min": 1})
        assert upd["label"] == "CFG"
        assert upd["default"] == 7.0
        assert upd["config"] == {"min": 1}
        assert upd["key"] == "guidance"  # key is stable across rename

    def test_default_can_be_cleared(self, reset_db):
        from ComfyTV import storage
        row = _mk(storage, default=5.0)
        upd = storage.update_stage_param(row["id"], default=None)
        assert upd["default"] is None

    def test_update_missing_returns_none(self, reset_db):
        from ComfyTV import storage
        assert storage.update_stage_param(9999, label="x") is None

    def test_delete(self, reset_db):
        from ComfyTV import storage
        row = _mk(storage)
        assert storage.delete_stage_param(row["id"]) is True
        assert storage.list_stage_params("audio") == []
        assert storage.delete_stage_param(row["id"]) is False


class TestStageParamSystemOrigin:
    def test_system_rows_are_read_only(self, reset_db):
        from ComfyTV import storage
        sys_row = storage.create_stage_param(
            kind="audio", label="Duration", type="float", default=30.0, origin=0,
        )
        assert sys_row["origin"] == 0
        assert storage.update_stage_param(sys_row["id"], label="X") is None
        assert storage.delete_stage_param(sys_row["id"]) is False
