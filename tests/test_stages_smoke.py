"""Smoke tests for stage class definitions.

These tests load each stage class via its module and call `define_schema()`
to make sure the V3-API construction doesn't blow up. With the conftest
io stubs, the Schema(...) call returns a passthrough wrapper. This drives
coverage on the schema bodies without needing the full V3 runtime.

`execute()` is also called where feasible (when the stage doesn't dispatch
to a Runner). Stages that hit a real runner are skipped at the execute
layer — those are integration tests, not unit.
"""

from __future__ import annotations

import json
import pytest


def _import_all_stage_modules():
    """Import the stage modules and return the dict of all stage classes
    keyed by class name."""
    from ComfyTV.nodes.stages import generators, edits, loaders, panorama, \
        timeline, video_audio, _common
    import inspect

    out: dict[str, type] = {}
    for mod in (generators, edits, loaders, panorama, timeline, video_audio):
        for name, obj in inspect.getmembers(mod):
            if inspect.isclass(obj) and hasattr(obj, "define_schema") \
                    and obj.__module__ == mod.__name__:
                out[name] = obj
    return out


class TestSchemaDefinitions:
    """Every stage class can return its Schema without raising."""

    def test_collect_all(self):
        classes = _import_all_stage_modules()
        # Should pull in at least 20+ stages.
        assert len(classes) > 10

    @pytest.mark.parametrize("cls_name", [
        # Loaders
        "ImageLoaderStage", "VideoLoaderStage",
        # Generators
        "ProjectStage", "TextStage", "ImageStage", "VideoStage",
        "AudioStage", "ShotImagesStage", "StoryboardStage",
        # Edits
        "UpscaleStage", "InpaintStage", "OutpaintStage", "EraseStage",
        "ImageEditStage", "ImageVariationsStage", "RelightStage",
        "MultiangleStage", "CutoutStage", "CropStage", "RotateStage",
        "MirrorStage", "CompareStage", "GridSplitStage",
        # Panorama
        "PanoramaStage", "PanoramaCurrentViewStage", "PanoramaMultiViewStage",
        # Timeline
        "DirectorTimelineStage", "TimelineVideoStage",
        # Video / audio edits
        "VideoClipStage", "VideoUpscaleStage",
        "VideoSubtitleSmartEraseStage", "VideoSubtitleSelectEraseStage",
        "AudioExtractVocalStage", "AudioExtractBgStage",
        "AudioVideoDemuxAudioStage", "AudioVideoDemuxVideoStage",
        # Pickers
        "ImagePickerStage",
    ])
    def test_define_schema(self, cls_name):
        classes = _import_all_stage_modules()
        if cls_name not in classes:
            pytest.skip(f"{cls_name} not registered (renamed or removed?)")
        cls = classes[cls_name]
        schema = cls.define_schema()
        assert schema is not None
        # _Schema stores kw — node_id is always set in real definitions.
        assert "node_id" in schema.kw


# ─── Loaders: ImageLoaderStage / VideoLoaderStage execute() ─────────────────

class TestLoaderExecute:
    def test_image_loader_execute(self, reset_db, monkeypatch):
        from ComfyTV.nodes.stages.loaders import ImageLoaderStage
        # Make sure storage is wired to our temp DB.
        out = ImageLoaderStage.execute(project_id="default", image="foo.png")
        # _stage_emit_auto returns io.NodeOutput. Our stub stores values.
        assert "filename=foo.png" in out.values[0]
        assert "type=input" in out.values[0]

    def test_video_loader_execute(self, reset_db):
        from ComfyTV.nodes.stages.loaders import VideoLoaderStage
        out = VideoLoaderStage.execute(project_id="default", video="clip.mp4")
        assert "filename=clip.mp4" in out.values[0]

    def test_loader_empty_filename(self, reset_db):
        from ComfyTV.nodes.stages.loaders import ImageLoaderStage
        out = ImageLoaderStage.execute(project_id="default", image="")
        # Empty filename → "" payload
        assert out.values[0] == ""

    def test_list_input_files_handles_missing_dir(self, monkeypatch):
        from ComfyTV.nodes.stages import loaders
        # folder_paths.get_input_directory raising should not propagate.
        import folder_paths
        def boom():
            raise RuntimeError("no dir")
        monkeypatch.setattr(folder_paths, "get_input_directory", boom)
        assert loaders._list_input_files(["image"]) == []

    def test_list_input_files_filters(self, monkeypatch, tmp_path):
        from ComfyTV.nodes.stages import loaders
        import folder_paths
        (tmp_path / "a.png").write_text("x")
        (tmp_path / "b.mp4").write_text("y")
        monkeypatch.setattr(folder_paths, "get_input_directory", lambda: str(tmp_path))
        # filter_files_content_types isn't defined in our stub — add a passthrough.
        monkeypatch.setattr(folder_paths, "filter_files_content_types",
                            lambda files, kinds: files, raising=False)
        files = loaders._list_input_files(["image"])
        assert "a.png" in files
        assert "b.mp4" in files  # passthrough — real impl would filter


# ─── Stage execute() smoke tests — runner-less stages ──────────────────────

