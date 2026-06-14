"""Tests for nodes/stages/_common.py — pure helper functions.

Stage class bodies themselves use io.ComfyNode + Schema and require a live
V3 framework to actually execute; we test only the pure helpers that drive
those classes' prompt building, storyboard parsing, payload shaping, etc."""

from __future__ import annotations

import json
import pytest

from ComfyTV.nodes.stages import _common as c


# ─── _seed / _autogrow_values / _combine_prompt ──────────────────────────────

class TestSeed:
    def test_stable_for_same_inputs(self):
        assert c._seed("a", 1, "b") == c._seed("a", 1, "b")

    def test_different_for_different_inputs(self):
        assert c._seed("a") != c._seed("b")

    def test_handles_unprintable(self):
        # repr() in _seed handles None / objects without issue.
        assert isinstance(c._seed(None, object()), int)


class TestAutogrowValues:
    def test_none(self):
        assert c._autogrow_values(None) == []

    def test_dict_like(self):
        class D:
            def values(self):
                return [1, None, 2, 3]
        assert c._autogrow_values(D()) == [1, 2, 3]

    def test_list_passthrough(self):
        assert c._autogrow_values([1, 2, 3]) == [1, 2, 3]

    def test_tuple_passthrough(self):
        assert c._autogrow_values((1, 2)) == [1, 2]

    def test_single_value_wrapped(self):
        # Non-iterable, non-None → wrapped as a single-item list.
        assert c._autogrow_values(42) == [42]


class TestCombinePrompt:
    def test_basic(self):
        assert c._combine_prompt("main", ["a", "b"]) == "main, a, b"

    def test_skip_empty(self):
        assert c._combine_prompt("main", ["", None, "x", "  "]) == "main, x"

    def test_no_main(self):
        assert c._combine_prompt("", ["a", "b"]) == "a, b"

    def test_custom_separator(self):
        assert c._combine_prompt("a", ["b"], sep=" | ") == "a | b"

    def test_none_main(self):
        assert c._combine_prompt(None, ["a"]) == "a"  # type: ignore[arg-type]

    def test_all_empty(self):
        assert c._combine_prompt("", []) == ""


# ─── _fake_text / _fake_image / _fake_video / _fake_audio ────────────────────

class TestFakeMedia:
    def test_fake_text_passthrough(self):
        assert c._fake_text("  hi  ") == "hi"
        assert c._fake_text("") == ""

    def test_fake_image_url_format(self):
        url = c._fake_image("a", "b", w=320, h=180)
        assert url.startswith("https://picsum.photos/seed/")
        assert url.endswith("/320/180")

    def test_fake_image_deterministic(self):
        assert c._fake_image("a") == c._fake_image("a")

    def test_fake_video_returns_known_url(self):
        url = c._fake_video("a")
        assert url in c._VIDEO_SAMPLES

    def test_fake_audio_returns_known_url(self):
        url = c._fake_audio("a")
        assert url in c._AUDIO_SAMPLES


# ─── _parse_shotlist_text / _shape_storyboard_from_llm ───────────────────────

