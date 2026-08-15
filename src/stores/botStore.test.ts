import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

import {
  applyDelta,
  parseBlocks,
  toChatMessage,
  useBotStore,
  type BotChatMessage,
} from './botStore'

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  })

function chat(over: Partial<any> = {}) {
  return {
    id: 'c1', title: 'hello', provider: 'claude-code', resume_token: null,
    pinned: false, archived: false,
    created_at: '2026-08-13T00:00:00', updated_at: '2026-08-13T00:00:00',
    ...over,
  }
}

function message(over: Partial<any> = {}) {
  return {
    id: 'm1', chat_id: 'c1', parent_id: null, role: 'assistant',
    content: '[]', status: 'streaming', resume_token_after: null,
    created_at: null, ...over,
  }
}

describe('parseBlocks / toChatMessage', () => {
  it('parses valid content and rejects garbage', () => {
    expect(parseBlocks('[{"type":"text","text":"hi"}]')).toEqual([
      { type: 'text', text: 'hi' },
    ])
    expect(parseBlocks('not json')).toEqual([])
    expect(parseBlocks('{"a":1}')).toEqual([])
  })

  it('maps a message row to a chat message', () => {
    const m = toChatMessage(message({
      content: '[{"type":"text","text":"yo"}]', status: 'done',
    }) as any)
    expect(m).toEqual({
      id: 'm1', role: 'assistant', status: 'done',
      blocks: [{ type: 'text', text: 'yo' }],
    })
  })
})

describe('applyDelta', () => {
  it('appends to a trailing text block', () => {
    const msg: BotChatMessage = {
      id: 'm', role: 'assistant', status: 'streaming',
      blocks: [{ type: 'text', text: 'he' }],
    }
    applyDelta(msg, 'llo')
    expect(msg.blocks).toEqual([{ type: 'text', text: 'hello' }])
  })

  it('starts a new text block after a tool block', () => {
    const msg: BotChatMessage = {
      id: 'm', role: 'assistant', status: 'streaming',
      blocks: [{ type: 'tool_use', name: 'x', input: {} }],
    }
    applyDelta(msg, 'done')
    expect(msg.blocks[1]).toEqual({ type: 'text', text: 'done' })
  })
})

describe('botStore events', () => {
  let fetchApi: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchApi = vi.fn()
    ;(app as any).api = { fetchApi, addEventListener: vi.fn() }
  })

  function seeded() {
    const store = useBotStore()
    store.chats = [chat() as any]
    store.activeChatId = 'c1'
    store.messages = [toChatMessage(message() as any)]
    return store
  }

  it('turn_delta appends text to the streaming message', () => {
    const store = seeded()
    store.handleBotEvent({ event: 'turn_delta', chat_id: 'c1',
                           message_id: 'm1', text: 'hi' })
    store.handleBotEvent({ event: 'turn_delta', chat_id: 'c1',
                           message_id: 'm1', text: ' there' })
    expect(store.messages[0].blocks).toEqual([
      { type: 'text', text: 'hi there' },
    ])
  })

  it('ignores deltas for other chats', () => {
    const store = seeded()
    store.handleBotEvent({ event: 'turn_delta', chat_id: 'other',
                           message_id: 'm1', text: 'hi' })
    expect(store.messages[0].blocks).toEqual([])
  })

  it('tool events append blocks', () => {
    const store = seeded()
    store.handleBotEvent({ event: 'turn_tool_use', chat_id: 'c1',
                           message_id: 'm1',
                           name: 'mcp__comfytv__get_canvas', input: { a: 1 } })
    store.handleBotEvent({ event: 'turn_tool_result', chat_id: 'c1',
                           message_id: 'm1',
                           name: 'mcp__comfytv__get_canvas', text: '{}' })
    expect(store.messages[0].blocks.map(b => b.type)).toEqual([
      'tool_use', 'tool_result',
    ])
  })

  it('turn_start marks busy and appends new messages once', () => {
    const store = seeded()
    store.messages = []
    const payload = {
      event: 'turn_start', chat_id: 'c1',
      user_message: message({ id: 'u1', role: 'user', status: 'done' }),
      assistant_message: message({ id: 'a1' }),
    }
    store.handleBotEvent(payload)
    store.handleBotEvent(payload)
    expect(store.messages.map(m => m.id)).toEqual(['u1', 'a1'])
    expect(store.chats[0].busy).toBe(true)
  })

  it('turn_done clears busy, sets status, title and error text', () => {
    const store = seeded()
    store.chats = [{ ...chat(), busy: true } as any]
    store.handleBotEvent({ event: 'turn_done', chat_id: 'c1',
                           message_id: 'm1', status: 'error',
                           error: 'boom', title: 'derived' })
    expect(store.chats[0].busy).toBe(false)
    expect(store.chats[0].title).toBe('derived')
    expect(store.messages[0].status).toBe('error')
    expect(store.messages[0].blocks.at(-1)?.text).toContain('boom')
  })

  it('chat_created/deleted maintain the list', () => {
    const store = seeded()
    store.handleBotEvent({ event: 'chat_created', chat: chat({ id: 'c2' }) })
    expect(store.chats.map(c => c.id)).toEqual(['c2', 'c1'])
    store.handleBotEvent({ event: 'chat_deleted', chat_id: 'c1' })
    expect(store.chats.map(c => c.id)).toEqual(['c2'])
    expect(store.activeChatId).toBeNull()
  })

  it('send posts and appends both messages', async () => {
    const store = seeded()
    fetchApi.mockResolvedValue(jsonResp({
      user_message: message({ id: 'u9', role: 'user', status: 'done',
                              content: '[{"type":"text","text":"hey"}]' }),
      assistant_message: message({ id: 'a9' }),
    }))
    const ok = await store.send('hey')
    expect(ok).toBe(true)
    expect(fetchApi).toHaveBeenCalledWith('/comfytv/bot/chats/c1/send',
      expect.objectContaining({ method: 'POST' }))
    expect(store.messages.map(m => m.id)).toEqual(['m1', 'u9', 'a9'])
    expect(store.chats[0].busy).toBe(true)
  })

  it('send includes attachment asset ids', async () => {
    const store = seeded()
    fetchApi.mockResolvedValue(jsonResp({
      user_message: message({
        id: 'u2', role: 'user', status: 'done',
        content: '[{"type":"image","url":"/view?a","asset_id":7},{"type":"text","text":"look"}]',
      }),
      assistant_message: message({ id: 'a2' }),
    }))
    const ok = await store.send('look', [
      { asset_id: 7, url: '/view?a', name: 'ref', media_type: 'image' },
    ])
    expect(ok).toBe(true)
    const body = JSON.parse(fetchApi.mock.calls[0][1].body)
    expect(body).toEqual({ text: 'look', attachments: [{ asset_id: 7 }] })
    expect(store.messages.at(-2)?.blocks[0]).toEqual(
      { type: 'image', url: '/view?a', asset_id: 7 })
  })

  it('send allows attachments without text', async () => {
    const store = seeded()
    fetchApi.mockResolvedValue(jsonResp({
      user_message: message({ id: 'u3', role: 'user', status: 'done' }),
      assistant_message: message({ id: 'a3' }),
    }))
    expect(await store.send('', [{ asset_id: 1, url: '/x', name: 'n', media_type: 'image' }])).toBe(true)
    expect(await store.send('', [])).toBe(false)
  })

  it('newChat requires an available provider', async () => {
    const store = useBotStore()
    store.providers = []
    expect(await store.newChat()).toBeNull()
  })
})
