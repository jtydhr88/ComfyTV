"""Real native/legacy HTTP -> compiler/cache -> turn -> Hermes -> unchanged broker
-> synthetic loopback upstream -> real MCP snapshot read. No model invocation.
"""
import importlib.util
import os
import json
from pathlib import Path
import sys
import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer
from test_image_refs import source
from conftest import wait_bot_done
from ComfyTV import storage
from ComfyTV.api import task_context_store


@pytest.mark.parametrize('native', [False, True])
async def test_route_through_real_broker_reads_snapshot(bot_client, source, tmp_path, monkeypatch, native):
    # Optional integration: never load a private sibling checkout implicitly.
    companion = os.environ.get("COMFYTV_TEST_BROKER_SOURCE")
    if not companion:
        pytest.skip("requires explicit COMFYTV_TEST_BROKER_SOURCE companion broker.py")
    location = Path(companion).expanduser().resolve()
    assert location.is_file(), "COMFYTV_TEST_BROKER_SOURCE must point to broker.py"
    spec = importlib.util.spec_from_file_location('mixed_e2e_broker', location)
    broker = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = broker
    spec.loader.exec_module(broker)
    store = task_context_store.ContextStore(tmp_path / 'snapshots')
    monkeypatch.setattr(task_context_store, '_STORE', store)
    observed = []
    async def upstream(req):
        body = await req.json() if req.can_read_body else None
        if req.path == '/api/sessions':
            return web.json_response({'session': {'id': body['id']}})
        if req.path.startswith('/api/sessions/'):
            return web.json_response({'session': {'id': req.path.split('/')[-1], 'ended_at': None, 'end_reason': None}})
        if req.path == '/v1/runs':
            task = json.loads(body['input'])
            ref = task['context_ref']
            response = await bot_client.post('/comfytv/mcp', json={'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': 'task_context_read', 'arguments': {'token': ref['id'], 'revision': ref['revision'], 'operation': 'value', 'selector': '/target/content'}}})
            rpc = await response.json()
            assert not rpc['result']['isError'], rpc
            snapshot = json.loads(rpc['result']['content'][0]['text'])['value']
            observed.append((task, snapshot, body['instructions']))
            return web.json_response({'run_id': 'fixture_run', 'status': 'started'}, status=202)
        if req.path.endswith('/events'):
            return web.Response(text='data: {"event":"run.completed","output":"Fixture-only completion; no model."}\n\n', content_type='text/event-stream')
        return web.json_response({'run_id': 'fixture_run', 'status': 'completed', 'output': 'Fixture-only completion; no model.'})
    app = web.Application()
    app.router.add_route('*', '/{path:.*}', upstream)
    async with TestServer(app) as upstream_server:
        config = broker.Config(upstream=str(upstream_server.make_url('')).rstrip('/'), upstream_key='u' * 48, client_key='c' * 48, db_path=tmp_path / 'broker.sqlite', approved_client_instructions=broker.task_instructions('comfytv'))
        async with TestServer(broker.create_app(config)) as server:
            storage.set_settings({'bot-hermes-url': str(server.make_url('')).rstrip('/'), 'bot-hermes-image-attachments': True})
            monkeypatch.setenv('COMFYTV_HERMES_API_KEY', 'c' * 48)
            graph = {'id': 'document-id', 'version': 0.4, 'nodes': [{'id': 0, 'type': 'CLIPTextEncode', 'widgets_values': ['  unsaved 中文\\"\n '], 'properties': {'unknown': [True, None]}}], 'links': [], 'groups': [], 'extra': {'data': 'https://inert.invalid/'}}
            text = '  exact 中文\n[wf](workflow://untouched)  '
            body = {'draft': {'content': graph}, 'selection': {'node_ids': ['0'], 'node_locators': ['0']}, 'open_tabs': [{'workflow_id': 'advisory'}], 'current_tab': 'advisory'}
            if native:
                url = '/comfytv/agent/threads/new/messages'
                body.update(provider='hermes', content=text, attachments=['asset:7'])
            else:
                chat = storage.create_bot_chat(provider='hermes')
                storage.update_bot_chat(chat['id'], prefs=[' frozen preference '])
                url = f"/comfytv/bot/chats/{chat['id']}/send"
                body.update(text=text, attachments=[{'asset_id': 7}])
            response = await bot_client.post(url, json=body)
            assert response.status == (202 if native else 200), await response.text()
            ack = await response.json()
            tid = ack['thread_id'] if native else chat['id']
            rows = (await wait_bot_done(bot_client, tid))['messages']
            assert rows[-1]['status'] == 'done', rows[-1]['content']
            assert len(observed) == 1
            task, snapshot, instructions = observed[0]
            assert task['user_text'] == text
            assert snapshot == graph
            assert instructions == broker.task_instructions('comfytv')
            assert task['context_ref']['id'] not in json.dumps(rows)
            assert store.stats()['records'] == 0
