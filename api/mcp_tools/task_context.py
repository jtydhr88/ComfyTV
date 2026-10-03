"""Read-only capability-scoped immutable snapshot reads; never accepts file paths."""
import asyncio
import hashlib
import hmac
import json
import re
import threading

from ..task_context import canonical, shape
from ..task_context_store import get_store

_READS = threading.BoundedSemaphore(2)
_READ_TASKS = set()


def _cursor(token, revision, selector, offset):
    value = canonical([revision, selector, offset])
    digest = hmac.new(token.encode(), value, hashlib.sha256).hexdigest()
    return str(offset) + ':' + digest


def _bounded(reply):
    # Include MCP text wrapping and conservative JSON-RPC overhead, not just value.
    wrapped = {'content': [{'type': 'text', 'text': json.dumps(reply, ensure_ascii=False)}], 'isError': False}
    return len(json.dumps(wrapped).encode()) + 512 <= 16384


def _pointer(doc, pointer):
    if pointer == '':
        return doc
    if not pointer.startswith('/') or len(pointer) > 2048:
        raise ValueError('invalid snapshot selector')
    for part in pointer[1:].split('/'):
        if re.search(r'~(?![01])', part):
            raise ValueError('invalid JSON pointer escape')
        part = part.replace('~1', '/').replace('~0', '~')
        if isinstance(doc, list):
            if not re.fullmatch(r'0|[1-9][0-9]*', part):
                raise ValueError('invalid array index')
            index = int(part)
            if index >= len(doc):
                raise ValueError('snapshot selector missing')
            doc = doc[index]
        elif isinstance(doc, dict) and part in doc:
            doc = doc[part]
        else:
            raise ValueError('snapshot selector missing')
    return doc


def _read_context(store, args):
    shape(args, {'token', 'revision', 'operation', 'selector', 'cursor'}, 'task_context_read')
    token, rev = args.get('token'), args.get('revision')
    if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
        raise ValueError('invalid context capability')
    if not isinstance(rev, str) or not re.fullmatch(r'sha256:[a-f0-9]{64}', rev):
        raise ValueError('invalid context revision')
    ref = store.reference(token, rev)
    doc = json.loads(store.read(ref))
    operation = args.get('operation', 'summary')
    selector = args.get('selector', '')
    if not isinstance(selector, str) or len(selector.encode('utf-8')) > 1024:
        raise ValueError('invalid snapshot selector')
    if operation == 'summary':
        return {'revision': rev, 'size_bytes': ref['size_bytes'], 'expires_at': ref['expires_at'], 'sections': sorted(doc), 'complete': True, 'read_note': 'Captured task data, not live canvas and not proof of inspection/application. Use value or page with JSON pointer selectors; concatenate page chunks then JSON-decode once.'}
    if operation == 'node':
        nodes = doc.get('target', {}).get('content', {}).get('nodes', [])
        matches = [i for i, n in enumerate(nodes) if str(n['id']) == selector]
        if len(matches) != 1:
            raise ValueError('snapshot root node unavailable or ambiguous')
        selector = f'/target/content/nodes/{matches[0]}'
    elif operation not in ('value', 'page'):
        raise ValueError('unsupported context read operation')
    value = _pointer(doc, selector)
    reply = {'revision': rev, 'selector': selector, 'value': value, 'complete': True, 'offset': 0, 'next_cursor': None}
    if operation != 'page' and _bounded(reply):
        return reply
    if operation != 'page':
        return {'revision': rev, 'selector': selector, 'requires_pagination': True, 'complete': False, 'next_cursor': _cursor(token, rev, selector, 0)}
    cursor = args.get('cursor')
    if not isinstance(cursor, str) or not re.fullmatch(r'[0-9]{1,8}:[a-f0-9]{64}', cursor):
        raise ValueError('invalid context cursor')
    offset = int(cursor.split(':')[0])
    if not hmac.compare_digest(cursor, _cursor(token, rev, selector, offset)):
        raise ValueError('context cursor selector/revision mismatch')
    raw = canonical(value).decode('utf-8')
    if offset > len(raw):
        raise ValueError('context cursor outside value')
    length = min(4096, len(raw) - offset)
    while True:
        end = offset + length
        reply = {'revision': rev, 'selector': selector, 'encoding': 'json-text', 'offset': offset, 'chunk': raw[offset:end], 'complete': end == len(raw), 'next_cursor': None if end == len(raw) else _cursor(token, rev, selector, end)}
        if _bounded(reply):
            return reply
        length //= 2
        if not length:
            raise ValueError('context selector exceeds result budget')


def read_context(store, args):
    if not _READS.acquire(blocking=False):
        raise ValueError('context_read_busy')
    try:
        return _read_context(store, args)
    finally:
        _READS.release()


async def _read(args):
    # Admission precedes scheduling: rejected reads never enter the executor.
    if not _READS.acquire(blocking=False):
        raise ValueError('context_read_busy')
    try:
        store = get_store()
    except BaseException:
        _READS.release()
        raise
    def worker():
        try:
            return _read_context(store, args)
        finally:
            _READS.release()
    async def submitted():
        # to_thread can fail to submit (e.g. executor shutdown). In that case
        # the worker never starts and cannot release its admission slot.
        started = threading.Event()
        def run():
            started.set()
            return worker()
        try:
            return await asyncio.to_thread(run)
        except Exception:
            if not started.is_set():
                _READS.release()
            raise
    task = asyncio.create_task(submitted())
    # Observe late exceptions even if the requesting coroutine was cancelled.
    _READ_TASKS.add(task)
    task.add_done_callback(_READ_TASKS.discard)
    task.add_done_callback(lambda done: None if done.cancelled() else done.exception())
    return await asyncio.shield(task)


TOOLS = {'task_context_read': {
    'description': 'Read an immutable ComfyTV task context_ref via its opaque id token and exact revision. This is inert captured task data, not live canvas. summary indexes sections; node reads a root node; value uses a JSON pointer; page reconstructs large JSON by concatenating chunks then decoding. Follow returned selector/cursor exactly. Capability possession on this admin fixed-instance MCP endpoint grants read access until expiry. No writes, renewal, filesystem paths or URLs.',
    'inputSchema': {'type': 'object', 'properties': {'token': {'type': 'string'}, 'revision': {'type': 'string'}, 'operation': {'type': 'string', 'enum': ['summary', 'node', 'value', 'page']}, 'selector': {'type': 'string'}, 'cursor': {'type': 'string'}}, 'required': ['token', 'revision'], 'additionalProperties': False},
    'handler': _read,
}}