class TestParseShotlist:
    def test_empty(self):
        assert c._parse_shotlist_text("") == []
        assert c._parse_shotlist_text(None) == []  # type: ignore[arg-type]

    def test_minimal_two_shots(self):
        txt = (
            "镜号: 1\n时长: 4\n画面描述: 第一镜\n"
            "镜号: 2\n时长: 5\n画面描述: 第二镜\n"
        )
        rows = c._parse_shotlist_text(txt)
        assert len(rows) == 2
        assert rows[0]["shot_no"] == "1"
        assert rows[1]["shot_no"] == "2"
        assert rows[0]["scene_purpose"] == "第一镜"
        assert rows[1]["duration"] == "5"

    def test_fullwidth_colon_currently_not_parsed(self):
        # Despite the docstring claim of tolerance, the shot_no regex is
        # `^\s*镜号\s*[::]` with only ASCII colons in the bracket — fullwidth
        # input doesn't actually match. This test pins the current behavior
        # so a future fix is visible as a test break.
        txt = "镜号：1\n时长：4\n画面描述：测试"
        rows = c._parse_shotlist_text(txt)
        assert rows == []

    def test_strips_think_wrapper(self):
        txt = "<think>preamble</think>\n镜号: 1\n时长: 4\n画面描述: x"
        rows = c._parse_shotlist_text(txt)
        assert len(rows) == 1

    def test_picks_largest_markdown_fence(self):
        # Two fenced blocks — the parser picks the longest containing 镜号.
        txt = (
            "irrelevant header\n"
            "```\nshort prose\n```\n"
            "some prose\n"
            "```\n镜号: 1\n时长: 4\n画面描述: long fenced block\n```\n"
        )
        rows = c._parse_shotlist_text(txt)
        assert len(rows) == 1
        assert "long fenced" in rows[0]["scene_purpose"]

    def test_continuation_lines_join_to_prior_field(self):
        txt = "镜号: 1\n时长: 4\n画面描述: line1\n  continuation\n"
        rows = c._parse_shotlist_text(txt)
        assert "continuation" in rows[0]["scene_purpose"]

    def test_no_shot_no_returns_empty(self):
        # Rows without 镜号 don't make the cut.
        txt = "画面描述: only purpose, no shot_no"
        assert c._parse_shotlist_text(txt) == []


class TestShapeStoryboard:
    def test_basic_shape(self):
        txt = "镜号: 1\n时长: 4\n画面描述: x\n分镜提示词: prompt1\n"
        shaped = c._shape_storyboard_from_llm(txt)
        assert shaped is not None
        data = json.loads(shaped)
        assert data["shots"][0]["shot_no"] == "1"
        assert data["shots"][0]["prompt"] == "prompt1"

    def test_duration_normalized(self):
        txt = "镜号: 1\n时长: 4\n画面描述: x\n"
        data = json.loads(c._shape_storyboard_from_llm(txt))
        assert data["shots"][0]["duration"] == "4s"

    def test_duration_default_when_missing(self):
        txt = "镜号: 1\n画面描述: x\n"
        data = json.loads(c._shape_storyboard_from_llm(txt))
        # Default formula: f"{2 + (i % 4)}s" — i=0 → "2s"
        assert data["shots"][0]["duration"] == "2s"

    def test_falls_back_to_scene_purpose_for_prompt(self):
        txt = "镜号: 1\n时长: 4\n画面描述: only purpose\n"
        data = json.loads(c._shape_storyboard_from_llm(txt))
        assert data["shots"][0]["prompt"] == "only purpose"

    def test_returns_none_on_empty(self):
        assert c._shape_storyboard_from_llm("") is None
        assert c._shape_storyboard_from_llm("no shots here") is None


# ─── _fake_storyboard / _fake_image_batch_from_storyboard ────────────────────

class TestFakeStoryboard:
    def test_shape(self):
        out = json.loads(c._fake_storyboard("seed"))
        assert isinstance(out["shots"], list)
        assert 4 <= len(out["shots"]) <= 7
        shot = out["shots"][0]
        assert {"shot_no", "duration", "scene_purpose", "character", "prompt"} <= set(shot)

    def test_no_character_desc_when_no_character(self):
        # We seed in a way that may or may not pick "无". Just sanity:
        # the rule is "no desc if character == 无".
        out = json.loads(c._fake_storyboard("x"))
        for shot in out["shots"]:
            if shot["character"] == "无":
                assert shot["character_desc"] == ""


class TestFakeImageBatchFromStoryboard:
    def test_from_json_string(self):
        sb = json.dumps({"shots": [
            {"shot_no": "1", "prompt": "p1"},
            {"shot_no": "2", "prompt": "p2"},
        ]})
        out = json.loads(c._fake_image_batch_from_storyboard(sb, "s"))
        assert len(out["images"]) == 2
        assert out["images"][0]["prompt"] == "p1"

    def test_from_dict(self):
        sb = {"shots": [{"shot_no": "9", "prompt": "p"}]}
        out = json.loads(c._fake_image_batch_from_storyboard(sb, "s"))
        assert out["images"][0]["index"] == "9"

    def test_empty_storyboard(self):
        out = json.loads(c._fake_image_batch_from_storyboard("", "s"))
        assert out["images"] == []

    def test_invalid_storyboard(self):
        out = json.loads(c._fake_image_batch_from_storyboard("not json", "s"))
        assert out["images"] == []

    def test_storyboard_without_shots(self):
        out = json.loads(c._fake_image_batch_from_storyboard("{}", "s"))
        assert out["images"] == []


