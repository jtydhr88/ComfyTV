import json
import re
from typing import Any

MEDIA_KINDS: tuple[str, ...] = ('image', 'video', 'audio', 'model')
INPUT_KINDS: tuple[str, ...] = MEDIA_KINDS + ('text', 'param')
OUTPUT_KINDS: tuple[str, ...] = ('image', 'images', 'video', 'audio', 'text', 'model')
OUTPUT_SLOTS: tuple[str, ...] = OUTPUT_KINDS

SLOT_GROUPS: dict[str, tuple[str, str]] = {
    'image': ('images', 'image'),
    'video': ('videos', 'video'),
    'audio': ('audio', 'audio'),
    'model': ('models', 'model'),
    'text': ('texts', 'text'),
}

UPSTREAM_BUCKETS: dict[str, str] = {
    'image': 'images', 'video': 'videos', 'audio': 'audio',
    'model': 'models', 'text': 'texts',
}

RESULT_TYPE_FOR_OUTPUT: dict[str, str] = {
    'image': 'ui_save_url',
    'images': 'ui_save_batch',
    'video': 'ui_save_url',
    'audio': 'ui_save_url',
    'model': 'ui_save_url',
    'text': 'graph_output_first',
}

PARAM_CASTS: dict[str, str | None] = {
    'INT': 'int', 'FLOAT': 'float', 'BOOLEAN': 'bool', 'STRING': None, 'COMBO': None,
}

_KEY_SAFE = re.compile(r'[^A-Za-z0-9_]+')


def option_key(node_id: str, input_name: str) -> str:
    return 'cio_' + _KEY_SAFE.sub('_', f"{node_id}_{input_name}").strip('_')


def normalize_custom_io(raw: Any) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    inputs: list[dict] = []
    counters = {k: 0 for k in SLOT_GROUPS}
    seen: set[tuple[str, str]] = set()
    for it in raw.get('inputs') or []:
        if not isinstance(it, dict):
            continue
        node = str(it.get('node') or '')
        name = str(it.get('input') or '')
        kind = str(it.get('kind') or '')
        if not node or not name or kind not in INPUT_KINDS or (node, name) in seen:
            continue
        seen.add((node, name))
        entry: dict = {
            'node': node,
            'input': name,
            'kind': kind,
            'label': str(it.get('label') or name),
            'key': option_key(node, name),
        }
        if kind in SLOT_GROUPS:
            entry['slot'] = counters[kind]
            counters[kind] += 1
            entry['required'] = bool(it.get('required', kind in MEDIA_KINDS))
        if kind in ('param', 'text'):
            entry['ptype'] = str(it.get('ptype') or 'STRING').upper()
            entry['props'] = it.get('props') if isinstance(it.get('props'), dict) else {}
            entry['default'] = it.get('default')
        if kind == 'param':
            entry['random'] = bool(it.get('random')) and entry['ptype'] == 'INT'
        if kind == 'text':
            entry['prompt'] = bool(it.get('prompt'))
        inputs.append(entry)

    outputs: list[dict] = []
    seen_nodes: set[str] = set()
    seen_kinds: set[str] = set()
    for it in raw.get('outputs') or []:
        if not isinstance(it, dict):
            continue
        node = str(it.get('node') or '')
        kind = str(it.get('kind') or '')
        if not node or kind not in OUTPUT_KINDS or node in seen_nodes or kind in seen_kinds:
            continue
        seen_nodes.add(node)
        seen_kinds.add(kind)
        outputs.append({
            'node': node,
            'kind': kind,
            'label': str(it.get('label') or kind),
        })
    return {'inputs': inputs, 'outputs': outputs}


def bindings_for(custom_io: dict) -> list[dict]:
    out: list[dict] = []
    for it in custom_io.get('inputs') or []:
        kind = it['kind']
        if kind in MEDIA_KINDS:
            spec: dict = {
                'node_id': it['node'], 'input_name': it['input'],
                'from': f"upstream_{kind}:annotated[{it['slot']}]",
                'required': bool(it.get('required')),
            }
            if spec['required']:
                spec['error_msg'] = f"\"{it['label']}\" needs an upstream {kind} — wire one into the stage."
            out.append(spec)
            continue
        default = it.get('default')
        spec = {
            'node_id': it['node'], 'input_name': it['input'],
            'from': 'main_prompt' if it.get('prompt') else f"option:{it['key']}",
            'required': False,
            'default': 'random_int31' if it.get('random') else (None if default is None else str(default)),
            'cast': PARAM_CASTS.get(str(it.get('ptype') or '').upper()),
        }
        out.append(spec)
    return out


