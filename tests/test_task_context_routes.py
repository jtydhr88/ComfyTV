import asyncio
import json
import pytest
from ComfyTV import storage
from ComfyTV.api import bot_turns
from test_image_refs import source, helper
from test_image_refs_context import refs_provider, request
from conftest import wait_bot_done


@pytest.fixture
def mixed(refs_provider, tmp_path, monkeypatch):
    from ComfyTV.api import task_context_store
    refs_provider.capabilities().attachment_mixed_context = True
    store = task_context_store.ContextStore(tmp_path / 'contexts')
    monkeypatch.setattr(task_context_store, '_STORE', store)
    return refs_provider, store


@pytest.mark.parametrize('native', [False, True])
async def test_routes_deliver_frozen_draft_and_cleanup(bot_client, mixed, source, native):
    provider, store = mixed
    chat = storage.create_bot_chat(provider=provider.id)
    storage.update_bot_chat(chat['id'], prefs=[' saved '])
    provider.gate = asyncio.Event()
    graph = {'version': 0.4, 'nodes': [{'id': 0, 'type': 'CLIPTextEncode', 'widgets_values': [' unsaved 中文 '], 'properties': {'extension': [1, None, True]}}], 'links': [], 'groups': [], 'extra': {'x': 1}}
    url, body = request(chat, native, draft={'content': graph}, selection={'node_ids': ['0'], 'node_locators': ['0']}, open_tabs=[{'workflow_id': 'advisory', 'name': 'tab'}])
    response = await bot_client.post(url, json=body)
    assert response.status == (202 if native else 200), await response.text()
    for _ in range(100):
        if provider.last_turn: break
        await asyncio.sleep(.01)
    turn = provider.last_turn
    task = json.loads(turn.task_input_json)
    assert task['schema'] == 'comfytv.task-input.v2'
    assert task['user_text'] == body['content' if native else 'text']
    snapshot = json.loads(store.read(task['context_ref']))
    assert snapshot['target']['content'] == graph
    assert snapshot['saved_preferences'] == [' saved ']
    assert snapshot['open_tabs'] == body['open_tabs']
    assert task['context_ref']['id'] not in json.dumps(storage.list_bot_messages(chat['id']))
    provider.gate.set()
    await wait_bot_done(bot_client, chat['id'])
    assert store.stats()['records'] == 0


async def test_new_chat_failed_preparation_has_no_effects(bot_client, mixed, monkeypatch):
    provider, store = mixed
    before = storage.list_bot_chats()
    def fail(_): raise ValueError('image unavailable')
    monkeypatch.setattr(helper(), 'build_manifest', fail)
    response = await bot_client.post('/comfytv/agent/threads/new/messages', json={'provider': provider.id, 'content': 'exact', 'attachments': ['asset:7'], 'draft': {'content': {'nodes': []}}})
    assert response.status == 400
    assert storage.list_bot_chats() == before
    assert store.stats() == {'records': 0, 'bytes': 0, 'reservations': 0}


async def test_legacy_queue_freezes_private_submission_and_delete_releases(bot_client, mixed, source, monkeypatch):
    provider, store = mixed
    chat = storage.create_bot_chat(provider=provider.id)
    monkeypatch.setitem(bot_turns.ACTIVE_TURNS, chat['id'], object())
    storage.update_bot_chat(chat['id'], prefs=['before'])
    url, body = request(chat, False, draft={'content': {'nodes': [{'id': 0, 'widgets_values': ['before']}]}})
    response = await bot_client.post(url, json=body)
    data = await response.json()
    assert data['queued']
    item = bot_turns.QUEUED[chat['id']][0]
    frozen = item['task_input_json']
    assert store.submission(data['user_message']['id']) == frozen
    storage.update_bot_chat(chat['id'], prefs=['after'])
    body['draft']['content']['nodes'][0]['widgets_values'][0] = 'after'
    snap = json.loads(store.read(json.loads(frozen)['context_ref']))
    assert snap['saved_preferences'] == ['before']
    assert snap['target']['content']['nodes'][0]['widgets_values'] == ['before']
    bot_turns.ACTIVE_TURNS.pop(chat['id'])
    response = await bot_client.delete(f"/comfytv/bot/chats/{chat['id']}")
    assert response.status == 200
    assert store.stats()['records'] == 0


