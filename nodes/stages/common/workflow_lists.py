from ....runners import RUNNER_REGISTRY


def labels_for(kind: str) -> list[str]:
    return RUNNER_REGISTRY.labels_for_kind(kind)

TEXT_WORKFLOWS        = RUNNER_REGISTRY.labels_for_kind('text')
IMAGE_WORKFLOWS       = RUNNER_REGISTRY.labels_for_kind('image')
SHOT_IMAGES_WORKFLOWS = RUNNER_REGISTRY.labels_for_kind('shot-images')
VIDEO_WORKFLOWS       = RUNNER_REGISTRY.labels_for_kind('video')
AUDIO_WORKFLOWS       = RUNNER_REGISTRY.labels_for_kind('audio')
STORYBOARD_WORKFLOWS  = RUNNER_REGISTRY.labels_for_kind('storyboard')
PANORAMA_WORKFLOWS    = RUNNER_REGISTRY.labels_for_kind('panorama')
TIMELINE_WORKFLOWS    = RUNNER_REGISTRY.labels_for_kind('timeline')
UPSCALE_WORKFLOWS     = RUNNER_REGISTRY.labels_for_kind('upscale')
OUTPAINT_WORKFLOWS    = RUNNER_REGISTRY.labels_for_kind('outpaint')
INPAINT_WORKFLOWS     = RUNNER_REGISTRY.labels_for_kind('inpaint')
ERASE_WORKFLOWS       = RUNNER_REGISTRY.labels_for_kind('erase')
IMAGE_EDIT_WORKFLOWS  = RUNNER_REGISTRY.labels_for_kind('image-edit')
MULTIANGLE_WORKFLOWS  = RUNNER_REGISTRY.labels_for_kind('multiangle')
RELIGHT_WORKFLOWS     = RUNNER_REGISTRY.labels_for_kind('relight')
CUTOUT_WORKFLOWS      = RUNNER_REGISTRY.labels_for_kind('cutout')
MULTIVIEW_WORKFLOWS   = RUNNER_REGISTRY.labels_for_kind('multiview')
SEQUENCE_WORKFLOWS    = RUNNER_REGISTRY.labels_for_kind('sequence')
AUDIO_VOCAL_WORKFLOWS = RUNNER_REGISTRY.labels_for_kind('audio-vocal')
AUDIO_BG_WORKFLOWS    = RUNNER_REGISTRY.labels_for_kind('audio-bg')
