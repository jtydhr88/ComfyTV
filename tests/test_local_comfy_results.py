from __future__ import annotations

import json
import pytest

from ComfyTV.runners import local_comfy as lc


# ─── _view_url + _save_files_from ────────────────────────────────────────────

class TestSaveFilesFrom:
    def test_images_key(self):
        out = {"images": [{"filename": "a.png", "subfolder": "", "type": "output"}]}
        files = lc._save_files_from(out)
        assert files == [{"filename": "a.png", "subfolder": "", "type": "output"}]

    def test_audio_key(self):
        out = {"audio": [{"filename": "a.mp3", "subfolder": "", "type": "output"}]}
        assert lc._save_files_from(out)[0]["filename"] == "a.mp3"

    def test_videos_key(self):
        out = {"videos": [{"filename": "a.mp4", "subfolder": "", "type": "output"}]}
        assert lc._save_files_from(out)[0]["filename"] == "a.mp4"

    def test_gifs_key(self):
        out = {"gifs": [{"filename": "a.gif", "subfolder": "", "type": "output"}]}
        assert lc._save_files_from(out)[0]["filename"] == "a.gif"

    def test_empty(self):
        assert lc._save_files_from({}) == []
        assert lc._save_files_from(None) == []  # type: ignore[arg-type]

    def test_non_dict(self):
        assert lc._save_files_from("nope") == []  # type: ignore[arg-type]

    def test_first_nonempty_wins(self):
        # both images (empty) and audio (present) — audio wins because images is empty.
        out = {"images": [], "audio": [{"filename": "a.mp3"}]}
        assert lc._save_files_from(out)[0]["filename"] == "a.mp3"


class TestViewUrl:
    def test_basic(self):
        url = lc._view_url("a.png", "sub", "output")
        assert "filename=a.png" in url
        assert "subfolder=sub" in url
        assert "type=output" in url
        assert url.startswith("/view?")


# ─── _split_runner_id ────────────────────────────────────────────────────────

class TestSplitRunnerId:
    def test_simple(self):
        assert lc._split_runner_id("image/local-sd15") == ("image", "local-sd15")

    def test_slash_in_label(self):
        # First slash only.
        assert lc._split_runner_id("image/Local SD 1.5") == ("image", "Local SD 1.5")

    def test_no_slash_raises(self):
        with pytest.raises(RuntimeError, match="must be 'kind/name'"):
            lc._split_runner_id("nodash")


# ─── _extract_result ─────────────────────────────────────────────────────────

class _FakeExecutor:
    def __init__(self, history_outputs):
        self.history_result = {"outputs": history_outputs}


@pytest.mark.asyncio
class TestExtractResult:
    async def test_ui_save_url(self):
        ex = _FakeExecutor({
            "9": {"images": [
                {"filename": "out.png", "subfolder": "", "type": "output"},
            ]},
        })
        url = await lc._extract_result(ex, {"type": "ui_save_url", "node": "9"})
        assert "filename=out.png" in url

    async def test_ui_save_url_no_files_raises(self):
        ex = _FakeExecutor({"9": {}})
        with pytest.raises(RuntimeError, match="produced no files"):
            await lc._extract_result(ex, {"type": "ui_save_url", "node": "9"})

    async def test_ui_save_url_audio_node(self):
        # Confirm the audio key path inside _save_files_from is reached.
        ex = _FakeExecutor({
            "59": {"audio": [
                {"filename": "song.mp3", "subfolder": "", "type": "output"},
            ]},
        })
        url = await lc._extract_result(ex, {"type": "ui_save_url", "node": "59"})
        assert "filename=song.mp3" in url

    async def test_ui_save_batch(self):
        ex = _FakeExecutor({
            "9": {"images": [
                {"filename": "a.png", "subfolder": "", "type": "output"},
                {"filename": "b.png", "subfolder": "", "type": "output"},
            ]},
        })
        payload = await lc._extract_result(ex, {"type": "ui_save_batch", "node": "9"})
        data = json.loads(payload)
        assert len(data["images"]) == 2
        assert data["images"][0]["label"] == "#1"
        assert "filename=a.png" in data["images"][0]["image_url"]

    async def test_ui_save_batch_aggregates_multiple_save_nodes(self):
        ex = _FakeExecutor({
            "9":  {"images": [{"filename": "a.png", "subfolder": "", "type": "output"}]},
            "10": {"images": [{"filename": "b.png", "subfolder": "", "type": "output"}]},
        })
        payload = await lc._extract_result(ex, {"type": "ui_save_batch", "node": "9"})
        data = json.loads(payload)
        assert len(data["images"]) == 2

    async def test_ui_save_batch_no_files_raises(self):
        ex = _FakeExecutor({"9": {}})
        with pytest.raises(RuntimeError, match="produced no image files"):
            await lc._extract_result(ex, {"type": "ui_save_batch", "node": "9"})

    async def test_missing_node_raises(self):
        with pytest.raises(RuntimeError, match="result.node is required"):
            await lc._extract_result(_FakeExecutor({}), {"type": "ui_save_url"})

    async def test_unsupported_type_raises(self):
        ex = _FakeExecutor({})
        with pytest.raises(RuntimeError, match="unsupported result.type"):
            await lc._extract_result(ex, {"type": "weird", "node": "9"})