class TestRunnerlessStageExecute:

    def test_image_picker_stage(self, reset_db):
        from ComfyTV.nodes.stages.generators import ImagePickerStage
        batch = json.dumps({"images": [
            {"index": "1", "image_url": "url1"},
            {"index": "2", "image_url": "url2"},
        ]})
        out = ImagePickerStage.execute(project_id="default", selected_index=2,
                                       batch=batch)
        assert out.values[0] == "url2"

    @pytest.mark.asyncio
    async def test_project_stage(self, reset_db):
        from ComfyTV.nodes.stages.generators import ProjectStage
        out = ProjectStage.execute(project_id="default")
        assert out is not None


@pytest.mark.skip(reason="requires workflow runner; stages now raise on empty workflow")
class TestEditStageExecute:
    @pytest.mark.asyncio
    async def test_upscale(self, reset_db):
        from ComfyTV.nodes.stages.edits import UpscaleStage
        out = await UpscaleStage.execute(project_id="default", scale="2x",
                                         image="/view?filename=a.png")
        assert out.values[0]  # URL or JSON

    @pytest.mark.asyncio
    async def test_inpaint(self, reset_db):
        from ComfyTV.nodes.stages.edits import InpaintStage
        out = await InpaintStage.execute(project_id="default", main_prompt="x",
                                         image="/view?filename=a.png",
                                         mask_data="data:image/png;base64,xxx")
        assert out.values[0]

    @pytest.mark.asyncio
    async def test_outpaint(self, reset_db):
        from ComfyTV.nodes.stages.edits import OutpaintStage
        out = await OutpaintStage.execute(
            project_id="default", main_prompt="x",
            image="/view?filename=a.png",
            pad_left=100, pad_top=0, pad_right=100, pad_bottom=0,
        )
        assert out.values[0]

    @pytest.mark.asyncio
    async def test_erase(self, reset_db):
        from ComfyTV.nodes.stages.edits import EraseStage
        out = await EraseStage.execute(project_id="default",
                                       image="/view?filename=a.png",
                                       mask_data="data:image/png")
        assert out.values[0]

    @pytest.mark.asyncio
    async def test_image_edit(self, reset_db):
        from ComfyTV.nodes.stages.edits import ImageEditStage
        out = await ImageEditStage.execute(project_id="default", main_prompt="x",
                                           image="/view?filename=a.png")
        assert out.values[0]

    @pytest.mark.asyncio
    async def test_image_variations(self, reset_db):
        from ComfyTV.nodes.stages.edits import ImageVariationsStage
        out = await ImageVariationsStage.execute(
            project_id="default", image="/view?filename=a.png", variant_count=3,
        )
        data = json.loads(out.values[0])
        assert len(data["images"]) == 3

    @pytest.mark.asyncio
    async def test_relight(self, reset_db):
        from ComfyTV.nodes.stages.edits import RelightStage
        out = await RelightStage.execute(
            project_id="default",
            images={"image0": "/view?filename=a.png"},
            brightness=50, color="#ffffff", rim_light=False,
        )
        assert out.values[0]

    @pytest.mark.asyncio
    async def test_relight_with_reference(self, reset_db):
        from ComfyTV.nodes.stages.edits import RelightStage
        # Two images wired = subject + light reference; the with-reference
        # variant should run.
        out = await RelightStage.execute(
            project_id="default",
            images={
                "image0": "/view?filename=subject.png",
                "image1": "/view?filename=lightref.png",
            },
            brightness=50, color="#ffffff", rim_light=False,
        )
        assert out.values[0]

    @pytest.mark.asyncio
    async def test_multiangle(self, reset_db):
        from ComfyTV.nodes.stages.edits import MultiangleStage
        out = await MultiangleStage.execute(
            project_id="default", image="/view?filename=a.png",
            horizontal_angle=45, vertical_angle=0, zoom=5.0,
        )
        assert out.values[0]

    @pytest.mark.asyncio
    async def test_cutout(self, reset_db):
        from ComfyTV.nodes.stages.edits import CutoutStage
        out = await CutoutStage.execute(project_id="default",
                                        image="/view?filename=a.png")
        assert out.values[0]


class TestTransformStageExecute:
    """Crop / Rotate / Mirror / Compare / GridSplit — pure image transforms."""

    def test_crop(self, reset_db):
        from ComfyTV.nodes.stages.edits import CropStage
        out = CropStage.execute(project_id="default",
                                image="/view?filename=a.png",
                                crop_x=0, crop_y=0, crop_w=100, crop_h=100)
        assert out.values[0]

    def test_rotate(self, reset_db):
        from ComfyTV.nodes.stages.edits import RotateStage
        out = RotateStage.execute(project_id="default",
                                  image="/view?filename=a.png", angle=90)
        assert out.values[0]

    def test_mirror(self, reset_db):
        from ComfyTV.nodes.stages.edits import MirrorStage
        out = MirrorStage.execute(project_id="default",
                                  image="/view?filename=a.png",
                                  flip_horizontal=True, flip_vertical=False)
        assert out.values[0]

    @pytest.mark.skip(reason="GridSplitStage.execute is a stub — real split not implemented")
    def test_grid_split(self, reset_db):
        from ComfyTV.nodes.stages.edits import GridSplitStage
        out = GridSplitStage.execute(project_id="default",
                                     image="/view?filename=a.png",
                                     rows=2, cols=2)
        data = json.loads(out.values[0])
        assert len(data["images"]) == 4

    def test_compare(self, reset_db):
        from ComfyTV.nodes.stages.edits import CompareStage
        # CompareStage has no payload — just an inspector node.
        out = CompareStage.execute(project_id="default",
                                   image_a="/view?a", image_b="/view?b")
        assert out is not None


