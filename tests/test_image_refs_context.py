"""Review1: reference turns must never silently discard combined context."""
import asyncio
import pytest
from ComfyTV import storage, skill_store
from ComfyTV.api import bot_turns
from test_image_refs import source, helper


@pytest.fixture
def refs_provider(fake_provider, monkeypatch):
    caps = fake_provider.capabilities()
    caps.attachment_transport = 'asset_refs'
    monkeypatch.setattr(fake_provider, 'capabilities', lambda: caps)
    return fake_provider


def request(chat, native, text='  EXACT\n中文  ', **context):
    if native:
        return f"/comfytv/agent/threads/{chat['id']}/messages", dict(content=text, attachments=['asset:7'], **context)
    return f"/comfytv/bot/chats/{chat['id']}/send", dict(text=text, attachments=[{'asset_id': 7}], **context)


@pytest.mark.parametrize('native', [False, True])
@pytest.mark.parametrize('context', [
    {'refs': [{'kind': 'stage', 'graph_node_id': '42'}]},
    {'selection': {'node_ids': ['42']}}, {'skill': 'selected-skill'},
    {'workflow_id': 'target'}, {'workflow_references': [{'workflow_id': 'saved'}]},
    {'draft': {'content': {'nodes': [{'id': 42}]}}},
    {'tabs': {'active': 'workflow'}}, {'prefs': ['request preference']},
    {'saved_prefs': True}, {'slash': True},
    {'selection': {'node_ids': [0]}}, {'selection': {'node_ids': [False]}},
    {'selection': 0}, {'selection': False}, {'skill': 0}, {'workflow_id': False},
    {'refs': [0]}, {'prefs': [False]}, {'draft': {'nodes': [0]}},
    {'tabs': {'items': [False]}}, {'selection': {'node_ids': False}},
    {'workflow_references': 0},
])
async def test_combined_context_rejected_before_source(bot_client, refs_provider, source, monkeypatch, native, context):
    chat = storage.create_bot_chat(provider=refs_provider.id)
    context = dict(context)
    text = '  EXACT\n中文  '
    if context.pop('saved_prefs', False):
        storage.update_bot_chat(chat['id'], prefs=['saved preference'])
    if context.pop('slash', False):
        monkeypatch.setattr(skill_store, 'find_enabled', lambda name: {'name': name} if name == 'known' else None)
        text = '  /known keep original  '
    reads = []
    original = helper().build_manifest
    def tracked(*args, **kwargs):
        reads.append(args)
        return original(*args, **kwargs)
    monkeypatch.setattr(helper(), 'build_manifest', tracked)
    url, body = request(chat, native, text, **context)
    response = await bot_client.post(url, json=body)
    assert response.status == 400, await response.text()
    result = await response.json()
    assert reads == []
    assert 'unsupported' in result['error'] and 'without' in result['error']
    assert 'workflow_id' not in result
    assert storage.list_bot_messages(chat['id']) == []
    assert chat['id'] not in bot_turns.QUEUED


@pytest.mark.parametrize('native', [False, True])
async def test_empty_defaults_preserve_exact_text_and_resume(bot_client, refs_provider, source, native):
    from conftest import wait_bot_done
    chat = storage.create_bot_chat(provider=refs_provider.id)
    storage.update_bot_chat(chat['id'], resume_token='existing-session', prefs=[])
    text = '  /not-a-skill 中文\n  '
    url, body = request(chat, native, text, selection={'node_ids': []}, refs=[], skill='',
                        workflow_id='', workflow_references=[], tabs={'items': []},
                        draft={'content': {'nodes': [], 'selection': {'node_ids': []}}}, prefs=[])
    response = await bot_client.post(url, json=body)
    assert response.status == (202 if native else 200), await response.text()
    assert 'workflow_id' not in await response.json()
    await wait_bot_done(bot_client, chat['id'])
    assert refs_provider.last_turn.user_text == text
    assert refs_provider.last_turn.resume_token == 'existing-session'


