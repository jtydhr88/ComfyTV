"""Unit tests for SplitPartStage's annotation parsing / invocation grouping."""

import json

import pytest


def _mod():
    from ComfyTV.nodes.stages import split_part
    return split_part


class TestParseParts:
    def test_empty_and_garbage(self):
        m = _mod()
        assert m._parse_parts("") == []
        assert m._parse_parts("{not json") == []
        assert m._parse_parts(json.dumps({"parts": "nope"})) == []

    def test_points_and_boxes(self):
        m = _mod()
        data = json.dumps({"parts": [
            {"kind": "points", "points": [{"x": 10, "y": 20, "label": 1},
                                          {"x": 30, "y": 40, "label": 0}]},
            {"kind": "box", "box": {"x": 1, "y": 2, "w": 100, "h": 50}},
            {"kind": "box", "box": {"x": 1, "y": 2, "w": 0, "h": 50}},   # zero-size dropped
            {"kind": "points", "points": []},                            # empty dropped
            "junk",
        ]})
        parts = m._parse_parts(data)
        assert [p["kind"] for p in parts] == ["points", "box"]

    def test_points_missing_coords_dropped(self):
        m = _mod()
        data = json.dumps({"parts": [
            {"kind": "points", "points": [{"x": 5}, {"x": 1, "y": 2}]},
        ]})
        parts = m._parse_parts(data)
        assert len(parts[0]["points"]) == 1


class TestPartInvocations:
    def test_boxes_share_one_invocation(self):
        m = _mod()
        parts = [
            {"kind": "box", "box": {"x": 0, "y": 0, "w": 10, "h": 10}},
            {"kind": "box", "box": {"x": 5, "y": 5, "w": 20, "h": 30}},
        ]
        inv = m._part_invocations(parts)
        assert len(inv) == 1
        assert inv[0]["bboxes"] == [
            {"x": 0, "y": 0, "width": 10, "height": 10},
            {"x": 5, "y": 5, "width": 20, "height": 30},
        ]

    def test_each_point_group_gets_own_invocation(self):
        m = _mod()
        parts = [
            {"kind": "points", "points": [{"x": 1, "y": 2, "label": 1}]},
            {"kind": "points", "points": [{"x": 3, "y": 4, "label": 1},
                                          {"x": 5, "y": 6, "label": 0}]},
        ]
        inv = m._part_invocations(parts)
        assert len(inv) == 2
        assert json.loads(inv[0]["points_pos"]) == [{"x": 1, "y": 2}]
        assert json.loads(inv[0]["points_neg"]) == []
        assert json.loads(inv[1]["points_pos"]) == [{"x": 3, "y": 4}]
        assert json.loads(inv[1]["points_neg"]) == [{"x": 5, "y": 6}]

    def test_mixed_boxes_first_then_point_groups(self):
        m = _mod()
        parts = [
            {"kind": "points", "points": [{"x": 1, "y": 2, "label": 1}]},
            {"kind": "box", "box": {"x": 0, "y": 0, "w": 10, "h": 10}},
        ]
        inv = m._part_invocations(parts)
        assert len(inv) == 2
        assert inv[0]["bboxes"]          # boxes run
        assert inv[1]["points_pos"]      # points run

    def test_no_parts(self):
        m = _mod()
        assert m._part_invocations([]) == []


class TestMaskCleanup:
    @pytest.fixture(autouse=True)
    def _deps(self):
        pytest.importorskip("numpy")
        pytest.importorskip("scipy")

    def _mask(self):
        import numpy as np
        b = np.zeros((200, 200), dtype=bool)
        b[20:180, 20:180] = True     # main body (25600 px)
        b[60:64, 60:64] = False      # small hole (16 px) → filled
        b[90:140, 90:140] = False    # big hole (2500 px) → kept
        b[2:6, 2:6] = True           # small island (16 px) → removed
        return b

    def test_cleanup_array_fills_and_prunes(self):
        m = _mod()
        cleaned = m._cleanup_mask_array(self._mask(), min_px=64)
        assert cleaned[62, 62]          # small hole filled
        assert not cleaned[100, 100]    # big hole preserved
        assert not cleaned[3, 3]        # small island removed
        assert cleaned[100, 21]         # body intact

    def test_cleanup_array_empty(self):
        import numpy as np
        m = _mod()
        b = np.zeros((10, 10), dtype=bool)
        assert not m._cleanup_mask_array(b, min_px=64).any()

    def test_mask_cleanup_node(self):
        pytest.importorskip("torch")
        import numpy as np
        import torch
        m = _mod()
        t = torch.from_numpy(self._mask().astype(np.float32))[None, ...]
        out = m.MaskCleanup.execute(t, min_region_frac=0.01)
        result = out.values[0]
        assert result.shape == t.shape
        assert result[0, 62, 62] == 1.0
        assert result[0, 100, 100] == 0.0


class TestMergeBatches:
    def test_reindexes_across_payloads(self):
        m = _mod()
        p1 = json.dumps({"images": [
            {"index": "1", "label": "#1", "image_url": "/view?filename=a.png"},
            {"index": "2", "label": "#2", "image_url": "/view?filename=b.png"},
        ]})
        p2 = json.dumps({"images": [
            {"index": "1", "label": "#1", "image_url": "/view?filename=c.png"},
        ]})
        merged = json.loads(m._merge_batches([p1, p2]))
        assert [it["image_url"] for it in merged["images"]] == [
            "/view?filename=a.png", "/view?filename=b.png", "/view?filename=c.png",
        ]
        assert [it["index"] for it in merged["images"]] == ["1", "2", "3"]

    def test_skips_bad_payloads(self):
        m = _mod()
        good = json.dumps({"images": [{"index": "1", "image_url": "/view?x=1"}]})
        merged = json.loads(m._merge_batches(["oops", good, ""]))
        assert len(merged["images"]) == 1