def result_meta_for(custom_io: dict) -> dict:
    outputs = custom_io.get('outputs') or []
    if not outputs:
        return {}
    return {
        'type': 'multi',
        'node': outputs[0]['node'],
        'outputs': [
            {'id': f"{o['kind']}", 'node': o['node'],
             'type': RESULT_TYPE_FOR_OUTPUT[o['kind']], 'kind': o['kind'],
             'only_node': True}
            for o in outputs
        ],
    }


def autogrow_by_index(group: Any, prefix: str, count: int) -> list:
    if group is None:
        return [None] * count
    if isinstance(group, dict):
        if any(k.startswith(prefix) for k in group):
            return [group.get(f"{prefix}{i}") for i in range(count)]
        vals = list(group.values())
    elif isinstance(group, (list, tuple)):
        vals = list(group)
    else:
        vals = [group]
    vals = [v for v in vals if v is not None]
    return (vals + [None] * count)[:count]


def slot_count(custom_io: dict, kind: str) -> int:
    return sum(1 for it in custom_io.get('inputs') or [] if it['kind'] == kind)


def build_upstream(custom_io: dict, groups: dict[str, Any]) -> dict[str, list]:
    upstream: dict[str, list] = {}
    for kind, (group_name, prefix) in SLOT_GROUPS.items():
        n = max(slot_count(custom_io, kind), 1)
        vals = autogrow_by_index(groups.get(group_name), prefix, n)
        upstream[UPSTREAM_BUCKETS[kind]] = [
            (str(v) if v not in (None, '') else None) for v in vals
        ]
    return upstream


def linked_text_options(custom_io: dict, upstream: dict[str, list]) -> dict[str, str]:
    texts = upstream.get('texts') or []
    out: dict[str, str] = {}
    for it in custom_io.get('inputs') or []:
        if it['kind'] != 'text' or it.get('prompt'):
            continue
        idx = int(it.get('slot') or 0)
        v = texts[idx] if idx < len(texts) else None
        if v not in (None, ''):
            out[it['key']] = str(v)
    return out


def split_multi_payload(payload: Any, custom_io: dict) -> tuple[dict[str, str], str, str]:
    data = payload
    if isinstance(payload, str):
        try:
            data = json.loads(payload)
        except (ValueError, TypeError):
            data = None
    multi = data.get('multi') if isinstance(data, dict) else None
    by_kind: dict[str, str] = {}
    outputs = custom_io.get('outputs') or []
    if isinstance(multi, dict):
        for o in outputs:
            v = multi.get(o['kind'])
            if v not in (None, '') and o['kind'] not in by_kind:
                by_kind[o['kind']] = str(v)
    elif outputs and isinstance(payload, str) and payload:
        by_kind[outputs[0]['kind']] = payload
    primary_kind = outputs[0]['kind'] if outputs else 'image'
    return by_kind, primary_kind, by_kind.get(primary_kind, '')


def random_param_keys(custom_io: dict) -> set[str]:
    return {it['key'] for it in custom_io.get('inputs') or [] if it.get('random')}


def strip_random_params(custom_io: dict, custom_params: Any) -> Any:
    keys = random_param_keys(custom_io)
    if not keys or not custom_params:
        return custom_params
    try:
        data = json.loads(custom_params) if isinstance(custom_params, str) else dict(custom_params)
    except (ValueError, TypeError):
        return custom_params
    items = [it for it in (data.get('items') or []) if it.get('key') not in keys]
    return json.dumps({**data, 'items': items})


def slot_values(by_kind: dict[str, str]) -> list[str]:
    return [by_kind.get(k, '') for k in OUTPUT_SLOTS]