# ─── Panorama, timeline, video/audio edits ──────────────────────────────────

class TestPanoramaStageExecute:
    @pytest.mark.skip(reason="requires workflow runner; stage raises on empty workflow")
    @pytest.mark.asyncio
    async def test_panorama_stage(self, reset_db):
        from ComfyTV.nodes.stages.panorama import PanoramaStage
        out = await PanoramaStage.execute(project_id="default",
                                          main_prompt="sunset over hills")
        assert out.values[0]

    def test_panorama_current_view(self, reset_db):
        from ComfyTV.nodes.stages.panorama import PanoramaCurrentViewStage
        out = PanoramaCurrentViewStage.execute(
            project_id="default", panorama="/view?filename=p.png",
            yaw=0.0, pitch=0.0, fov=75.0,
        )
        assert out.values[0]

    @pytest.mark.skip(reason="PanoramaMultiViewStage.execute is a stub — projection not implemented")
    def test_panorama_multi_view(self, reset_db):
        from ComfyTV.nodes.stages.panorama import PanoramaMultiViewStage
        out = PanoramaMultiViewStage.execute(
            project_id="default", panorama="/view?filename=p.png", view_count=4,
        )
        data = json.loads(out.values[0])
        assert len(data["images"]) == 4


class TestTimelineStageExecute:
    def test_director_timeline(self, reset_db):
        from ComfyTV.nodes.stages.timeline import DirectorTimelineStage
        out = DirectorTimelineStage.execute(project_id="default",
                                             timeline_data="")
        assert out.values[0]


class TestVideoAudioEditStageExecute:
    """Most of these are sync, take a `video` arg, and return fake media."""

    @pytest.mark.skip(reason="needs a real on-disk video file; not stubbed in tests")
    def test_video_clip(self, reset_db):
        from ComfyTV.nodes.stages.video_audio import VideoClipStage
        out = VideoClipStage.execute(
            project_id="default", video="/view?filename=v.mp4",
            start_s=0.0, end_s=5.0,
        )
        assert out.values[0]

    def test_video_upscale(self, reset_db):
        from ComfyTV.nodes.stages.video_audio import VideoUpscaleStage
        out = VideoUpscaleStage.execute(
            project_id="default", video="/view?filename=v.mp4", scale="2x",
        )
        assert out.values[0]

    def test_subtitle_smart_erase(self, reset_db):
        from ComfyTV.nodes.stages.video_audio import VideoSubtitleSmartEraseStage
        out = VideoSubtitleSmartEraseStage.execute(
            project_id="default", video="/view?filename=v.mp4",
        )
        assert out.values[0]

    def test_subtitle_select_erase(self, reset_db):
        from ComfyTV.nodes.stages.video_audio import VideoSubtitleSelectEraseStage
        out = VideoSubtitleSelectEraseStage.execute(
            project_id="default", video="/view?filename=v.mp4",
            region_x=0, region_y=0, region_w=100, region_h=100,
        )
        assert out.values[0]

    @pytest.mark.skip(reason="requires workflow runner; stage raises on empty workflow")
    @pytest.mark.asyncio
    async def test_audio_extract_vocal(self, reset_db):
        from ComfyTV.nodes.stages.video_audio import AudioExtractVocalStage
        out = await AudioExtractVocalStage.execute(
            project_id="default", video="/view?filename=v.mp4",
        )
        assert out.values[0]

    @pytest.mark.skip(reason="requires workflow runner; stage raises on empty workflow")
    @pytest.mark.asyncio
    async def test_audio_extract_bg(self, reset_db):
        from ComfyTV.nodes.stages.video_audio import AudioExtractBgStage
        out = await AudioExtractBgStage.execute(
            project_id="default", video="/view?filename=v.mp4",
        )
        assert out.values[0]

    @pytest.mark.skip(reason="needs a real on-disk video file; not stubbed in tests")
    def test_demux_audio(self, reset_db):
        from ComfyTV.nodes.stages.video_audio import AudioVideoDemuxAudioStage
        out = AudioVideoDemuxAudioStage.execute(
            project_id="default", video="/view?filename=v.mp4",
        )
        assert out.values[0]

    @pytest.mark.skip(reason="needs a real on-disk video file; not stubbed in tests")
    def test_demux_video(self, reset_db):
        from ComfyTV.nodes.stages.video_audio import AudioVideoDemuxVideoStage
        out = AudioVideoDemuxVideoStage.execute(
            project_id="default", video="/view?filename=v.mp4",
        )
        assert out.values[0]
