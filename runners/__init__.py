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


def _workflow_runners_from_db() -> list[LocalComfyUIRunner]:
    runners: list[LocalComfyUIRunner] = []
    try:
        entries = workflow_db.list_workflows()
    except Exception as e:
        _log.exception("[ComfyTV] workflow_db.list_workflows failed: %s", e)
        return runners

    for entry in entries:
        kind  = entry["kind"]
        label = entry["label"]
        rid   = f"{kind}/{label}"
        runners.append(LocalComfyUIRunner(rid, label, {kind}))
    return runners


def _populate(registry: RunnerRegistry) -> None:
    for r in _workflow_runners_from_db():
        registry.register(r)
    registry.register(
        FakeMultishotRunner('local-multishot-fake', 'Multishot (placeholder)', {'timeline'})
    )

RUNNER_REGISTRY = RunnerRegistry()
_populate(RUNNER_REGISTRY)


def seed_workflows() -> None:
    try:
        workflow_db.seed_workflows_from_disk(WORKFLOW_KINDS)
    except Exception as e:
        _log.exception(
            "[ComfyTV] workflow seed failed; continuing without seeded runners: %s", e
        )
    refresh_registry()


def refresh_registry() -> RunnerRegistry:
    RUNNER_REGISTRY._runners.clear()
    _populate(RUNNER_REGISTRY)
    return RUNNER_REGISTRY


__all__ = [
    'RUNNER_REGISTRY',
    'Runner',
    'RunnerContext',
    'RunnerRegistry',
    'StageKind',
    'OutputPayload',
    'WORKFLOW_KINDS',
    'seed_workflows',
    'refresh_registry',
]
