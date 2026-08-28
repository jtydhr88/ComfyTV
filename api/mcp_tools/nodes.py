_NODE_INFO_MAX_RESULTS = 20

_NODE_INFO_MAX_CHOICES = 24

def _slim_input_spec(spec) -> dict:
    if not isinstance(spec, (list, tuple)) or not spec:
        return {"type": str(spec)}
    head = spec[0]
    cfg = spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}
    out: dict = {}
    choices = None
    if isinstance(head, (list, tuple)):
        choices = [str(c) for c in head]
    elif str(head) == "COMBO" and isinstance(cfg.get("options"), list):
        choices = [str(c) for c in cfg["options"]]
    if choices is not None:
        out["type"] = "COMBO"
        out["choices"] = choices[:_NODE_INFO_MAX_CHOICES]
        if len(choices) > _NODE_INFO_MAX_CHOICES:
            out["choices_total"] = len(choices)
    else:
        out["type"] = str(head)
    for key in ("default", "min", "max", "step", "multiline", "tooltip"):
        if key in cfg:
            out[key] = cfg[key]
    return out

def _node_info_dict(name: str, cls) -> dict:
    getter = getattr(cls, "GET_NODE_INFO_V1", None)
    if getter is not None:
        try:
            return dict(getter())
        except Exception:
            pass
    import nodes as comfy_nodes
    display = getattr(comfy_nodes, "NODE_DISPLAY_NAME_MAPPINGS", {})
    try:
        input_types = cls.INPUT_TYPES()
    except Exception as e:
        raise ValueError(f"node {name!r} failed to report its inputs: {e}")
    return {
        "name": name,
        "display_name": display.get(name, name),
        "description": str(getattr(cls, "DESCRIPTION", "") or ""),
        "category": str(getattr(cls, "CATEGORY", "") or ""),
        "output_node": bool(getattr(cls, "OUTPUT_NODE", False)),
        "input": input_types,
        "output": list(getattr(cls, "RETURN_TYPES", ()) or ()),
        "output_name": list(getattr(cls, "RETURN_NAMES", ()) or ()),
    }

def _slim_node_info(info: dict) -> dict:
    inputs: dict = {}
    for section in ("required", "optional"):
        src = (info.get("input") or {}).get(section) or {}
        slim = {n: _slim_input_spec(spec) for n, spec in src.items()}
        if slim:
            inputs[section] = slim
    names = info.get("output_name") or []
    outputs = []
    for i, typ in enumerate(info.get("output") or []):
        outputs.append({
            "type": "COMBO" if isinstance(typ, (list, tuple)) else str(typ),
            "name": str(names[i]) if i < len(names) else "",
        })
    return {
        "name": info.get("name"),
        "display_name": info.get("display_name"),
        "category": info.get("category"),
        "description": str(info.get("description") or "")[:400],
        "output_node": bool(info.get("output_node")),
        "inputs": inputs,
        "outputs": outputs,
    }

async def _node_info(args: dict) -> dict:
    import nodes as comfy_nodes
    mappings = getattr(comfy_nodes, "NODE_CLASS_MAPPINGS", {})
    action = str(args.get("action") or "search")
    if action == "get":
        name = str(args.get("name") or "")
        cls = mappings.get(name)
        if cls is None:
            close = sorted(k for k in mappings if name.lower() in k.lower())[:8]
            hint = f" — close names: {close}" if close else ""
            raise ValueError(f"unknown node class {name!r}{hint}")
        return _slim_node_info(_node_info_dict(name, cls))
    if action == "search":
        query = str(args.get("query") or "").strip().lower()
        if not query:
            raise ValueError("query is required for action='search'")
        tokens = query.split()
        display = getattr(comfy_nodes, "NODE_DISPLAY_NAME_MAPPINGS", {})
        hits = []
        for cname, cls in mappings.items():
            hay = " ".join((
                cname,
                display.get(cname, ""),
                str(getattr(cls, "CATEGORY", "") or ""),
                str(getattr(cls, "DESCRIPTION", "") or "")[:200],
            )).lower()
            if all(t in hay for t in tokens):
                hits.append({
                    "name": cname,
                    "display_name": display.get(cname, cname),
                    "category": str(getattr(cls, "CATEGORY", "") or ""),
                })
        return {"total": len(hits), "nodes": hits[:_NODE_INFO_MAX_RESULTS]}
    raise ValueError(f"unknown action {action!r} (use 'search' or 'get')")

async def _validate_api_prompt(api_json: dict) -> dict:
    import uuid
    import execution
    result = await execution.validate_prompt(str(uuid.uuid4()), api_json, None)
    valid = bool(result[0])
    out: dict = {"valid": valid}
    if not valid:
        err = result[1] or {}
        out["error"] = {k: err.get(k) for k in ("type", "message", "details")
                        if err.get(k)}
        slim = {}
        for nid, info in (result[3] or {}).items():
            msgs = []
            for e in (info or {}).get("errors", []):
                msg = str(e.get("message") or "")
                if e.get("details"):
                    msg += f": {e['details']}"
                msgs.append(msg)
            slim[nid] = {"class_type": (info or {}).get("class_type"),
                         "errors": msgs}
        if slim:
            out["node_errors"] = slim
    return out


TOOLS: dict[str, dict] = {
    "node_info": {
        "description": (
            "Look up ComfyUI node classes in the LIVE in-process registry "
            "(includes every installed custom node). action 'search' + query "
            "(space-separated tokens, all must match against class name / "
            "display name / category / description) lists matching classes; "
            "action 'get' + name returns one class's schema: inputs "
            "(required/optional with type, default, combo choices capped at "
            f"{_NODE_INFO_MAX_CHOICES}) and outputs. Use this to author "
            "API-format graphs for workflow_create. Server-side — no open "
            "tab needed."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["search", "get"]},
                "query": {"type": "string"},
                "name": {"type": "string"},
            },
            "additionalProperties": False,
        },
        "handler": _node_info,
    },
}
