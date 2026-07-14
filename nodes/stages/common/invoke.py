import json
import logging

from .inputs import (
    _force_run_token, _project_id_input, _parent_output_id_input,
    _custom_params_input,
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


def _route_server(runner, server_id):
    if server_id in (None, '', 'local'):
        return runner

    from ....runners.local_comfy import LocalComfyUIRunner
    from ....runners.remote_comfy import CURRENT_JOB, RemoteComfyUIRunner
    from .... import storage

    if not isinstance(runner, LocalComfyUIRunner):
        raise StageError(
            f"runner {runner.id!r} is not a ComfyUI workflow runner — "
            f"it can't run on a remote instance"
        )
    try:
        server = storage.get_server(int(server_id))
    except (TypeError, ValueError):
        server = None
    if server is None:
        raise StageError(
            f"remote server {server_id!r} not found — was it deleted? "
            f"Pick another instance in the stage's server dropdown."
        )
    if not server.get('enabled', True):
        raise StageError(
            f"remote server {server['label']!r} is disabled — enable it in "
            f"the Servers tab or pick another instance."
        )
    return RemoteComfyUIRunner(runner, server, CURRENT_JOB.get())


def _standard_stage_inputs() -> list:
    return [
        _force_run_token(),
        _project_id_input(),
        _parent_output_id_input(),
    ]


def _merge_custom_params(kind: str, custom_params, options: dict | None,
                         option_defaults: dict | None = None) -> dict:
    merged: dict = dict(option_defaults) if option_defaults else {}
    try:
        from .... import storage
        for d in storage.list_stage_params(kind):
            if d.get("default") is not None:
                merged[d["key"]] = d["default"]
    except Exception as e:
        logging.warning("[ComfyTV/stage-params] default merge failed for %s: %s", kind, e)

    if custom_params:
        try:
            data = json.loads(custom_params) if isinstance(custom_params, str) else custom_params
            for it in (data or {}).get("items", []):
                key = it.get("key")
                if key:
                    merged[key] = it.get("value")
        except (ValueError, TypeError, AttributeError) as e:
            logging.warning("[ComfyTV/stage-params] bad custom_params JSON: %s", e)

    if options:
        merged.update(options)
    return merged


async def invoke_runner(
    *,
    kind: str,
    label: str,
    main_prompt=None,
    upstream=None,
    options=None,
    custom_params=None,
    option_defaults=None,
    progress=None,
):
    runner = RUNNER_REGISTRY.by_label(label, kind)
    if runner is None:
        raise StageRunnerMissing(
            f"no runner registered for {kind}/{label!r} — was the workflow "
            f"added or renamed after startup? (restart ComfyUI to pick up new "
            f"workflow files, or re-open the workflow in the sidebar editor)"
        )

    merged_options = _merge_custom_params(kind, custom_params, options, option_defaults)
    runner = _route_server(runner, merged_options.pop('__server', None))

    ctx_kwargs: dict = {
        'kind': kind,
        'upstream': upstream if upstream is not None else {},
        'options': merged_options,
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
    custom_params=None,
    option_defaults=None,
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
        custom_params=custom_params,
        option_defaults=option_defaults,
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