@pytest.mark.parametrize('native', [False, True])
async def test_removed_queue_releases_only_queued_context_when_active_stop_unknown(
        bot_client, mixed, source, monkeypatch, native):
    from ComfyTV.bot.hermes import HermesProvider

    provider, store = mixed
    provider.gate = asyncio.Event()
    chat = storage.create_bot_chat(provider=provider.id)
    url, body = request(chat, native, draft={'content': {'nodes': [{'id': 0}]}})
    response = await bot_client.post(url, json=body)
    assert response.status == (202 if native else 200)
    try:
        for _ in range(100):
            if provider.last_turn:
                break
            await asyncio.sleep(.01)
        active_task = provider.last_turn.task_input_json
        active_ref = json.loads(active_task)['context_ref']
        active_raw = store.read(active_ref)
        state = bot_turns.ACTIVE_TURNS[chat['id']]
        state.handle._hermes = {'submitted': True, 'run_id': None}
        # Exercise the real unknown-submission stop branch, without any network.
        monkeypatch.setattr(provider, 'stop', HermesProvider().stop)
        queued = []
        for text in ['queued first', 'queued second']:
            url, body = request(chat, False, text=text,
                                draft={'content': {'nodes': [{'id': 0}]}})
            response = await bot_client.post(url, json=body)
            assert response.status == 200
            data = await response.json()
            assert data['queued']
            task = bot_turns.QUEUED[chat['id']][-1]['task_input_json']
            queued.append((data['user_message']['id'], json.loads(task)['context_ref']))
        assert store.stats()['records'] == 3

        deletion = await bot_client.delete(f"/comfytv/bot/chats/{chat['id']}")
        assert deletion.status == 500
        assert state.handle.stop_requested
        assert storage.get_bot_chat(chat['id']) is not None
        assert bot_turns.ACTIVE_TURNS[chat['id']] is state
        assert chat['id'] not in bot_turns.QUEUED
        assert store.read(active_ref) == active_raw
        assert provider.last_turn.task_input_json == active_task
        assert store.stats()['records'] == 1, 'discarded queued contexts must not remain pinned'
        for message_id, ref in queued:
            with pytest.raises(ValueError, match='submission unavailable'):
                store.submission(message_id)
            with pytest.raises(ValueError):
                store.read(ref)
    finally:
        provider.gate.set()
        await wait_bot_done(bot_client, chat['id'])


@pytest.mark.parametrize('native', [False, True])
async def test_duplicate_json_rejected_before_effects(bot_client, mixed, source, native):
    provider, store = mixed
    chat = storage.create_bot_chat(provider=provider.id)
    url, body = request(chat, native, draft={'content': {'nodes': []}})
    raw = json.dumps(body)[:-1] + ', "draft": {"content":{"nodes":[]}}}'
    response = await bot_client.post(url, data=raw, headers={'Content-Type': 'application/json'})
    assert response.status == 400
    assert storage.list_bot_messages(chat['id']) == []
    assert store.stats()['records'] == 0



async def test_native_preparation_race_never_queues(bot_client, mixed, source, monkeypatch):
    import threading
    provider, store = mixed
    provider.gate = asyncio.Event()
    chat = storage.create_bot_chat(provider=provider.id)
    original = helper().build_manifest
    gate = threading.Event()
    entered = []
    def hold(ids):
        entered.append(1)
        assert gate.wait(5)
        return original(ids)
    monkeypatch.setattr(helper(), 'build_manifest', hold)
    url, body = request(chat, True, draft={'content': {'nodes': []}})
    first = asyncio.create_task(bot_client.post(url, json=body))
    second = asyncio.create_task(bot_client.post(url, json=body))
    for _ in range(100):
        if len(entered) == 2: break
        await asyncio.sleep(.01)
    gate.set()
    responses = await asyncio.gather(first, second)
    assert sorted(r.status for r in responses) == [202, 409]
    assert chat['id'] not in bot_turns.QUEUED
    assert len(storage.list_bot_messages(chat['id'])) == 2
    assert store.stats()['records'] == 1
    provider.gate.set()
    await wait_bot_done(bot_client, chat['id'])


