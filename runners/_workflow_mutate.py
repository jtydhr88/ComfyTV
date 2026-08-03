import logging

from .base import RunnerContext
from ._workflow_resolve import (
    _UPSTREAM_BUCKET_BY_KIND,
    _UPSTREAM_PAT,
    _Resolver,
)

_log = logging.getLogger(__name__)


def _split_runner_id(runner_id: str) -> tuple[str, str]:
    if "/" not in runner_id:
        raise RuntimeError(
            f"runner id {runner_id!r} must be 'kind/name' (e.g. 'image/local-sd15')"
        )
    kind, base = runner_id.split("/", 1)
    return kind, base


_BATCH_OUTPUT_KINDS = {
    'image',
    'shot-images',
    'multiview',
    'sequence',
    'split-part',
}


_TEXT_OUTPUT_NODES = (
    "SaveText",
    "SaveText|pysssss",
    "ShowText|pysssss",
    "ShowText",
    "PreviewAny",
    "Display Any (rgthree)",
    "DisplayAny",
)


def _auto_detect_result(workflow: dict, ctx_kind: str | None = None) -> dict:
    image_default = (
        'ui_save_batch' if ctx_kind in _BATCH_OUTPUT_KINDS else 'ui_save_url'
    )
    save_node_result = {
        'SaveImage':        image_default,
        'SaveAnimatedWEBP': image_default,
        'SaveAnimatedPNG':  image_default,
        'PreviewImage':     image_default,
        'SaveVideo':         'ui_save_url',
        'SaveAudio':         'ui_save_url',
        'SaveAudioMP3':      'ui_save_url',
        'SaveAudioOpus':     'ui_save_url',
        'SaveAudioAdvanced': 'ui_save_url',
        'VHS_VideoCombine':  'ui_save_url',
        'SaveGLB':           'ui_save_url',
    }
    for node_id, node in workflow.items():
        if not isinstance(node, dict):
            continue
        ct = node.get("class_type")
        if isinstance(ct, str) and ct in save_node_result:
            return {"type": save_node_result[ct], "node": node_id}

    for wanted in _TEXT_OUTPUT_NODES:
        for node_id, node in workflow.items():
            if isinstance(node, dict) and node.get("class_type") == wanted:
                return {"type": "graph_output_first", "node": node_id}

    raise RuntimeError(
        "Couldn't auto-detect this workflow's result node: it has no save-class "
        "node (SaveImage / SaveVideo / SaveAudio…) and no text-output node "
        "(PreviewAny / ShowText / SaveText). Select the stage on the canvas, "
        "open the ComfyTV sidebar, and pick a node under 'Result' to tell "
        "ComfyTV which node produces this stage's output."
    )


def _gc_unreachable(workflow: dict, config: dict) -> set[str]:
    import nodes as comfy_nodes
    hinted = str((config.get("result") or {}).get("node") or "")
    stack = []
    for nid, node in workflow.items():
        if not isinstance(node, dict):
            continue
        cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(node.get("class_type"))
        if nid == hinted or (cls is not None and getattr(cls, "OUTPUT_NODE", False)):
            stack.append(nid)
    keep: set[str] = set()
    while stack:
        nid = stack.pop()
        if nid in keep:
            continue
        keep.add(nid)
        for v in (workflow.get(nid, {}).get("inputs") or {}).values():
            if isinstance(v, list) and len(v) == 2 and str(v[0]) in workflow:
                stack.append(str(v[0]))
    dead = set(workflow) - keep
    for nid in dead:
        workflow.pop(nid, None)
    return dead


def _apply_prunes(workflow: dict, config: dict, ctx: RunnerContext) -> set[str]:
    pruned: set[str] = set()
    gc_needed = False
    rules = config.get("prune_when_missing") or []
    for rule in rules:
        when = str(rule.get("when") or "")
        m = _UPSTREAM_PAT.match(when)
        if not m:
            _log.warning("prune_when_missing: bad `when` %r — skipped", when)
            continue
        kind, _suffix, idx_str = m.group(1), m.group(2), m.group(3)
        idx = int(idx_str) if idx_str else 0
        upstream = ctx.upstream.get(_UPSTREAM_BUCKET_BY_KIND[kind]) or []
        if isinstance(upstream, str):
            upstream = [upstream]
        have = idx < len(upstream) and upstream[idx] not in (None, "")
        if have:
            continue
        for nid in rule.get("drop_nodes") or []:
            if nid in workflow:
                workflow.pop(nid)
                pruned.add(nid)
        for target in (rule.get("drop_inputs") or []) + (rule.get("drop_upstream_of") or []):
            node = workflow.get(target.get("node"))
            if node is None:
                continue
            node.get("inputs", {}).pop(target.get("input"), None)
        if rule.get("drop_upstream_of"):
            gc_needed = True
    if gc_needed:
        pruned |= _gc_unreachable(workflow, config)
    return pruned


def _apply_overrides(workflow: dict, config: dict, resolver: _Resolver,
                     pruned_nodes: set[str] | None = None) -> None:
    pruned_nodes = pruned_nodes or set()
    overrides = config.get("inputs") or {}
    orphaned: list[str] = []
    for node_id, fields in overrides.items():
        node = workflow.get(node_id)
        if node is None:
            if node_id not in pruned_nodes:
                orphaned.append(str(node_id))
                _log.warning(
                    "[ComfyTV/local-comfy] skipping override for missing workflow "
                    "node %r — workflow was likely re-saved with different node ids; "
                    "re-map this input in the Workflow Config sidebar if still needed.",
                    node_id,
                )
            continue
        node_inputs = node.setdefault("inputs", {})
        for input_name, spec in (fields or {}).items():
            where = f"node {node_id} input {input_name!r}"
            node_inputs[input_name] = resolver.resolve(where, spec)

    if orphaned:
        from .notify import notify_toast
        notify_toast(
            "warn",
            "Workflow input mapping skipped",
            f"{len(orphaned)} input mapping(s) point at nodes no longer in this "
            f"workflow ({', '.join(orphaned[:5])}). It ran with the workflow's own "
            f"defaults — re-map them in the Workflow Config sidebar.",
        )


def _output_node_ids(prompt: dict, hinted: str) -> list[str]:
    import nodes as comfy_nodes
    ids = [hinted]
    for nid, node in prompt.items():
        if nid == hinted:
            continue
        cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(node.get("class_type"))
        if cls is not None and getattr(cls, "OUTPUT_NODE", False):
            ids.append(nid)
    return ids
