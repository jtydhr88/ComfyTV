from typing import Any, Optional

_SKIP_KEYS = {"project_id", "parent_output_id"}

_last: Optional[dict] = None


def build_provenance(*, label, main_prompt, options) -> Optional[dict]:
    out: dict[str, Any] = {}
    if label:
        out["workflow"] = str(label)
    if main_prompt:
        out["prompt"] = str(main_prompt)
    for key, value in (options or {}).items():
        if key.startswith("_") or key in _SKIP_KEYS:
            continue
        if value is None or value == "":
            continue
        out[key] = value
    return out or None


def set_last_provenance(params: Optional[dict]) -> None:
    global _last
    _last = params


def consume_last_provenance() -> Optional[dict]:
    global _last
    params, _last = _last, None
    return params


__all__ = ["build_provenance", "set_last_provenance", "consume_last_provenance"]
