import logging
import re

import nodes as comfy_nodes
from server import PromptServer

from ..runners.notify import notify_toast

_log = logging.getLogger(__name__)

_valid_keys: dict[str, set | None] = {}


def _keys_for(class_type: str) -> set | None:
    if class_type in _valid_keys:
        return _valid_keys[class_type]
    cls = comfy_nodes.NODE_CLASS_MAPPINGS.get(class_type)
    getter = getattr(cls, "GET_SCHEMA", None) or getattr(cls, "define_schema", None)
    keys: set | None = None
    if getter is not None:
        try:
            schema = getter()
        except Exception:
            schema = None
        if schema is not None:
            keys = set()
            for inp in getattr(schema, "inputs", None) or []:
                inp_id = getattr(inp, "id", None)
                if not inp_id:
                    continue
                template = getattr(inp, "template", None)
                names = getattr(template, "names", None)
                if isinstance(names, (list, tuple)) and names:
                    for name in names:
                        keys.add(f"{inp_id}.{name}")
                else:
                    keys.add(str(inp_id))
    _valid_keys[class_type] = keys
    return keys


def clear_lint_cache() -> None:
    _valid_keys.clear()


def _autogrow_formats(valid: set) -> list[str]:
    return sorted({re.sub(r"\d+$", "N", k) for k in valid if "." in k})


def lint_prompt(prompt: dict) -> list[dict]:
    findings: list[dict] = []
    for node_id, node in (prompt or {}).items():
        if not isinstance(node, dict):
            continue
        class_type = str(node.get("class_type") or "")
        if not class_type.startswith("ComfyTV."):
            continue
        valid = _keys_for(class_type)
        if not valid:
            continue
        inputs = node.get("inputs")
        if not isinstance(inputs, dict):
            continue
        unknown = sorted(k for k in inputs if k not in valid)
        if not unknown:
            continue
        finding = {
            "node_id": str(node_id),
            "class_type": class_type,
            "unknown": unknown,
        }
        formats = _autogrow_formats(valid)
        if formats:
            finding["autogrow_formats"] = formats
        findings.append(finding)
    return findings


def _on_prompt(json_data):
    try:
        findings = lint_prompt((json_data or {}).get("prompt") or {})
        for f in findings:
            hint = (f" (autogrow inputs use group.templateN keys, e.g. "
                    f"{f['autogrow_formats'][0].replace('N', '0')})"
                    if f.get("autogrow_formats") else "")
            _log.warning(
                "[ComfyTV/prompt-lint] node %s (%s): unknown input key(s) %s "
                "will be silently dropped by the executor%s",
                f["node_id"], f["class_type"], ", ".join(f["unknown"]), hint,
            )
        if findings:
            worst = findings[0]
            notify_toast(
                "warn",
                "ComfyTV: unknown input keys",
                f"{worst['class_type']} #{worst['node_id']}: "
                f"{', '.join(worst['unknown'][:4])} — these keys do not match "
                "the node schema and will be dropped",
            )
    except Exception:
        _log.exception("[ComfyTV/prompt-lint] lint failed")
    return json_data


PromptServer.instance.add_on_prompt_handler(_on_prompt)
