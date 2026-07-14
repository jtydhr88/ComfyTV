from __future__ import annotations


class TestMergeCustomParams:
    def test_layering_defaults_attached_and_builtins(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common.invoke import _merge_custom_params
        storage.create_stage_param(kind="audio", label="Guidance", type="float", default=5.0)
        storage.create_stage_param(kind="audio", label="BPM", type="int", default=120)
        cp = '{"items":[{"key":"guidance","value":8.0}]}'
        merged = _merge_custom_params("audio", cp, {"duration_s": 30.0})
        assert merged["guidance"] == 8.0
        assert merged["bpm"] == 120
        assert merged["duration_s"] == 30.0

    def test_builtin_option_wins_on_key_clash(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common.invoke import _merge_custom_params
        storage.create_stage_param(kind="audio", label="duration_s", type="float", default=1.0)
        merged = _merge_custom_params("audio", "{}", {"duration_s": 30.0})
        assert merged["duration_s"] == 30.0

    def test_no_params_passes_options_through(self, reset_db):
        from ComfyTV.nodes.stages.common.invoke import _merge_custom_params
        assert _merge_custom_params("audio", "{}", {"x": 1}) == {"x": 1}
        assert _merge_custom_params("audio", None, {"x": 1}) == {"x": 1}

    def test_bad_json_ignored(self, reset_db):
        from ComfyTV.nodes.stages.common.invoke import _merge_custom_params
        assert _merge_custom_params("audio", "not json", {"x": 1}) == {"x": 1}

    def test_option_defaults_lose_to_everything(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common.invoke import _merge_custom_params
        defaults = {"max_length": 6144, "a": 1, "b": 2}
        merged = _merge_custom_params("storyboard", None, None, defaults)
        assert merged == defaults
        storage.create_stage_param(kind="storyboard", label="a", type="int", default=10)
        cp = '{"items":[{"key":"max_length","value":512}]}'
        merged = _merge_custom_params("storyboard", cp, {"b": 20}, defaults)
        assert merged["max_length"] == 512
        assert merged["a"] == 10
        assert merged["b"] == 20


class TestCapsMerge:
    def test_custom_key_and_seeded_builtins_in_caps(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common.caps import caps_payload
        storage.seed_system_stage_params()
        storage.create_stage_param(kind="audio", label="Guidance", type="float", default=5.0)
        caps = caps_payload()
        audio = caps["caps_by_kind"]["audio"]["option_keys"]
        assert "option:guidance" in audio
        assert "option:duration_s" in audio
        assert caps["option_labels"]["option:guidance"] == "Guidance"
        assert caps["option_labels"]["option:duration_s"] == "Stage duration (s)"

    def test_option_keys_empty_without_seeding(self, reset_db):
        from ComfyTV.nodes.stages.common.caps import caps_payload
        caps = caps_payload()
        assert caps["caps_by_kind"]["audio"]["option_keys"] == []
        assert caps["option_labels"] == {}

    def test_seeded_option_keys_match_static_vocabulary(self, reset_db):
        from ComfyTV import storage
        from ComfyTV.nodes.stages.common.caps import caps_payload, CAPS_BY_KIND
        storage.seed_system_stage_params()
        caps = caps_payload()
        for kind, static in CAPS_BY_KIND.items():
            assert set(caps["caps_by_kind"][kind]["option_keys"]) == set(static["option_keys"])