class TestFakeImageVariations:
    def test_basic(self):
        out = json.loads(c._fake_image_variations("src", 3, "seed"))
        assert len(out["images"]) == 3
        assert out["images"][0]["label"] == "#1"

    def test_clamps_minimum_one(self):
        out = json.loads(c._fake_image_variations("src", 0, "s"))
        assert len(out["images"]) == 1

    def test_none_count_clamped(self):
        out = json.loads(c._fake_image_variations("src", None, "s"))
        assert len(out["images"]) == 1


class TestFakePanoramaViews:
    def test_count_4_named_views(self):
        out = json.loads(c._fake_panorama_views("p", 4, "s"))
        labels = [img["label"] for img in out["images"]]
        assert labels == c._PANORAMA_VIEW_LABELS_4

    def test_count_other_generic_labels(self):
        out = json.loads(c._fake_panorama_views("p", 6, "s"))
        assert out["images"][5]["label"] == "View 6"

    def test_minimum_one(self):
        out = json.loads(c._fake_panorama_views("p", 0, "s"))
        assert len(out["images"]) == 1


# ─── _input_file_url ─────────────────────────────────────────────────────────

class TestInputFileUrl:
    def test_empty(self):
        assert c._input_file_url("") == ""

    def test_no_subfolder(self):
        url = c._input_file_url("a.png")
        assert "filename=a.png" in url
        assert "type=input" in url
        assert "subfolder" not in url

    def test_with_subfolder(self):
        url = c._input_file_url("folder/sub/img.png")
        assert "filename=img.png" in url
        assert "subfolder=folder%2Fsub" in url


# ─── _pick_image_from_batch ──────────────────────────────────────────────────

class TestPickImageFromBatch:
    def _batch(self):
        return json.dumps({"images": [
            {"index": "1", "image_url": "url1"},
            {"index": "2", "image_url": "url2"},
            {"index": "5", "image_url": "url5"},
        ]})

    def test_by_index_string(self):
        assert c._pick_image_from_batch(self._batch(), 5) == "url5"

    def test_by_position_fallback(self):
        # Position-based when index doesn't match — but since "1" matches "1",
        # this returns url1. Test with a batch lacking index match:
        batch = json.dumps({"images": [
            {"index": "a", "image_url": "u1"},
            {"index": "b", "image_url": "u2"},
        ]})
        assert c._pick_image_from_batch(batch, 2) == "u2"

    def test_out_of_range(self):
        assert c._pick_image_from_batch(self._batch(), 99) == ""

    def test_zero_or_negative(self):
        assert c._pick_image_from_batch(self._batch(), 0) == ""
        assert c._pick_image_from_batch(self._batch(), -1) == ""

    def test_dict_passed_directly(self):
        d = {"images": [{"index": "1", "image_url": "url1"}]}
        assert c._pick_image_from_batch(d, 1) == "url1"

    def test_invalid_json(self):
        assert c._pick_image_from_batch("not json", 1) == ""

    def test_no_images_key(self):
        assert c._pick_image_from_batch("{}", 1) == ""

    def test_images_not_list(self):
        assert c._pick_image_from_batch('{"images": "x"}', 1) == ""


# ─── _multiangle_prompt ──────────────────────────────────────────────────────

