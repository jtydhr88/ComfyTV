import json
import pytest


def test_snapshot_roundtrip_is_immutable(tmp_path):
    from ComfyTV.api import task_context as ctx
    from ComfyTV.api.task_context_store import ContextStore
    graph = {'version': 0.4, 'nodes': [{'id': 0, 'type': 'Test', 'widgets_values': ['  中文\n', {'url': 'https://inert/'}]}], 'links': [], 'groups': [], 'extra': {'extension': True}}
    body = {'draft': {'content': graph}, 'selection': {'node_ids': [0]}, 'open_tabs': [{'workflow_id': 'saved', 'name': 'Tab'}]}
    raw = ctx.capture({'prefs': [' exact ']}, body, ' exact ')
    store = ContextStore(tmp_path / 'cache')
    reservation = store.reserve('chat', raw)
    ref = store.commit(reservation)
    graph['nodes'][0]['widgets_values'][0] = 'CHANGED'
    frozen = json.loads(store.read(ref))
    assert frozen['target']['content']['nodes'][0]['widgets_values'][0] == '  中文\n'
    assert frozen['selection']['node_ids'] == [0]
    assert frozen['saved_preferences'] == [' exact ']
    assert frozen['open_tabs'] == body['open_tabs']
    store.release(ref['id'])
    with pytest.raises(ValueError): store.read(ref)


def test_volatile_quota_lease_and_reservations(tmp_path):
    from ComfyTV.api.task_context_store import ContextStore
    now = [1000.0]
    store = ContextStore(tmp_path / 'cache', clock=lambda: now[0])
    refs = [store.commit(store.reserve('chat', b'{}')) for _ in range(4)]
    with pytest.raises(ValueError, match='capacity'): store.reserve('chat', b'{}')
    assert refs[0]['expires_at'] == 11800.0
    reopened = ContextStore(tmp_path / 'cache', clock=lambda: now[0])
    with pytest.raises(ValueError, match='unavailable'): reopened.read(refs[0])
    reopened.close()
    reopened = store  # lease checks apply to the original process-local instance
    now[0] += 1801
    with pytest.raises(ValueError, match='queue'): reopened.dispatch(refs[0])
    now[0] = 11800
    with pytest.raises(ValueError, match='expired|unavailable'): reopened.read(refs[0])
    assert reopened.stats() == {'records': 0, 'bytes': 0, 'reservations': 0}
    tokens = [reopened.reserve(str(i), b'{}') for i in range(4)]
    with pytest.raises(ValueError, match='capacity'): reopened.reserve('other', b'{}')
    for token in tokens: reopened.release(token)
    assert reopened.stats()['reservations'] == 0


@pytest.mark.parametrize('body', [
    {'selection': {'node_ids': [0]}},
    {'draft': {'content': {'nodes': [{'id': 0}, {'id': '0'}]}}, 'selection': {'node_ids': [0]}},
    {'draft': {'content': {'nodes': [{'id': 0}]}}, 'selection': {'node_ids': [0], 'node_locators': ['sub:0']}},
    {'draft': {'content': {'nodes': [{'id': 0}]}}, 'selection': {'node_ids': [1]}},
    {'draft': {'content': {'nodes': [{'id': False}]}}},
    {'draft': {'content': {'nodes': []}}, 'version': 1},
    {'draft': {'content': {'nodes': [], 'extra': float('nan')}}},
    {'open_tabs': [{'workflow_id': 'x', 'name': 'n', 'bad': 1}]},
    {'current_tab': 0}, {'refs': [{'kind': 'stage'}]}, {'prefs': ['override']},
    {'draft': {'content': {'nodes': []}, 'version': 1}},
])
def test_invalid_context_is_not_silently_lost(body):
    from ComfyTV.api.task_context import capture
    with pytest.raises(ValueError): capture({}, body, 'exact')


