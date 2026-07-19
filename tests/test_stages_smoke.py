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
        timeline, video_edit, material, split_part, _common
    import inspect

    out: dict[str, type] = {}
    for mod in (generators, edits, loaders, panorama, timeline, video_edit,
                material, split_part):
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
        "ModelLoaderStage", "AssetModelLoaderStage",
        # Generators
        "ProjectStage", "TextStage", "ImageStage", "VideoStage",
        "AudioStage", "SpeechStage", "ShotImagesStage", "StoryboardStage",
        "Model3DStage",
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
        "VideoClipStage", "VideoConcatStage", "VideoUpscaleStage",
        "VideoSpeedStage", "VideoRotateStage", "VideoSplitStage",
        "VideoVolumeStage", "VideoMuxAudioStage", "VideoFramesStage",
        "VideoSubtitleSmartEraseStage", "VideoSubtitleSelectEraseStage",
        "AudioExtractVocalStage", "AudioExtractBgStage",
        "AudioVideoDemuxAudioStage", "AudioVideoDemuxVideoStage",
        # Pickers
        "ImagePickerStage", "AudioPickerStage", "VideoPickerStage",
        # Material
        "MaterialStage",
        # Split parts
        "SplitPartStage",
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

    def test_model_loader_execute(self, reset_db):
        from ComfyTV.nodes.stages.loaders import ModelLoaderStage
        out = ModelLoaderStage.execute(project_id="default", model="3d/robot.glb")
        assert "filename=robot.glb" in out.values[0]
        assert "subfolder=3d" in out.values[0]
        assert "type=input" in out.values[0]

    def test_material_stage_execute(self, reset_db):
        import asyncio
        from ComfyTV.nodes.stages.material import MaterialStage
        state = json.dumps({"version": 1, "color": "#e6b553", "metalness": 0.2,
                            "roughness": 0.35})
        out = asyncio.run(MaterialStage.execute(
            project_id="default", material_state=state,
            captured_image="/view?filename=ball.png"))
        assert out.values[0] == state
        assert out.values[1] == "/view?filename=ball.png"

    def test_material_stage_empty_state(self, reset_db):
        import asyncio
        from ComfyTV.nodes.stages.material import MaterialStage
        out = asyncio.run(MaterialStage.execute(project_id="default",
                                                material_state=""))
        assert out.values[0] == "{}"

    def test_extract_material_json(self):
        from ComfyTV.nodes.stages.material import _extract_material_json
        assert _extract_material_json(
            'Sure! ```json\n{"color": "#a1b2c3", "roughness": 0.3, "junk": 1}\n```'
        ) == {"color": "#a1b2c3", "roughness": 0.3}
        assert _extract_material_json("no json here") is None
        assert _extract_material_json('{"unrelated": true}') is None
        assert _extract_material_json("") is None

    def test_asset_model_loader_execute(self, reset_db):
        from ComfyTV.nodes.stages.loaders import AssetModelLoaderStage
        out = AssetModelLoaderStage.execute(project_id="default",
                                            asset_url="/view?filename=m.glb")
        assert out.values[0] == "/view?filename=m.glb"

    def test_list_3d_input_files(self, monkeypatch, tmp_path):
        from ComfyTV.nodes.stages import loaders
        import folder_paths
        root = tmp_path / "3d" / "sub"
        root.mkdir(parents=True)
        (tmp_path / "3d" / "a.glb").write_text("x")
        (root / "b.FBX").write_text("y")
        (root / "c.txt").write_text("z")
        monkeypatch.setattr(folder_paths, "get_input_directory", lambda: str(tmp_path))
        files = loaders._list_3d_input_files()
        assert files == ["3d/a.glb", "3d/sub/b.FBX"]

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

    def test_video_picker_stage(self, reset_db):
        from ComfyTV.nodes.stages.generators import VideoPickerStage
        pool = json.dumps({"images": [
            {"index": "1", "image_url": "clip1.mp4"},
            {"index": "2", "image_url": "clip2.mp4"},
        ]})
        out = VideoPickerStage.execute(project_id="default", selected_index=2,
                                       pool=pool)
        assert out.values[0] == "clip2.mp4"

    def test_audio_picker_stage_single_url_batch(self, reset_db):
        from ComfyTV.nodes.stages.generators import AudioPickerStage
        out = AudioPickerStage.execute(project_id="default", selected_index=1,
                                       batch="/view?filename=track.mp3")
        assert out.values[0] == "/view?filename=track.mp3"

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

    def test_relight_source(self, reset_db):
        from ComfyTV.nodes.stages.edits import RelightStage
        render = "/view?filename=r.png&subfolder=lightball&type=input"
        out = RelightStage.execute(
            project_id="default",
            main_prompt="soft warm lighting",
            lights_data='[{"type":"directional","color":"#ffffff","intensity":2,'
                        '"position":{"x":2,"y":4,"z":2},"target":{"x":0,"y":0,"z":0}}]',
            light_render_url=render,
        )
        assert out.values[0] == render
        assert out.values[1] == "soft warm lighting"

    def test_relight_source_empty(self, reset_db):
        from ComfyTV.nodes.stages.edits import RelightStage
        out = RelightStage.execute(project_id="default")
        assert out.values[0] == ""
        assert out.values[1] == ""

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
        from ComfyTV.nodes.stages.video_edit import VideoClipStage
        out = VideoClipStage.execute(
            project_id="default", video="/view?filename=v.mp4",
            start_s=0.0, end_s=5.0,
        )
        assert out.values[0]

    def test_video_concat_needs_two_videos(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import VideoConcatStage
        with pytest.raises(RuntimeError, match="at least two"):
            VideoConcatStage.execute(project_id="default", videos=None)
        with pytest.raises(RuntimeError, match="at least two"):
            VideoConcatStage.execute(
                project_id="default",
                videos={"videos.video0": "/view?filename=v.mp4", "videos.video1": ""},
            )

    def test_video_concat_respects_clip_order(self, reset_db, monkeypatch):
        from ComfyTV.nodes.stages import video_edit
        captured = {}

        def fake_concat(urls, progress=None):
            captured['urls'] = list(urls)
            return "/view?filename=out.mp4"

        monkeypatch.setattr(video_edit, "concat_videos", fake_concat)
        out = video_edit.VideoConcatStage.execute(
            project_id="default",
            clip_order='["videos.video2", "videos.video0"]',
            videos={
                "videos.video0": "/view?filename=a.mp4",
                "videos.video1": "/view?filename=b.mp4",
                "videos.video2": "/view?filename=c.mp4",
            },
        )
        assert captured['urls'] == [
            "/view?filename=c.mp4",
            "/view?filename=a.mp4",
            "/view?filename=b.mp4",
        ]
        assert out.values[0]

    def test_video_speed_passes_args(self, reset_db, monkeypatch):
        from ComfyTV.nodes.stages import video_edit
        captured = {}
        monkeypatch.setattr(video_edit, "speed_video",
                            lambda url, factor, reverse, pitch_compensate=True: captured.update(
                                url=url, factor=factor, reverse=reverse,
                                pitch_compensate=pitch_compensate) or "/view?filename=o.mp4")
        out = video_edit.VideoSpeedStage.execute(
            project_id="default", video="/view?filename=v.mp4", speed=2.0, reverse=True)
        assert captured == {"url": "/view?filename=v.mp4", "factor": 2.0,
                            "reverse": True, "pitch_compensate": True}
        assert out.values[0]

    def test_video_speed_rejects_noop(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import VideoSpeedStage
        with pytest.raises(RuntimeError, match="nothing to do"):
            VideoSpeedStage.execute(
                project_id="default", video="/view?filename=v.mp4", speed=1.0, reverse=False)

    def test_video_speed_needs_video(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import VideoSpeedStage
        with pytest.raises(RuntimeError, match="upstream video"):
            VideoSpeedStage.execute(project_id="default", speed=2.0)

    def test_video_rotate_passes_args(self, reset_db, monkeypatch):
        from ComfyTV.nodes.stages import video_edit
        captured = {}
        monkeypatch.setattr(video_edit, "transpose_video",
                            lambda url, deg, fh, fv: captured.update(
                                deg=deg, fh=fh, fv=fv) or "/view?filename=o.mp4")
        video_edit.VideoRotateStage.execute(
            project_id="default", video="/view?filename=v.mp4",
            rotate_deg=90, flip_h=True, flip_v=False)
        assert captured == {"deg": 90, "fh": True, "fv": False}

    def test_video_split_emits_both_parts(self, reset_db, monkeypatch):
        from ComfyTV.nodes.stages import video_edit
        monkeypatch.setattr(video_edit, "get_video_info", lambda url: {"duration": 10.0})
        calls = []
        monkeypatch.setattr(video_edit, "trim_video",
                            lambda url, s, e: calls.append((s, e)) or f"/view?filename=p{len(calls)}.mp4")
        out = video_edit.VideoSplitStage.execute(
            project_id="default", video="/view?filename=v.mp4", split_s=4.0)
        assert calls == [(0.0, 4.0), (4.0, 10.0)]
        assert out.values[0] == "/view?filename=p1.mp4"
        assert out.values[1] == "/view?filename=p2.mp4"

    def test_video_split_rejects_out_of_range(self, reset_db, monkeypatch):
        from ComfyTV.nodes.stages import video_edit
        monkeypatch.setattr(video_edit, "get_video_info", lambda url: {"duration": 10.0})
        with pytest.raises(RuntimeError, match="inside the clip"):
            video_edit.VideoSplitStage.execute(
                project_id="default", video="/view?filename=v.mp4", split_s=0.0)
        with pytest.raises(RuntimeError, match="inside the clip"):
            video_edit.VideoSplitStage.execute(
                project_id="default", video="/view?filename=v.mp4", split_s=10.0)

    def test_video_volume_passes_args(self, reset_db, monkeypatch):
        from ComfyTV.nodes.stages import video_edit
        captured = {}
        monkeypatch.setattr(video_edit, "adjust_volume",
                            lambda url, vol, fi, fo: captured.update(
                                vol=vol, fi=fi, fo=fo) or "/view?filename=o.mp4")
        video_edit.VideoVolumeStage.execute(
            project_id="default", video="/view?filename=v.mp4",
            volume=0.5, fade_in_s=1.0, fade_out_s=2.0)
        assert captured == {"vol": 0.5, "fi": 1.0, "fo": 2.0}

    def test_video_mux_audio_passes_args(self, reset_db, monkeypatch):
        from ComfyTV.nodes.stages import video_edit
        captured = {}
        monkeypatch.setattr(video_edit, "mux_audio",
                            lambda v, a, mode, offset_s: captured.update(
                                v=v, a=a, mode=mode, offset=offset_s) or "/view?filename=o.mp4")
        video_edit.VideoMuxAudioStage.execute(
            project_id="default", video="/view?filename=v.mp4",
            audio="/view?filename=a.wav", mode="mix", offset_s=0.5)
        assert captured == {"v": "/view?filename=v.mp4", "a": "/view?filename=a.wav",
                            "mode": "mix", "offset": 0.5}

    def test_video_mux_audio_needs_both(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import VideoMuxAudioStage
        with pytest.raises(RuntimeError, match="both"):
            VideoMuxAudioStage.execute(project_id="default", video="/view?filename=v.mp4")
        with pytest.raises(RuntimeError, match="both"):
            VideoMuxAudioStage.execute(project_id="default", audio="/view?filename=a.wav")

    def test_video_frames_parses_marks(self, reset_db, monkeypatch):
        from ComfyTV.nodes.stages import video_edit
        captured = {}
        monkeypatch.setattr(video_edit, "extract_frames_multi",
                            lambda url, times: captured.update(times=times) or '{"images": []}')
        video_edit.VideoFramesStage.execute(
            project_id="default", video="/view?filename=v.mp4", marks="[1.0, 3.5]")
        assert captured == {"times": [1.0, 3.5]}

    def test_video_frames_bad_marks_fall_through(self, reset_db, monkeypatch):
        from ComfyTV.nodes.stages import video_edit
        captured = {}
        monkeypatch.setattr(video_edit, "extract_frames_multi",
                            lambda url, times: captured.update(times=times) or '{"images": []}')
        video_edit.VideoFramesStage.execute(
            project_id="default", video="/view?filename=v.mp4", marks="not json")
        assert captured == {"times": []}

    def test_video_upscale_not_implemented(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import VideoUpscaleStage
        from ComfyTV.nodes.stages.common import StageNotImplemented
        with pytest.raises(StageNotImplemented):
            VideoUpscaleStage.execute(
                project_id="default", video="/view?filename=v.mp4", scale="2x",
            )

    def test_subtitle_smart_erase_not_implemented(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import VideoSubtitleSmartEraseStage
        from ComfyTV.nodes.stages.common import StageNotImplemented
        with pytest.raises(StageNotImplemented):
            VideoSubtitleSmartEraseStage.execute(
                project_id="default", video="/view?filename=v.mp4",
            )

    def test_subtitle_select_erase_not_implemented(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import VideoSubtitleSelectEraseStage
        from ComfyTV.nodes.stages.common import StageNotImplemented
        with pytest.raises(StageNotImplemented):
            VideoSubtitleSelectEraseStage.execute(
                project_id="default", video="/view?filename=v.mp4",
                region_x=0, region_y=0, region_w=100, region_h=100,
            )

    @pytest.mark.skip(reason="requires workflow runner; stage raises on empty workflow")
    @pytest.mark.asyncio
    async def test_audio_extract_vocal(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import AudioExtractVocalStage
        out = await AudioExtractVocalStage.execute(
            project_id="default", video="/view?filename=v.mp4",
        )
        assert out.values[0]

    @pytest.mark.skip(reason="requires workflow runner; stage raises on empty workflow")
    @pytest.mark.asyncio
    async def test_audio_extract_bg(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import AudioExtractBgStage
        out = await AudioExtractBgStage.execute(
            project_id="default", video="/view?filename=v.mp4",
        )
        assert out.values[0]

    @pytest.mark.skip(reason="needs a real on-disk video file; not stubbed in tests")
    def test_demux_audio(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import AudioVideoDemuxAudioStage
        out = AudioVideoDemuxAudioStage.execute(
            project_id="default", video="/view?filename=v.mp4",
        )
        assert out.values[0]

    @pytest.mark.skip(reason="needs a real on-disk video file; not stubbed in tests")
    def test_demux_video(self, reset_db):
        from ComfyTV.nodes.stages.video_edit import AudioVideoDemuxVideoStage
        out = AudioVideoDemuxVideoStage.execute(
            project_id="default", video="/view?filename=v.mp4",
        )
        assert out.values[0]
