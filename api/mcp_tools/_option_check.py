from ... import storage
from ...nodes.stages.common.meta import STAGE_META
from ..presets import _input_name, _schema_field, _stage_class_map

_WIDGETS_BY_KIND: dict[str, set[str]] | None = None


async def widget_keys(kind: str) -> set[str]:
    global _WIDGETS_BY_KIND
    if _WIDGETS_BY_KIND is None:
        by_kind: dict[str, set[str]] = {}
        for cls in (await _stage_class_map()).values():
            wk = (STAGE_META.get(cls.__name__) or {}).get("workflow_kind")
            if not wk:
                continue
            names = {n for n in (_input_name(i) for i in
                     (_schema_field(cls.define_schema(), "inputs") or [])) if n}
            by_kind.setdefault(wk, set()).update(names)
        _WIDGETS_BY_KIND = by_kind
    return _WIDGETS_BY_KIND.get(kind, set())


def option_warning(kind: str, key: str, has_default: bool,
                   widgets: set[str], params: list[dict]) -> str | None:
    if has_default or key in widgets:
        return None
    param = next((p for p in params if p.get("key") == key), None)
    if param is not None and param.get("default") is not None:
        return None
    if param is not None:
        return (
            f"option:{key} is not a widget on {kind} stages and its stage "
            f"param has no default, so it resolves empty at run time unless "
            f"the stage's custom_params supply it — add a default to the "
            f"binding (seed: 'random_int31') or set one under Stage Params"
        )
    known = sorted(widgets | {str(p.get("key")) for p in params})
    return (
        f"option:{key} is not a known option for {kind} stages (known: "
        f"{known}); it resolves empty at run time unless the stage's "
        f"custom_params supply it — add a default or bind a known option"
    )


async def dangling_option_warnings(kind: str, bindings: list[dict]) -> list[str]:
    checks = [
        (str(b.get("from"))[len("option:"):], b.get("default") is not None, b)
        for b in bindings
        if str(b.get("from") or "").startswith("option:")
    ]
    if not checks:
        return []
    widgets = await widget_keys(kind)
    params = storage.list_stage_params(kind)
    out: list[str] = []
    for key, has_default, b in checks:
        msg = option_warning(kind, key, has_default, widgets, params)
        if msg:
            out.append(f"node {b.get('node_id')} input {b.get('input_name')!r}: {msg}")
    return out
