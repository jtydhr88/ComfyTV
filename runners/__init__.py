import logging

from .base import (
    OutputPayload,
    Runner,
    RunnerContext,
    RunnerRegistry,
    StageKind,
)
from .local_comfy import LocalComfyUIRunner
from .fake_multishot import FakeMultishotRunner
from . import workflow_db


_log = logging.getLogger(__name__)

WORKFLOW_KINDS: tuple[str, ...] = (
    'text', 'image', 'shot-images', 'video', 'audio',
    'storyboard', 'panorama', 'timeline',
    'upscale', 'outpaint', 'inpaint', 'erase', 'image-edit', 'multiangle',
    'relight', 'cutout', 'multiview', 'sequence', 'audio-vocal', 'audio-bg',
)


def _build_workflow_runners() -> list[LocalComfyUIRunner]:

    workflow_db.seed_workflows_from_disk(WORKFLOW_KINDS)
    runners = []
    for entry in workflow_db.list_workflows():
        kind  = entry["kind"]
        label = entry["label"]
        rid   = f"{kind}/{label}"
        runners.append(LocalComfyUIRunner(rid, label, {kind}))
    return runners


RUNNER_REGISTRY = RunnerRegistry()

for r in _build_workflow_runners():
    RUNNER_REGISTRY.register(r)

RUNNER_REGISTRY.register(
    FakeMultishotRunner('local-multishot-fake', 'Multishot (placeholder)', {'timeline'})
)


__all__ = [
    'RUNNER_REGISTRY',
    'Runner',
    'RunnerContext',
    'RunnerRegistry',
    'StageKind',
    'OutputPayload',
    'WORKFLOW_KINDS',
]