class TestMultiangleprompt:
    def test_front_eye_close(self):
        p = c._multiangle_prompt(0, 0, 10.0)
        assert "front view" in p
        assert "eye-level shot" in p
        assert "close-up" in p

    def test_side_low_wide(self):
        p = c._multiangle_prompt(90, -30, 0)
        assert "right side view" in p
        assert "low-angle shot" in p
        assert "wide shot" in p

    def test_back_high_medium(self):
        p = c._multiangle_prompt(180, 60, 5)
        assert "back view" in p
        assert "high-angle shot" in p
        assert "medium shot" in p

    def test_azimuth_wraparound(self):
        # 350° wraps to nearest of (0=front, 315=front-left) — 350 is closer to 0.
        p = c._multiangle_prompt(350, 0, 5)
        assert "front view" in p

    def test_extra_appended(self):
        p = c._multiangle_prompt(0, 0, 5, extra="natural lighting")
        assert p.endswith("natural lighting")

    def test_no_extra(self):
        p = c._multiangle_prompt(0, 0, 5)
        assert not p.endswith(", ")

    def test_elevation_buckets(self):
        # boundary checks: ≤-15 / -14..15 / 16..45 / >45
        assert "low-angle"   in c._multiangle_prompt(0, -15, 5)
        assert "eye-level"   in c._multiangle_prompt(0, 0,   5)
        assert "eye-level"   in c._multiangle_prompt(0, 15,  5)
        assert "elevated"    in c._multiangle_prompt(0, 30,  5)
        assert "high-angle"  in c._multiangle_prompt(0, 60,  5)


# ─── _relight_prompt ─────────────────────────────────────────────────────────

class TestRelightPrompt:
    def test_no_reference_low_brightness(self):
        p = c._relight_prompt(20, "#ffffff", False)
        assert "relight the image" in p
        assert "dim, low-light" in p

    def test_with_reference(self):
        p = c._relight_prompt(50, "#ffffff", False, has_reference=True)
        assert "transfer the lighting from the reference" in p

    def test_brightness_buckets(self):
        # <25 / 25-49 / 50-74 / >=75
        assert "dim, low-light"      in c._relight_prompt(0,   "#fff", False)
        assert "soft, muted"         in c._relight_prompt(40,  "#fff", False)
        assert "bright, natural"     in c._relight_prompt(60,  "#fff", False)
        assert "bright, high-key"    in c._relight_prompt(90,  "#fff", False)

    def test_color_tint_skipped_for_white(self):
        p = c._relight_prompt(50, "#ffffff", False)
        assert "tinted" not in p

    def test_color_tint_added(self):
        p = c._relight_prompt(50, "#FF0000", False)
        assert "tinted with light color #ff0000" in p

    def test_rim_light(self):
        p = c._relight_prompt(50, "#fff", True)
        assert "rim light" in p

    def test_extra_appended(self):
        p = c._relight_prompt(50, "#fff", False, extra="cinematic mood")
        assert "cinematic mood" in p

    def test_default_color_handling(self):
        p = c._relight_prompt(50, "", False)
        assert "tinted" not in p

    def test_none_brightness_defaults(self):
        p = c._relight_prompt(None, "#fff", False)  # type: ignore[arg-type]
        # None → 50 → "bright, natural" bucket
        assert "bright, natural" in p


# ─── _storyboard_llm_prompt ──────────────────────────────────────────────────

class TestStoryboardLlmPrompt:
    def test_includes_premise(self):
        p = c._storyboard_llm_prompt("a journey", total_duration_s=30, shot_count=6)
        assert "a journey" in p
        assert "30" in p
        assert "分镜数:6" in p

    def test_default_premise(self):
        p = c._storyboard_llm_prompt("")
        assert "一段短片" in p

    def test_default_characters(self):
        p = c._storyboard_llm_prompt("x")
        assert "(无指定角色)" in p

    def test_characters_passed_through(self):
        p = c._storyboard_llm_prompt("x", characters="- alice (20)")
        assert "alice" in p


# ─── STAGE_META + _stage_emit_auto resolve ───────────────────────────────────

