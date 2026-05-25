from ._common import *  # noqa: F401, F403

from .generators import (
    ProjectStage, TextStage, ImageStage, VideoStage, AudioStage,
    ImagePickerStage, ShotImagesStage, StoryboardStage,
)
from .edits import (
    UpscaleStage, OutpaintStage, InpaintStage, ImageEditStage,
    EraseStage, CutoutStage, CropStage, RotateStage, MirrorStage,
    GridSplitStage, CompareStage, ImageVariationsStage, RelightStage,
    MultiangleStage,
)
from .timeline import (
    DirectorTimelineStage, TimelineVideoStage,
)
from .video_audio import (
    VideoExtractFrameStage,
    VideoClipStage, VideoCropStage, VideoResizeStage, VideoUpscaleStage,
    VideoSubtitleSmartEraseStage, VideoSubtitleSelectEraseStage,
    AudioExtractVocalStage, AudioExtractBgStage,
    AudioVideoDemuxAudioStage, AudioVideoDemuxVideoStage,
)
from .panorama import (
    PanoramaStage, PanoramaCurrentViewStage, PanoramaMultiViewStage,
)
from .loaders import (
    ImageLoaderStage, VideoLoaderStage,
)


class ComfyTVExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [
            ProjectStage,
            TextStage, ImageStage, VideoStage, AudioStage,
            ImagePickerStage,
            PanoramaStage, PanoramaCurrentViewStage, PanoramaMultiViewStage,
            MultiangleStage, RelightStage, ImageVariationsStage,
            UpscaleStage, OutpaintStage, InpaintStage, ImageEditStage,
            EraseStage, CutoutStage, CropStage,
            RotateStage, MirrorStage, CompareStage, GridSplitStage,
            VideoExtractFrameStage,
            VideoClipStage, VideoCropStage, VideoResizeStage,
            AudioVideoDemuxAudioStage, AudioVideoDemuxVideoStage,
            ImageLoaderStage, VideoLoaderStage,
            *_bridge_classes(),
        ]


def _bridge_classes() -> list:
    from ..bridges import INTO_BRIDGES
    return INTO_BRIDGES


async def comfy_entrypoint() -> ComfyTVExtension:
    return ComfyTVExtension()


NODE_CLASS_MAPPINGS: dict = {}
NODE_DISPLAY_NAME_MAPPINGS: dict = {}