# ─── _output_node_ids ────────────────────────────────────────────────────────

class TestOutputNodeIds:
    def test_collects_hinted_plus_output_nodes(self, monkeypatch):
        import nodes as cn

        class _SaveLike:
            OUTPUT_NODE = True

        class _Plain:
            OUTPUT_NODE = False

        monkeypatch.setattr(cn, "NODE_CLASS_MAPPINGS", {
            "SaveImage": _SaveLike,
            "PreviewImage": _SaveLike,
            "KSampler": _Plain,
        })

        prompt = {
            "9":  {"class_type": "SaveImage"},
            "10": {"class_type": "PreviewImage"},
            "3":  {"class_type": "KSampler"},
        }
        ids = lc._output_node_ids(prompt, "9")
        assert ids[0] == "9"          # hint always first
        assert "10" in ids            # second output node included
        assert "3" not in ids         # non-output excluded

    def test_unknown_class_skipped(self, monkeypatch):
        import nodes as cn
        monkeypatch.setattr(cn, "NODE_CLASS_MAPPINGS", {})
        prompt = {"9": {"class_type": "Mystery"}}
        ids = lc._output_node_ids(prompt, "9")
        assert ids == ["9"]


class TestTranslateSubpromptEvent:
    def _agg(self, _nodes):
        return (1.0, 4.0)

    def test_executing_is_swallowed(self):
        out = lc._translate_subprompt_event(
            'executing', {'node': '1', 'prompt_id': 'sub'}, 'sub', 71, self._agg)
        assert out == []

    def test_execution_lifecycle_swallowed(self):
        for ev in ('executed', 'execution_cached', 'execution_start',
                   'execution_success', 'execution_error'):
            out = lc._translate_subprompt_event(
                ev, {'nodes': ['1'], 'node': '2', 'prompt_id': 'sub'},
                'sub', 71, self._agg)
            assert out == [], ev

    def test_progress_state_aggregates_onto_outer_node(self):
        out = lc._translate_subprompt_event(
            'progress_state',
            {'nodes': {'1': {'state': 'running', 'value': 1, 'max': 4}},
             'prompt_id': 'sub'},
            'sub', 71, self._agg)
        assert len(out) == 1
        ev, payload = out[0]
        assert ev == 'progress'
        assert payload['node'] == '71'        # outer stage node, not inner '1'
        assert payload['value'] == 1.0 and payload['max'] == 4.0

    def test_progress_state_empty_nodes_swallowed(self):
        out = lc._translate_subprompt_event(
            'progress_state', {'nodes': {}, 'prompt_id': 'sub'}, 'sub', 71, self._agg)
        assert out == []

    def test_raw_progress_swallowed(self):
        out = lc._translate_subprompt_event(
            'progress', {'value': 2, 'max': 8, 'node': '3', 'prompt_id': 'sub'},
            'sub', 71, self._agg)
        assert out == []

    def test_progress_text_reattributed(self):
        out = lc._translate_subprompt_event(
            'progress_text', {'text': 'hi', 'node_id': '3', 'prompt_id': 'sub'},
            'sub', 71, self._agg)
        assert len(out) == 1
        ev, payload = out[0]
        assert ev == 'progress_text'
        assert payload['node_id'] == '71' and payload['nodeId'] == '71'


class TestFilterSubpromptPreview:
    PREVIEW = 4

    def _preview(self, inner_node_id, prompt_id='sub'):
        meta = {
            'node_id': inner_node_id,
            'display_node_id': inner_node_id,
            'prompt_id': prompt_id,
        }
        return (b'<jpeg-preview-bytes>', meta)

    def test_inner_preview_reattributed_to_outer_node(self):
        handled, payload = lc._filter_subprompt_preview(
            self.PREVIEW, self._preview('3'), 'sub', 71, self.PREVIEW)
        assert handled is True
        ev, (image, meta) = payload
        assert ev == self.PREVIEW
        assert image == b'<jpeg-preview-bytes>'
        assert meta['node_id'] == '71'
        assert meta['display_node_id'] == '71'
        assert meta['prompt_id'] == 'sub'

    def test_dropped_when_no_outer_node(self):
        handled, payload = lc._filter_subprompt_preview(
            self.PREVIEW, self._preview('3'), 'sub', None, self.PREVIEW)
        assert handled is True and payload is None

    def test_preview_from_other_prompt_passes_through(self):
        handled, payload = lc._filter_subprompt_preview(
            self.PREVIEW, self._preview('3', prompt_id='other'), 'sub', 71, self.PREVIEW)
        assert handled is False and payload is None

    def test_non_preview_event_ignored(self):
        handled, payload = lc._filter_subprompt_preview(
            'progress', {'prompt_id': 'sub'}, 'sub', 71, self.PREVIEW)
        assert handled is False and payload is None

    def test_legacy_preview_without_metadata_ignored(self):
        handled, payload = lc._filter_subprompt_preview(
            self.PREVIEW, ('JPEG', b'x', 512), 'sub', 71, self.PREVIEW)
        assert handled is False and payload is None