class TestStageMeta:
    def test_known_classes(self):
        # Some kinds we know must exist
        assert c.STAGE_META["ImageStage"]["kind"] == "image-batch"
        assert c.STAGE_META["VideoStage"]["kind"] == "video"
        assert c.STAGE_META["ProjectStage"]["kind"] == "project"

    def test_image_batch_kind_aliases_to_images_output_type(self):
        # Internal map: kind=image-batch → output_type=images. Verify via the
        # lookup table directly.
        assert c._KIND_TO_OUTPUT_TYPE["image-batch"] == "images"

    def test_image_picker_kind_aliases_to_image_output_type(self):
        assert c._KIND_TO_OUTPUT_TYPE["image-picker"] == "image"


# ─── _persist via mocked storage ─────────────────────────────────────────────

class TestPersistHelper:
    def test_persist_uses_class_name(self, reset_db, monkeypatch):
        from ComfyTV import storage
        captured = {}

        def fake_persist(**kw):
            captured.update(kw)
            return {"id": 42}

        monkeypatch.setattr(storage, "persist_output", fake_persist)

        # `class.__name__` is read-only at class-def time, so we build a
        # synthetic class via type() to control the name attribute.
        FakeCls = type("TestStage", (), {
            "hidden": type("H", (), {"unique_id": 7})(),
        })

        out = c._persist(
            cls=FakeCls, project_id="proj", output_type="image",
            payload_url="url", parent_output_id=3,
        )
        assert out == 42
        assert captured["stage_class"] == "TestStage"
        assert captured["stage_node_id"] == "7"
        assert captured["parent_output_id"] == 3

    def test_persist_swallows_exceptions(self, monkeypatch):
        from ComfyTV import storage
        def boom(**_):
            raise RuntimeError("db down")
        monkeypatch.setattr(storage, "persist_output", boom)

        class FakeCls:
            __name__ = "TestStage"
        # Must return None instead of raising.
        assert c._persist(cls=FakeCls, project_id="", output_type="image",
                          payload_url="") is None

    def test_persist_no_hidden(self, monkeypatch):
        from ComfyTV import storage
        captured = {}
        monkeypatch.setattr(storage, "persist_output",
                            lambda **kw: captured.update(kw) or {"id": 1})

        class FakeCls:
            __name__ = "X"
        c._persist(cls=FakeCls, project_id="", output_type="image",
                   payload_url="")
        assert captured["stage_node_id"] is None

    def test_persist_strips_clone_suffix(self, monkeypatch):
        from ComfyTV import storage
        captured = {}
        monkeypatch.setattr(storage, "persist_output",
                            lambda **kw: captured.update(kw) or {"id": 1})
        FakeCls = type("ImageStageClone", (), {})
        c._persist(cls=FakeCls, project_id="", output_type="image", payload_url="")
        assert captured["stage_class"] == "ImageStage"


class TestStageEmitAutoOutputType:
    def test_clone_named_class_resolves_real_output_type(self, monkeypatch):
        from ComfyTV import storage
        captured = {}
        monkeypatch.setattr(storage, "persist_output",
                            lambda **kw: captured.update(kw) or {"id": 1})
        monkeypatch.setattr(c, "_emit_progress", lambda *a, **k: None)

        FakeCls = type("ImageStageClone", (), {
            "hidden": type("H", (), {"unique_id": 1})(),
        })
        c._stage_emit_auto(FakeCls, project_id="default",
                           payload_str='{"images": []}', emit_ui=False)
        assert captured["output_type"] == "images"
        assert captured["stage_class"] == "ImageStage"

    def test_json_payload_passed_as_parsed_object(self, monkeypatch):
        from ComfyTV import storage
        captured = {}
        monkeypatch.setattr(storage, "persist_output",
                            lambda **kw: captured.update(kw) or {"id": 1})
        monkeypatch.setattr(c, "_emit_progress", lambda *a, **k: None)
        FakeCls = type("ImageStageClone", (), {
            "hidden": type("H", (), {"unique_id": 1})(),
        })
        c._stage_emit_auto(FakeCls, project_id="default",
                           payload_str='{"images": [{"index": "1"}]}', emit_ui=False)
        assert captured["payload_json"] == {"images": [{"index": "1"}]}
        assert captured["payload_url"] == ""