async def test_busy_legacy_rejects_prefs_without_queueing(bot_client, refs_provider, source, monkeypatch):
    chat = storage.create_bot_chat(provider=refs_provider.id)
    storage.update_bot_chat(chat['id'], prefs=['keep me'])
    monkeypatch.setitem(bot_turns.ACTIVE_TURNS, chat['id'], object())
    url, body = request(chat, False)
    response = await bot_client.post(url, json=body)
    assert response.status == 400
    assert chat['id'] not in bot_turns.QUEUED
    assert storage.get_bot_chat(chat['id'])['prefs'] == ['keep me']


@pytest.mark.parametrize('prefs', [['added while queued'], [0], [False]])
async def test_queued_ref_rechecks_preferences_before_provider(bot_client, refs_provider, source, prefs):
    from conftest import wait_bot_done
    chat = storage.create_bot_chat(provider=refs_provider.id)
    refs_provider.gate = asyncio.Event()
    url, body = request(chat, False)
    await bot_client.post(url, json={'text': 'first'})
    response = await bot_client.post(url, json=body)
    assert (await response.json())['queued']
    storage.update_bot_chat(chat['id'], prefs=prefs)
    saved_prefs = storage.get_bot_chat(chat['id'])['prefs']
    refs_provider.gate.set()
    refs_provider.gate = None
    rows = (await wait_bot_done(bot_client, chat['id']))['messages']
    assert refs_provider.last_turn.user_text == 'first'
    assert rows[-1]['status'] == 'error'
    assert 'unsupported' in rows[-1]['content']
    assert storage.get_bot_chat(chat['id'])['prefs'] == saved_prefs


@pytest.mark.parametrize('native', [False, True])
async def test_busy_zero_selection_rejected_before_source_or_queue(bot_client, refs_provider, source, monkeypatch, native):
    chat = storage.create_bot_chat(provider=refs_provider.id)
    monkeypatch.setitem(bot_turns.ACTIVE_TURNS, chat['id'], object())
    reads = []
    monkeypatch.setattr(helper(), 'build_manifest', lambda *args: reads.append(args))
    url, body = request(chat, native, selection={'node_ids': [0]})
    response = await bot_client.post(url, json=body)
    assert response.status == 400
    assert 'selection' in (await response.json())['error']
    assert not reads and chat['id'] not in bot_turns.QUEUED
    assert storage.list_bot_messages(chat['id']) == []


async def test_native_text_only_zero_selection_remains_real_context(bot_client, refs_provider):
    from conftest import wait_bot_done
    chat = storage.create_bot_chat(provider=refs_provider.id)
    url, body = request(chat, True, selection={'node_ids': [0]})
    body['attachments'] = []
    assert (await bot_client.post(url, json=body)).status == 202
    await wait_bot_done(bot_client, chat['id'])
    assert 'Referenced stage: graph node 0' in refs_provider.last_turn.user_text


async def test_native_new_rejection_does_not_create_chat(bot_client, refs_provider):
    before = storage.list_bot_chats()
    response = await bot_client.post('/comfytv/agent/threads/new/messages', json={
        'provider': refs_provider.id, 'content': 'keep me', 'attachments': ['asset:7'],
        'workflow_id': 'unsupported target'})
    assert response.status == 400
    assert storage.list_bot_chats() == before


@pytest.mark.parametrize('native', [False, True])
@pytest.mark.parametrize('inline', [False, True])
async def test_ordinary_composition_unchanged(bot_client, refs_provider, source, monkeypatch, native, inline):
    from conftest import wait_bot_done
    if inline:
        caps = refs_provider.capabilities()
        caps.attachment_transport = 'inline'
        from ComfyTV.runners import media
        monkeypatch.setattr(media, 'localize', lambda url: source[0])
    chat = storage.create_bot_chat(provider=refs_provider.id)
    storage.update_bot_chat(chat['id'], prefs=['PREFERENCE_SENTINEL'])
    url, body = request(chat, native, ' original ')
    if not inline:
        body['attachments'] = []
    response = await bot_client.post(url, json=body)
    assert response.status == (202 if native else 200), await response.text()
    await wait_bot_done(bot_client, chat['id'])
    assert 'PREFERENCE_SENTINEL' in refs_provider.last_turn.user_text
    assert 'original' in refs_provider.last_turn.user_text
    assert not refs_provider.last_turn.attachment_manifest