def test_saved_references_preferences_and_root_locators(tmp_path, monkeypatch):
    from ComfyTV.api import task_context as ctx, agent_workflows
    monkeypatch.setattr(agent_workflows, 'root', lambda: str(tmp_path))
    graph = {'nodes': [{'id': 0, 'widgets_values': ['saved']}], 'links': [], 'extra': {}}
    (tmp_path / 'one.json').write_text(json.dumps(graph))
    wid = agent_workflows.workflow_id('one.json')
    body = {'workflow_id': wid, 'selection': {'node_ids': ['0'], 'node_locators': ['0']}, 'workflow_references': [{'workflow_id': wid, 'name': ' client '}], 'current_tab': wid}
    doc = json.loads(ctx.capture({'prefs': [' p ']}, body, 'exact'))
    assert doc['target']['content'] == graph
    assert doc['references'][0]['content'] == graph
    assert doc['references'][0]['name'] == ' client '
    assert doc['current_tab'] == body['current_tab']
    (tmp_path / 'one.json').unlink()
    (tmp_path / 'one.json').symlink_to(tmp_path / 'elsewhere')
    with pytest.raises(ValueError): ctx.capture({}, body, 'exact')



def test_graph_document_id_is_not_saved_file_identity():
    from ComfyTV.api.task_context import capture
    graph = {'id': 'graph-document-uuid', 'nodes': [], 'version': 0.4}
    doc = json.loads(capture({}, {'workflow_id': 'saved-file-uuid5', 'draft': {'content': graph}}, ''))
    assert doc['target']['workflow_id'] == 'saved-file-uuid5'
    assert doc['target']['content'] == graph


@pytest.mark.parametrize('kind', ['nodes', 'selected', 'depth', 'values', 'prefs', 'tabs', 'workflow_bytes', 'aggregate'])
def test_context_limits_reject_instead_of_truncating(kind, tmp_path, monkeypatch):
    from ComfyTV.api.task_context import capture
    from ComfyTV.api import agent_workflows
    chat, body = {}, {'draft': {'content': {'nodes': []}}}
    graph = body['draft']['content']
    if kind == 'nodes': graph['nodes'] = [{'id': i} for i in range(2001)]
    if kind == 'selected': body['selection'] = {'node_ids': list(range(101))}
    if kind == 'depth':
        nested = []
        for _ in range(65): nested = [nested]
        graph['extra'] = nested
    if kind == 'values': graph['extra'] = [None] * 100001
    if kind == 'prefs': chat['prefs'] = ['中' * 1366]
    if kind == 'tabs': body['open_tabs'] = [{'workflow_id': str(i)} for i in range(65)]
    if kind == 'workflow_bytes': graph['extra'] = 'x' * (2 * 1024 * 1024)
    if kind == 'aggregate':
        monkeypatch.setattr(agent_workflows, 'root', lambda: str(tmp_path))
        graph['extra'] = 'x' * (1500 * 1024)
        (tmp_path / 'r.json').write_text(json.dumps(graph))
        (tmp_path / 's.json').write_text(json.dumps(graph))
        body['workflow_references'] = [{'workflow_id': agent_workflows.workflow_id(p)} for p in ['r.json', 's.json']]
    with pytest.raises(ValueError): capture(chat, body, '')


def test_optional_tab_names_preserved():
    from ComfyTV.api.task_context import capture
    body = {'open_tabs': [{'workflow_id': 'advisory'}], 'current_tab': 'not-a-target'}
    doc = json.loads(capture({}, body, ''))
    assert doc['open_tabs'] == body['open_tabs']
    assert 'target' not in doc


@pytest.mark.skipif(not hasattr(__import__('os'), 'mkfifo'), reason='POSIX FIFO fixture')
def test_saved_workflow_nonregular_file_rejected_before_open(tmp_path, monkeypatch):
    import os
    from ComfyTV.api import task_context as ctx, agent_workflows
    os.mkfifo(tmp_path / 'bad.json')
    monkeypatch.setattr(agent_workflows, 'root', lambda: str(tmp_path))
    monkeypatch.setattr(agent_workflows, 'path_for', lambda _: 'bad.json')
    def forbidden(*args, **kwargs): raise AssertionError('must reject before opening FIFO')
    monkeypatch.setattr(ctx.os, 'open', forbidden)
    with pytest.raises(ValueError, match='regular'): ctx.saved('saved-id')
