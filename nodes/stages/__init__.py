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
from .video_edit import (
    VideoExtractFrameStage, VideoFramesStage,
    VideoClipStage, VideoCropStage, VideoConcatStage, VideoResizeStage, VideoUpscaleStage,
    VideoSpeedStage, VideoRotateStage, VideoSplitStage,
    VideoVolumeStage, VideoMuxAudioStage,
    VideoSubtitleSmartEraseStage, VideoSubtitleSelectEraseStage,
    AudioExtractVocalStage, AudioExtractBgStage,
    AudioVideoDemuxAudioStage, AudioVideoDemuxVideoStage,
    MakeProxyStage,
)
from .video_color import (
    VideoColorStage, VideoCurvesStage, VideoLUTStage,
    HueCorrectStage, SelectiveColorStage, GrayWorldStage,
)
from .video_enhance import (
    VideoBlurSharpenStage, VideoDenoiseStage, VideoInterpolateStage,
    VideoDeinterlaceStage, VideoStabilizeStage, VideoStabilizeV2Stage,
)
from .video_keying import (
    VideoChromaKeyStage, PIKStage, KeyerStage, DespillStage,
    ColorSuppressStage, KeyMixStage, MatteMonitorStage, MatteMorphStage,
)
from .video_stylize import (
    VideoStylizeStage, GlowStage, GodRaysStage, OldFilmStage, FrameBlendStage,
    ChromaShiftStage, PseudocolorStage, PosterizeStage,
)
from .video_compose import (
    VideoCompositeStage, VideoTransformStage, CornerPinStage, STMapStage,
)
from .video_masking import (
    MotionTrackStage, RotoMaskStage, MaskPropagateStage, PaintStrokeStage,
    AnnotateStage,
)
from .video_text import TitleStage, SubtitleStage, SubtitleGenStage
from .video_timeline import VideoTransitionStage, TimeRemapStage, SequenceStage
from .video_analysis import VideoScopesStage, SceneDetectStage
from .video_generate import PatternStage, KenBurnsStage
from .fx_chain import FXChainStage
from .audio_process import (
    AudioDynamicsStage, AudioEQStage, AudioLoudnessStage, AudioDenoiseStage,
    AudioRepairStage,
)
from .audio_effects import (
    AudioEchoStage, AudioModulationStage, AudioStereoStage,
    AudioTimePitchStage, AudioSaturateStage, AudioConvolveStage,
)
from .audio_edit import (
    AudioCrossfadeStage, AudioMixStage, AudioSegmentExportStage,
)
from .audio_measure import (
    AudioAnalyzeStage, AudioVisualizeStage, AudioSweepStage,
    AudioDeconvolveStage,
)
from .audio_reactive import AudioReactiveStage, AudioMeterStage
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
from .storyboard_editor import StoryboardEditorStage
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
            VideoVolumeStage, VideoMuxAudioStage, MakeProxyStage,
            AudioVideoDemuxAudioStage, AudioVideoDemuxVideoStage,
            VideoColorStage, VideoCurvesStage, VideoLUTStage,
            VideoBlurSharpenStage, VideoDenoiseStage, VideoChromaKeyStage,
            VideoTransitionStage, VideoStabilizeStage, SceneDetectStage,
            VideoInterpolateStage, VideoDeinterlaceStage, VideoStylizeStage,
            VideoScopesStage,
            FXChainStage,
            AudioDynamicsStage, AudioEQStage, AudioLoudnessStage, AudioDenoiseStage,
            AudioEchoStage, AudioModulationStage, AudioStereoStage,
            AudioTimePitchStage, AudioRepairStage, AudioSaturateStage,
            AudioCrossfadeStage, AudioAnalyzeStage, AudioVisualizeStage,
            AudioMixStage, AudioSegmentExportStage, AudioConvolveStage,
            AudioSweepStage, AudioDeconvolveStage,
            VideoCompositeStage, VideoTransformStage, CornerPinStage,
            RotoMaskStage, MotionTrackStage, TitleStage, SubtitleStage,
            TimeRemapStage, SequenceStage, VideoStabilizeV2Stage, PaintStrokeStage,
            STMapStage, MaskPropagateStage, SubtitleGenStage,
            HueCorrectStage, GlowStage, GodRaysStage, PatternStage,
            PIKStage, KeyerStage, DespillStage, ColorSuppressStage,
            KeyMixStage, MatteMonitorStage, MatteMorphStage,
            FrameBlendStage, KenBurnsStage, OldFilmStage,
            SelectiveColorStage, ChromaShiftStage, PseudocolorStage,
            PosterizeStage, GrayWorldStage,
            AnnotateStage, AudioReactiveStage, AudioMeterStage,
            ImageLoaderStage, VideoLoaderStage, AudioLoaderStage,
            AssetImageLoaderStage, AssetVideoLoaderStage, AssetAudioLoaderStage,
            Model3DStage, ModelLoaderStage, AssetModelLoaderStage,
            MeshOpStage, MeshPrimitiveStage, MeshBooleanStage, MeshBakeMapsStage,
            Scene3DStage,
            LayerEditorStage,
            StoryboardEditorStage,
            MaterialStage,
            SplitPartStage, MaskCleanup,
            *_bridge_classes(),
        ]


def _bridge_classes() -> list:
    try:
        from ..bridges import ALL_BRIDGES
    except ImportError:
        return []
    return ALL_BRIDGES


async def comfy_entrypoint() -> ComfyTVExtension:
    return ComfyTVExtension()


NODE_CLASS_MAPPINGS: dict = {}
NODE_DISPLAY_NAME_MAPPINGS: dict = {}
