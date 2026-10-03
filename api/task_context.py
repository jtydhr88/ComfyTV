"""Lossless inert JSON capture. Graph data is never an instruction or a URL to fetch."""
import hashlib
import json
import math
import os

MiB = 1024 * 1024


def canonical(value):
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')
    except (TypeError, UnicodeError, RecursionError, ValueError) as exc:
        raise ValueError('context must contain finite UTF-8 JSON values') from exc


def revision(raw):
    return 'sha256:' + hashlib.sha256(raw).hexdigest()


def strict_loads(raw):
    def pairs(items):
        out = {}
        for k, v in items:
            if k in out:
                raise ValueError('duplicate JSON key')
            out[k] = v
        return out
    def invalid(_):
        raise ValueError('nonfinite JSON value')
    try:
        return json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid)
    except (UnicodeError, RecursionError) as exc:
        raise ValueError('invalid context JSON') from exc


async def read_request(request):
    limit = min(6 * MiB, getattr(request, 'client_max_size', 6 * MiB) or 6 * MiB)
    raw = bytearray()
    async for chunk in request.content.iter_chunked(65536):
        if len(raw) + len(chunk) > limit:
            raise ValueError(f'request exceeds {limit} byte inbound limit')
        raw.extend(chunk)
    return strict_loads(raw)


def shape(value, allowed, label):
    if not isinstance(value, dict) or set(value) - set(allowed):
        raise ValueError(f'{label} unsupported or malformed fields')


def json_limits(value):
    stack, count = [(value, 0)], 0
    while stack:
        item, depth = stack.pop()
        count += 1
        if count > 100000 or depth > 64:
            raise ValueError('context JSON depth/value limit exceeded')
        if isinstance(item, dict):
            if any(not isinstance(k, str) for k in item):
                raise ValueError('context keys must be strings')
            stack.extend((v, depth + 1) for v in item.values())
        elif isinstance(item, list):
            stack.extend((v, depth + 1) for v in item)
        elif item is not None and not isinstance(item, (str, int, float, bool)):
            raise ValueError('context must be JSON')
        elif isinstance(item, float) and not math.isfinite(item):
            raise ValueError('context must be finite')


def node_id(value):
    if (type(value) is int and abs(value) <= 9007199254740991) or (isinstance(value, str) and value and len(value) <= 256):
        return str(value)
    raise ValueError('invalid selection/node ID')


def graph(value):
    if not isinstance(value, dict) or not isinstance(value.get('nodes'), list):
        raise ValueError('draft must contain a full save-format graph with nodes')
    json_limits(value)
    if len(value['nodes']) > 2000 or len(canonical(value)) > 2 * MiB:
        raise ValueError('workflow context exceeds size/node limit')
    ids = []
    for node in value['nodes']:
        if not isinstance(node, dict) or 'id' not in node:
            raise ValueError('invalid graph node')
        ids.append(node_id(node['id']))
    if len(set(ids)) != len(ids):
        raise ValueError('ambiguous graph node IDs')
    return value


def identifier(value, label):
    if not isinstance(value, str) or not value or len(value.encode('utf-8')) > 256:
        raise ValueError(f'invalid {label}')
    return value


def saved(wid):
    from . import agent_workflows
    from .task_context_store import safe_path
    from pathlib import Path
    rel = agent_workflows.path_for(wid)
    if rel is None:
        raise ValueError('workflow_id not found')
    base = safe_path(agent_workflows.root())
    path = safe_path(base / rel)
    if not path.is_relative_to(base):
        raise ValueError('unsafe workflow path')
    try:
        # O_NOFOLLOW protects the final component on POSIX; pre/post identity
        # checks additionally reject changed parents on portable hosts.
        before = [(p, p.stat()) for p in [path, *path.parents]]
        import stat
        if not stat.S_ISREG(before[0][1].st_mode):
            raise ValueError('workflow must be a regular file')
        fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NONBLOCK', 0))
        with os.fdopen(fd, 'rb') as stream:
            opened = os.fstat(stream.fileno())
            if not os.path.samestat(opened, before[0][1]):
                raise ValueError('workflow changed during capture')
            raw = stream.read(2 * MiB + 1)
            safe_path(path)
            if any(not os.path.samestat(st, p.stat()) for p, st in before):
                raise ValueError('workflow path changed during capture')
        if len(raw) > 2 * MiB:
            raise ValueError('workflow exceeds 2 MiB')
        content = graph(strict_loads(raw))
    except OSError as exc:
        raise ValueError('workflow unavailable') from exc
    return {'workflow_id': wid, 'server_name': Path(rel).stem, 'content': content, 'revision': revision(canonical(content))}


