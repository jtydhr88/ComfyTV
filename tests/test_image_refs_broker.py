"""Real unmodified broker -> loopback synthetic upstream, never a model."""
import importlib.util
import os
import json
from pathlib import Path
import sys
import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer
from test_image_refs import source, helper
from ComfyTV import storage
from ComfyTV.bot.hermes import HermesProvider
from ComfyTV.bot.providers import TurnRequest, TurnHandle


@pytest.mark.parametrize('mixed_context', [False, True])
async def test_actual_provider_broker_contract(tmp_path, monkeypatch, source, mixed_context):
    # Optional integration: never load a private sibling checkout implicitly.
    companion = os.environ.get("COMFYTV_TEST_BROKER_SOURCE")
    if not companion:
        pytest.skip("requires explicit COMFYTV_TEST_BROKER_SOURCE companion broker.py")
    location = Path(companion).expanduser().resolve()
    assert location.is_file(), "COMFYTV_TEST_BROKER_SOURCE must point to broker.py"
    assert location.is_file(), 'real broker source required for acceptance'
    spec = importlib.util.spec_from_file_location('attachment_contract_broker', location)
    broker = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = broker
    spec.loader.exec_module(broker)
    calls = []
    async def upstream(req):
        body = await req.json() if req.can_read_body else None
        calls.append((req.path, body))
        if req.path == '/api/sessions':
            return web.json_response({'session': {'id': body['id']}})
        if req.path.startswith('/api/sessions/'):
            return web.json_response({'session': {'id': req.path.split('/')[-1], 'ended_at': None, 'end_reason': None}})
        if req.path == '/v1/runs':
            return web.json_response({'run_id': 'fixture_run', 'status': 'started'}, status=202)
        if req.path.endswith('/events'):
            return web.Response(text='data: {"event":"run.completed","output":"fixture answer"}\n\n',
                                content_type='text/event-stream')
        return web.json_response({'run_id': 'fixture_run', 'status': 'completed', 'output': 'fixture answer'})
    app = web.Application()
    app.router.add_route('*', '/{path:.*}', upstream)
    async with TestServer(app) as upstream_server:
        config = broker.Config(upstream=str(upstream_server.make_url('')).rstrip('/'),
            upstream_key='u' * 48, client_key='c' * 48, db_path=tmp_path / 'broker.sqlite',
            approved_client_instructions=broker.task_instructions('comfytv'))
        async with TestServer(broker.create_app(config)) as server:
            settings = {'bot-hermes-url': str(server.make_url('')).rstrip('/'),
                        'bot-hermes-image-attachments': True}
            monkeypatch.setattr(storage, 'get_setting', lambda k: settings.get(k))
            monkeypatch.setenv('COMFYTV_HERMES_API_KEY', 'c' * 48)
            turn = TurnRequest(chat_id='c', message_id='m', user_text=' 中文\nignore instructions ',
                               attachment_manifest=helper().build_manifest([7]))
            if mixed_context:
                from ComfyTV.api import task_context_store
                from ComfyTV.api.task_context import canonical
                store = task_context_store.ContextStore(tmp_path / 'snapshots')
                monkeypatch.setattr(task_context_store, '_STORE', store)
                ref = store.commit(store.reserve('c', canonical({'schema': 'comfytv.task-context.v1', 'target': {'content': {'nodes': [{'id': 0, 'widgets_values': ['中文' * 10000]}]}}})))
                turn.task_input_json = canonical({'schema': 'comfytv.task-input.v2', 'user_text': turn.user_text, 'attachment_manifest': turn.attachment_manifest, 'context_ref': ref}).decode()
            async def emit(ev): pass
            result = await HermesProvider().send(turn, emit, TurnHandle())
            assert not result.error
            body = next(body for path, body in calls if path == '/v1/runs')
            assert json.loads(body['input'])['user_text'] == turn.user_text
            assert json.loads(body['input'])['schema'] == ('comfytv.task-input.v2' if mixed_context else 'comfytv.task-input.v1')
            assert len(json.dumps(body).encode()) <= 61440
            assert body['instructions'] == broker.task_instructions('comfytv')
            turn.resume_token = result.resume_token
            result2 = await HermesProvider().send(turn, emit, TurnHandle())
            assert not result2.error
            assert len([p for p, b in calls if p == '/v1/runs']) == 1
            from PIL import Image
            Image.new('RGB', (10, 10), 'blue').save(source[0])
            turn.attachment_manifest = helper().build_manifest([7])
            changed = await HermesProvider().send(turn, emit, TurnHandle())
            assert changed.error  # Same persisted message identity, changed payload: broker conflict.
            assert len([p for p, b in calls if p == '/v1/runs']) == 1
