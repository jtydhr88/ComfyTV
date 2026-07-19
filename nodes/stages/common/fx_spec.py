import json

from comfy_api.latest import io


def build_fx_spec(kind: str, label: str, domain: str, specs) -> str:
    return json.dumps({
        'v': 1,
        'kind': kind,
        'label': label,
        'domain': domain,
        'specs': [[name, args] for name, args in specs],
    })


def _fx_spec_only(fx_spec: str) -> 'io.NodeOutput':
    return io.NodeOutput("", fx_spec)


def parse_fx_spec(raw: str, slot_label: str) -> dict:
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        data = None
    ok = (isinstance(data, dict)
          and data.get('domain') in ('video', 'audio')
          and isinstance(data.get('specs'), list)
          and len(data['specs']) > 0
          and all(isinstance(e, (list, tuple)) and len(e) == 2
                  and isinstance(e[0], str) for e in data['specs']))
    if not ok:
        raise RuntimeError(
            f"FX Chain: {slot_label} is not a valid FX spec — "
            f"wire it from an FX stage's fx_spec output."
        )
    return data
