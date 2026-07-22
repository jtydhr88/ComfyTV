"""Node registry contract — the full set of ComfyTV stage node_ids.

Guards file reorganizations: if a stage class is dropped from
ComfyTVExtension.get_node_list() (or its schema stops loading), this fails
loudly. Update EXPECTED_NODE_IDS deliberately when adding/removing stages.
"""
import asyncio

EXPECTED_NODE_IDS = [
    'ComfyTV.AnnotateStage',
    'ComfyTV.AssetAudioLoaderStage',
    'ComfyTV.AssetImageLoaderStage',
    'ComfyTV.AssetModelLoaderStage',
    'ComfyTV.AssetVideoLoaderStage',
    'ComfyTV.AudioAnalyzeStage',
    'ComfyTV.AudioConvolveStage',
    'ComfyTV.AudioCrossfadeStage',
    'ComfyTV.AudioDeconvolveStage',
    'ComfyTV.AudioDenoiseStage',
    'ComfyTV.AudioDynamicsStage',
    'ComfyTV.AudioEQStage',
    'ComfyTV.AudioEchoStage',
    'ComfyTV.AudioLoaderStage',
    'ComfyTV.AudioLoudnessStage',
    'ComfyTV.AudioMeterStage',
    'ComfyTV.AudioMixStage',
    'ComfyTV.AudioModulationStage',
    'ComfyTV.AudioPickerStage',
    'ComfyTV.AudioReactiveStage',
    'ComfyTV.AudioRepairStage',
    'ComfyTV.AudioSaturateStage',
    'ComfyTV.AudioSegmentExportStage',
    'ComfyTV.AudioStage',
    'ComfyTV.AudioStereoStage',
    'ComfyTV.AudioSweepStage',
    'ComfyTV.AudioTimePitchStage',
    'ComfyTV.AudioVideoDemuxAudioStage',
    'ComfyTV.AudioVideoDemuxVideoStage',
    'ComfyTV.AudioVisualizeStage',
    'ComfyTV.ChromaShiftStage',
    'ComfyTV.ColorGradeStage',
    'ComfyTV.ColorSuppressStage',
    'ComfyTV.CompareStage',
    'ComfyTV.CornerPinStage',
    'ComfyTV.CropStage',
    'ComfyTV.CutoutStage',
    'ComfyTV.DespillStage',
    'ComfyTV.EraseStage',
    'ComfyTV.FXChainStage',
    'ComfyTV.FrameBlendStage',
    'ComfyTV.GlowStage',
    'ComfyTV.GodRaysStage',
    'ComfyTV.GrayWorldStage',
    'ComfyTV.GridSplitStage',
    'ComfyTV.HueCorrectStage',
    'ComfyTV.ImageEditStage',
    'ComfyTV.ImageLoaderStage',
    'ComfyTV.ImagePickerStage',
    'ComfyTV.ImageStage',
    'ComfyTV.ImageVariationsStage',
    'ComfyTV.InpaintStage',
    'ComfyTV.KenBurnsStage',
    'ComfyTV.KeyMixStage',
    'ComfyTV.KeyerStage',
    'ComfyTV.LayerEditorStage',
    'ComfyTV.LineArtStage',
    'ComfyTV.MakeProxyStage',
    'ComfyTV.MaskCleanup',
    'ComfyTV.MaskPropagateStage',
    'ComfyTV.MaterialStage',
    'ComfyTV.MatteMonitorStage',
    'ComfyTV.MatteMorphStage',
    'ComfyTV.MeshBakeMapsStage',
    'ComfyTV.MeshBooleanStage',
    'ComfyTV.MeshOpStage',
    'ComfyTV.MeshPrimitiveStage',
    'ComfyTV.MirrorStage',
    'ComfyTV.Model3DStage',
    'ComfyTV.ModelLoaderStage',
    'ComfyTV.MotionTrackStage',
    'ComfyTV.MultiangleStage',
    'ComfyTV.OldFilmStage',
    'ComfyTV.OutpaintStage',
    'ComfyTV.PIKStage',
    'ComfyTV.PaintStrokeStage',
    'ComfyTV.PanoramaCurrentViewStage',
    'ComfyTV.PanoramaMultiViewStage',
    'ComfyTV.PanoramaStage',
    'ComfyTV.PatternStage',
    'ComfyTV.PosterizeStage',
    'ComfyTV.ProjectStage',
    'ComfyTV.PseudocolorStage',
    'ComfyTV.RelightStage',
    'ComfyTV.RotateStage',
    'ComfyTV.RotoMaskStage',
    'ComfyTV.STMapStage',
    'ComfyTV.Scene3DStage',
    'ComfyTV.SceneDetectStage',
    'ComfyTV.SelectiveColorStage',
    'ComfyTV.SequenceStage',
    'ComfyTV.SpeechStage',
    'ComfyTV.SplitPartStage',
    'ComfyTV.StoryboardEditorStage',
    'ComfyTV.SubtitleGenStage',
    'ComfyTV.SubtitleStage',
    'ComfyTV.TextStage',
    'ComfyTV.TimeRemapStage',
    'ComfyTV.TitleStage',
    'ComfyTV.UpscaleStage',
    'ComfyTV.VideoBlurSharpenStage',
    'ComfyTV.VideoChromaKeyStage',
    'ComfyTV.VideoClipStage',
    'ComfyTV.VideoColorStage',
    'ComfyTV.VideoCompositeStage',
    'ComfyTV.VideoConcatStage',
    'ComfyTV.VideoCropStage',
    'ComfyTV.VideoCurvesStage',
    'ComfyTV.VideoDeinterlaceStage',
    'ComfyTV.VideoDenoiseStage',
    'ComfyTV.VideoExtractFrameStage',
    'ComfyTV.VideoFramesStage',
    'ComfyTV.VideoInterpolateStage',
    'ComfyTV.VideoLUTStage',
    'ComfyTV.VideoLoaderStage',
    'ComfyTV.VideoMuxAudioStage',
    'ComfyTV.VideoPickerStage',
    'ComfyTV.VideoResizeStage',
    'ComfyTV.VideoRotateStage',
    'ComfyTV.VideoScopesStage',
    'ComfyTV.VideoSpeedStage',
    'ComfyTV.VideoSplitStage',
    'ComfyTV.VideoStabilizeStage',
    'ComfyTV.VideoStabilizeV2Stage',
    'ComfyTV.VideoStage',
    'ComfyTV.VideoStylizeStage',
    'ComfyTV.VideoTransformStage',
    'ComfyTV.VideoTransitionStage',
    'ComfyTV.VideoVolumeStage',
]


def _registry():
    from ComfyTV.api.presets import _schema_field
    from ComfyTV.nodes.stages import ComfyTVExtension
    classes = asyncio.run(ComfyTVExtension().get_node_list())
    out = {}
    for cls in classes:
        try:
            schema = cls.define_schema()
        except Exception:
            continue
        out[str(_schema_field(schema, "node_id"))] = cls
    return out


def test_all_stage_node_ids_registered():
    ids = sorted(n for n in _registry() if not n.startswith("ComfyTV.Bridge"))
    assert ids == EXPECTED_NODE_IDS


def test_no_duplicate_registrations():
    from ComfyTV.nodes.stages import ComfyTVExtension
    classes = asyncio.run(ComfyTVExtension().get_node_list())
    assert len(classes) == len(set(classes))
