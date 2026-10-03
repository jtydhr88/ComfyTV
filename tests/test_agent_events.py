import asyncio

import pytest

from ComfyTV.api import agent_events
from ComfyTV.bot.providers import BotEvent
from server import PromptServer


@pytest.mark.parametrize('level', ['info', 'warn', 'error'])
def test_notice_projects_native_websocket_without_tool_identity(monkeypatch, level):
    sent = []
    monkeypatch.setattr(PromptServer.instance, 'send_sync', lambda *args: sent.append(args))
    ev = BotEvent(t='notice', text='Uncorrelated progress',
                  detail='hermes.tool.completed', is_error=level == 'error')
    agent_events.from_bot_event('thread-a', 'assistant-a', ev, {
        'type': 'notice', 'level': level, 'text': ev.text, 'detail': ev.detail,
    })
    assert sent == [('comfytv_agent_notice', {
        'thread_id': 'thread-a', 'message_id': 'assistant-a',
        'level': level, 'text': ev.text, 'detail': ev.detail,
    })]


async def test_native_notice_arrives_before_turn_completion(bot_client, fake_provider, monkeypatch):
    sent = []
    observed = asyncio.Event()

    def capture(name, data):
        sent.append((name, data))
        if name == 'comfytv_agent_notice':
            observed.set()

    monkeypatch.setattr(PromptServer.instance, 'send_sync', capture)
    fake_provider.script = [BotEvent(t='notice', text='Started search',
                                     detail='hermes.tool.started')]
    fake_provider.gate = asyncio.Event()
    response = await bot_client.post('/comfytv/agent/threads/new/messages', json={
        'content': 'Search', 'provider': fake_provider.id,
    })
    assert response.status == 202
    ack = await response.json()
    try:
        await asyncio.wait_for(observed.wait(), timeout=2)
        assert not any(name == 'comfytv_agent_message_done' for name, _ in sent)
        notices = [data for name, data in sent if name == 'comfytv_agent_notice']
        assert notices == [{
            'thread_id': ack['thread_id'], 'message_id': ack['message_id'],
            'text': 'Started search', 'level': 'info', 'detail': 'hermes.tool.started',
        }]
        response = await bot_client.get(f"/comfytv/agent/threads/{ack['thread_id']}/messages")
        rows = await response.json()
        assert rows[-1]['status'] == 'streaming'
        assert rows[-1]['content']['blocks'] == [{
            'type': 'notice', 'text': 'Started search', 'level': 'info',
            'detail': 'hermes.tool.started',
        }]
    finally:
        fake_provider.gate.set()
    for _ in range(100):
        response = await bot_client.get(f"/comfytv/agent/threads/{ack['thread_id']}/messages")
        rows = await response.json()
        if rows[-1]['status'] != 'streaming':
            assert rows[-1]['status'] == 'complete'
            return
        await asyncio.sleep(0.01)
    pytest.fail('turn did not finish after releasing test gate')