def capture(chat, body, text):
    shape(body, {'content', 'text', 'attachments', 'provider', 'workflow_id', 'draft', 'selection', 'workflow_references', 'open_tabs', 'current_tab', 'tabs', 'refs', 'prefs', 'skill'}, 'request')
    if not isinstance(text, str):
        raise ValueError('user text must be a string')
    canonical(text)
    for key, empty in [('refs', []), ('prefs', []), ('skill', '')]:
        if body.get(key) is not None and body[key] != empty:
            raise ValueError(f'{key} unsupported with image context; send without images')
    if 'tabs' in body and body['tabs'] not in (None, {'items': []}):
        raise ValueError('tabs unsupported shape; use open_tabs/current_tab')
    from .agent_routes import _split_skill
    if _split_skill(text.strip())[0]:
        raise ValueError('slash skill unsupported with images; send without images')
    doc = {'schema': 'comfytv.task-context.v1'}
    target_id = body.get('workflow_id')
    if target_id not in (None, ''):
        identifier(target_id, 'workflow_id')
    elif target_id is not None and not isinstance(target_id, str):
        raise ValueError('invalid workflow_id')
    draft = body.get('draft')
    if draft is not None:
        shape(draft, {'content'}, 'draft')
        content = graph(draft.get('content'))
        doc['target'] = {'source': 'draft', 'content': content, 'revision': revision(canonical(content))}
        if target_id:
            doc['target']['workflow_id'] = target_id
    elif target_id:
        doc['target'] = {'source': 'saved_workflow', **saved(target_id)}
    selection = body.get('selection')
    if selection is not None:
        shape(selection, {'node_ids', 'node_locators'}, 'selection')
        ids = selection.get('node_ids')
        if not isinstance(ids, list) or len(ids) > 100:
            raise ValueError('invalid selection node_ids')
        keys = [node_id(i) for i in ids]
        if len(set(keys)) != len(keys):
            raise ValueError('duplicate selection IDs')
        locators = selection.get('node_locators')
        if locators is not None and (not isinstance(locators, list) or locators != keys):
            raise ValueError('nested or mismatched selection node_locators unsupported')
        if ids:
            if 'target' not in doc:
                raise ValueError('selection requires explicit captured target')
            available = {node_id(n['id']) for n in doc['target']['content']['nodes']}
            if any(k not in available for k in keys):
                raise ValueError('selection node missing from target')
            doc['selection'] = {'namespace': 'comfyui.root', **selection}
    refs = body.get('workflow_references', [])
    if refs is None:
        refs = []
    if not isinstance(refs, list) or len(refs) > 3:
        raise ValueError('invalid workflow_references')
    seen = set()
    for ref in refs:
        shape(ref, {'workflow_id', 'name'}, 'workflow reference')
        wid = identifier(ref.get('workflow_id'), 'workflow reference ID')
        if wid in seen or ('name' in ref and not isinstance(ref['name'], str)):
            raise ValueError('duplicate/malformed workflow reference')
        seen.add(wid)
        doc.setdefault('references', []).append({**saved(wid), **ref})
    prefs = chat.get('prefs', [])
    if chat.get('id'):
        from ..storage.bot import strict_bot_preferences
        prefs = strict_bot_preferences(chat['id'])
    if prefs is None:
        prefs = []
    if (not isinstance(prefs, list) or len(prefs) > 16 or any(not isinstance(p, str) for p in prefs)
            or sum(len(p.encode('utf-8')) for p in prefs) > 4096):
        raise ValueError('invalid saved preferences')
    if prefs:
        doc['saved_preferences'] = prefs
    tabs = body.get('open_tabs')
    if tabs is not None:
        if not isinstance(tabs, list) or len(tabs) > 64:
            raise ValueError('invalid open_tabs')
        for tab in tabs:
            shape(tab, {'workflow_id', 'name'}, 'tab')
            identifier(tab.get('workflow_id'), 'tab workflow_id')
            if 'name' in tab and not isinstance(tab['name'], str):
                raise ValueError('invalid tab name')
        doc['open_tabs'] = tabs
    if body.get('current_tab') is not None:
        doc['current_tab'] = identifier(body['current_tab'], 'current_tab')
    if len(canonical({k: doc[k] for k in ('open_tabs', 'current_tab') if k in doc})) > 16384:
        raise ValueError('tab metadata exceeds 16 KiB')
    json_limits(doc)
    raw = canonical(doc)
    if len(raw) > 4 * MiB:
        raise ValueError('context exceeds 4 MiB')
    return raw if len(doc) > 1 else None
