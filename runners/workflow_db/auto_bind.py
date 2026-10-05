import json

from ... import db
from .._workflow_resolve import OUTPUT_BINDING_PREFIX

SIZE_NODE_OUTPUTS: dict[str, dict[int, str]] = {
    "ResolutionSelector": {0: "computed:width", 1: "computed:height"},
}


def _iter_gui_nodes(doc: dict):
    subgraphs = {
        str(sg.get("id")): sg
        for sg in (doc.get("definitions") or {}).get("subgraphs") or []
    }
    for top in doc.get("nodes") or []:
        sg = subgraphs.get(str(top.get("type")))
        if sg is None:
            yield str(top.get("id")), top
            continue
        for inner in sg.get("nodes") or []:
            yield f"{top.get('id')}:{inner.get('id')}", inner


def add_size_node_bindings(s, row: db.Workflow, content: str) -> None:
    from ...nodes.stages.common.caps import CAPS_BY_KIND, FALLBACK_CAPS
    computed = CAPS_BY_KIND.get(row.kind, FALLBACK_CAPS)["computed_keys"]
    for node_id, n in _iter_gui_nodes(json.loads(content)):
        sources = SIZE_NODE_OUTPUTS.get(n.get("type"))
        if sources is None:
            continue
        outputs = n.get("outputs") or []
        for slot, src in sources.items():
            if src not in computed or slot >= len(outputs) or not outputs[slot].get("links"):
                continue
            s.add(db.WorkflowInputBinding(
                workflow_id=row.id,
                node_id=node_id,
                input_name=f"{OUTPUT_BINDING_PREFIX}{slot}",
                from_=src,
                cast_="int",
                required=False,
            ))
