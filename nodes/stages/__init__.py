from ._common import *  # noqa: F401, F403

from .generators import (
    ProjectStage, TextStage, ImageStage, VideoStage, AudioStage, SpeechStage,
    ImagePickerStage, AudioPickerStage, VideoPickerStage, ShotImagesStage, StoryboardStage,
    Model3DStage,
)
from .edits import (
    UpscaleStage, OutpaintStage, InpaintStage, ImageEditStage,
    EraseStage, CutoutStage, CropStage, RotateStage, MirrorStage,
    ColorGradeStage,
    GridSplitStage, CompareStage, ImageVariationsStage, RelightStage,
    MultiangleStage,
)
from .timeline import (
    DirectorTimelineStage, TimelineVideoStage,
)
from .video_audio import (
    VideoExtractFrameStage, VideoFramesStage,
    VideoClipStage, VideoCropStage, VideoConcatStage, VideoResizeStage, VideoUpscaleStage,
    VideoSpeedStage, VideoRotateStage, VideoSplitStage,
    VideoVolumeStage, VideoMuxAudioStage,
    VideoSubtitleSmartEraseStage, VideoSubtitleSelectEraseStage,
    AudioExtractVocalStage, AudioExtractBgStage,
    AudioVideoDemuxAudioStage, AudioVideoDemuxVideoStage,
)
from .video_fx import (
    VideoColorStage, VideoCurvesStage, VideoLUTStage,
    VideoBlurSharpenStage, VideoDenoiseStage, VideoChromaKeyStage,
    VideoTransitionStage, VideoStabilizeStage, SceneDetectStage,
    VideoInterpolateStage, VideoDeinterlaceStage, VideoStylizeStage,
    VideoScopesStage,
)
from .audio_fx import (
    AudioDynamicsStage, AudioEQStage, AudioLoudnessStage, AudioDenoiseStage,
)
from .audio_pro import (
    AudioEchoStage, AudioModulationStage, AudioStereoStage,
    AudioTimePitchStage, AudioRepairStage, AudioSaturateStage,
    AudioCrossfadeStage, AudioAnalyzeStage, AudioVisualizeStage,
)
from .video_pro import (
    VideoCompositeStage, VideoTransformStage, CornerPinStage,
    RotoMaskStage, MotionTrackStage, TitleStage, SubtitleStage,
)
from .video_p2 import (
    TimeRemapStage, SequenceStage, VideoStabilizeV2Stage, PaintStrokeStage,
)
from .panorama import (
    PanoramaStage, PanoramaCurrentViewStage, PanoramaMultiViewStage,
)
from .loaders import (
    ImageLoaderStage, VideoLoaderStage, AudioLoaderStage,
    AssetImageLoaderStage, AssetVideoLoaderStage, AssetAudioLoaderStage,
    ModelLoaderStage, AssetModelLoaderStage,
)
from .geometry import (
    MeshOpStage, MeshPrimitiveStage, MeshBooleanStage, MeshBakeMapsStage,
)
from .scene3d import Scene3DStage
from .layer_editor import LayerEditorStage
from .material import MaterialStage
from .split_part import SplitPartStage, MaskCleanup


class ComfyTVExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [
            ProjectStage,
            TextStage, ImageStage, VideoStage, AudioStage, SpeechStage,
            ImagePickerStage, AudioPickerStage, VideoPickerStage,
            PanoramaStage, PanoramaCurrentViewStage, PanoramaMultiViewStage,
            MultiangleStage, RelightStage, ImageVariationsStage,
            UpscaleStage, OutpaintStage, InpaintStage, ImageEditStage,
            EraseStage, CutoutStage, CropStage,
            RotateStage, MirrorStage, ColorGradeStage, CompareStage, GridSplitStage,
            VideoExtractFrameStage, VideoFramesStage,
            VideoClipStage, VideoCropStage, VideoConcatStage, VideoResizeStage,
            VideoSpeedStage, VideoRotateStage, VideoSplitStage,
            VideoVolumeStage, VideoMuxAudioStage,
            AudioVideoDemuxAudioStage, AudioVideoDemuxVideoStage,
            VideoColorStage, VideoCurvesStage, VideoLUTStage,
            VideoBlurSharpenStage, VideoDenoiseStage, VideoChromaKeyStage,
            VideoTransitionStage, VideoStabilizeStage, SceneDetectStage,
            VideoInterpolateStage, VideoDeinterlaceStage, VideoStylizeStage,
            VideoScopesStage,
            AudioDynamicsStage, AudioEQStage, AudioLoudnessStage, AudioDenoiseStage,
            AudioEchoStage, AudioModulationStage, AudioStereoStage,
            AudioTimePitchStage, AudioRepairStage, AudioSaturateStage,
            AudioCrossfadeStage, AudioAnalyzeStage, AudioVisualizeStage,
            VideoCompositeStage, VideoTransformStage, CornerPinStage,
            RotoMaskStage, MotionTrackStage, TitleStage, SubtitleStage,
            TimeRemapStage, SequenceStage, VideoStabilizeV2Stage, PaintStrokeStage,
            ImageLoaderStage, VideoLoaderStage, AudioLoaderStage,
            AssetImageLoaderStage, AssetVideoLoaderStage, AssetAudioLoaderStage,
            Model3DStage, ModelLoaderStage, AssetModelLoaderStage,
            MeshOpStage, MeshPrimitiveStage, MeshBooleanStage, MeshBakeMapsStage,
            Scene3DStage,
            LayerEditorStage,
            MaterialStage,
            SplitPartStage, MaskCleanup,
            *_bridge_classes(),
        ]


def _bridge_classes() -> list:
    from ..bridges import ALL_BRIDGES
    return ALL_BRIDGES


async def comfy_entrypoint() -> ComfyTVExtension:
    return ComfyTVExtension()


NODE_CLASS_MAPPINGS: dict = {}
NODE_DISPLAY_NAME_MAPPINGS: dict = {}