async def test_chat_deleted_during_prepare_rejects_without_orphans(bot_client, mixed, source, monkeypatch):
    import threading
    provider, store = mixed
    chat = storage.create_bot_chat(provider=provider.id)
    original = helper().build_manifest
    gate, entered = threading.Event(), threading.Event()
    def hold(ids):
        entered.set()
        assert gate.wait(5)
        return original(ids)
    monkeypatch.setattr(helper(), 'build_manifest', hold)
    url, body = request(chat, True, draft={'content': {'nodes': []}})
    pending = asyncio.create_task(bot_client.post(url, json=body))
    for _ in range(100):
        if entered.is_set(): break
        await asyncio.sleep(.01)
    storage.delete_bot_chat(chat['id'])
    gate.set()
    response = await pending
    assert response.status in (400, 404, 409)
    assert storage.list_bot_messages(chat['id']) == []
    assert store.stats()['records'] == 0


@pytest.mark.parametrize('new', [False, True])
async def test_cache_admission_failure_rolls_back_messages_and_new_chat(bot_client, mixed, source, monkeypatch, new):
    provider, store = mixed
    chat = storage.create_bot_chat(provider=provider.id)
    before = storage.list_bot_chats()
    def fail(*args, **kwargs): raise ValueError('injected cache failure')
    monkeypatch.setattr(store, 'bind', fail)
    url, body = request(chat, True, draft={'content': {'nodes': []}})
    if new:
        url = '/comfytv/agent/threads/new/messages'
        body['provider'] = provider.id
    response = await bot_client.post(url, json=body)
    assert response.status == 400
    assert storage.list_bot_chats() == before
    assert storage.list_bot_messages(chat['id']) == []
    assert store.stats()['records'] == 0


async def test_malformed_stored_preferences_rejected_before_decode(bot_client, mixed, source, monkeypatch):
    provider, store = mixed
    chat = storage.create_bot_chat(provider=provider.id)
    storage.update_bot_chat(chat['id'], prefs=[False])
    reads = []
    monkeypatch.setattr(helper(), 'build_manifest', lambda _: reads.append(1))
    url, body = request(chat, True, draft={'content': {'nodes': []}})
    response = await bot_client.post(url, json=body)
    assert response.status == 400
    assert not reads
    assert storage.list_bot_messages(chat['id']) == []


async def test_queue_drain_keeps_model_preferences_and_payload(bot_client, mixed, source, monkeypatch):
    provider, store = mixed
    chat = storage.create_bot_chat(provider=provider.id)
    storage.update_bot_chat(chat['id'], prefs=['at acceptance'])
    model = ['model-before']
    monkeypatch.setattr(bot_turns, '_provider_model', lambda _: model[0])
    monkeypatch.setitem(bot_turns.ACTIVE_TURNS, chat['id'], object())
    url, body = request(chat, False, draft={'content': {'nodes': [{'id': 0}]}})
    response = await bot_client.post(url, json=body)
    assert (await response.json())['queued']
    frozen = bot_turns.QUEUED[chat['id']][0]['task_input_json']
    model[0] = 'model-after'
    storage.update_bot_chat(chat['id'], prefs=['after'])
    bot_turns.ACTIVE_TURNS.pop(chat['id'])
    bot_turns._drain_queue(chat['id'])
    await wait_bot_done(bot_client, chat['id'])
    assert provider.last_turn.task_input_json == frozen
    assert provider.last_turn.model == 'model-before'


async def test_admission_uses_latest_session_after_preparation(bot_client, mixed, source):
    from ComfyTV.api import bot_send
    provider, store = mixed
    chat = storage.create_bot_chat(provider=provider.id)
    prepared = await bot_send.prepare_image_refs(chat, ['asset:7'], 'exact', native=True, body={'draft': {'content': {'nodes': []}}})
    storage.update_bot_chat(chat['id'], resume_token='latest-session')
    bot_send.admit_image_refs(chat, prepared, native=True)
    await wait_bot_done(bot_client, chat['id'])
    assert provider.last_turn.resume_token == 'latest-session'
