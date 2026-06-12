from .inputs import (
    _force_run_token, _project_id_input, _parent_output_id_input,
)
from .emit import _stage_emit_auto
from ....runners import RUNNER_REGISTRY, RunnerContext


class StageError(RuntimeError):
    """Base for the three distinguished stage-invoke failures."""


class StageRunnerMissing(StageError):
    """No runner registered for kind/label — stale label or registry miss."""


class StageNotImplemented(StageError):
    """The matched runner is a stub (raised NotImplementedError)."""


class StageEmptyOutput(StageError):
    """A real runner ran but returned an empty payload."""


def _standard_stage_inputs() -> list:
    return [
        _force_run_token(),
        _project_id_input(),
        _parent_output_id_input(),
    ]


async def invoke_runner(
    *,
    kind: str,
    label: str,
    main_prompt=None,
    upstream=None,
    options=None,
    progress=None,
):
    runner = RUNNER_REGISTRY.by_label(label, kind)
    if runner is None:
        raise StageRunnerMissing(
            f"no runner registered for {kind}/{label!r} — was the workflow "
            f"added or renamed after startup? (restart ComfyUI to pick up new "
            f"workflow files, or re-open the workflow in the sidebar editor)"
        )

    ctx_kwargs: dict = {
        'kind': kind,
        'upstream': upstream if upstream is not None else {},
        'options': options if options is not None else {},
    }
    if main_prompt is not None:
        ctx_kwargs['main_prompt'] = main_prompt
    if progress is not None:
        ctx_kwargs['progress'] = progress

    ctx = RunnerContext(**ctx_kwargs)

    try:
        payload = await runner.invoke(ctx)
    except NotImplementedError as e:
        raise StageNotImplemented(
            f"stage {kind} not implemented yet: {e}"
        ) from e

    if not payload:
        raise StageEmptyOutput(
            f"workflow {kind}/{label!r} ran but returned no output "
            f"(the runner produced an empty payload)"
        )
    return payload


async def run_stage_workflow(
    cls,
    *,
    kind: str,
    label: str,
    project_id: str,
    parent_output_id=0,
    main_prompt=None,
    upstream=None,
    options=None,
    progress=None,
    transform=None,
    picked_payload=None,
    picked_index=None,
    emit_ui: bool = True,
    params=None,
):
    payload = await invoke_runner(
        kind=kind,
        label=label,
        main_prompt=main_prompt,
        upstream=upstream,
        options=options,
        progress=progress,
    )

    if transform is not None:
        payload = transform(payload)
        if not payload:
            raise StageEmptyOutput(
                f"workflow {kind}/{label!r} output could not be shaped into a "
                f"usable payload (post-processing returned empty)"
            )

    return _stage_emit_auto(
        cls,
        project_id=project_id,
        payload_str=payload,
        params=params,
        emit_ui=emit_ui,
        parent_output_id=parent_output_id,
        picked_payload=picked_payload,
        picked_index=picked_index,
    )
