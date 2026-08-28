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
      usage: null,
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

  it('tool events carry id, status and duration', () => {
    const store = seeded()
    store.handleBotEvent({ event: 'turn_tool_use', chat_id: 'c1',
                           message_id: 'm1', id: 'tu-1',
                           name: 'mcp__comfytv__run_stage', input: {} })
    store.handleBotEvent({ event: 'turn_tool_result', chat_id: 'c1',
                           message_id: 'm1', id: 'tu-1', status: 'error',
                           duration_ms: 420,
                           name: 'mcp__comfytv__run_stage', text: 'boom' })
    const [use, result] = store.messages[0].blocks
    expect(use.id).toBe('tu-1')
    expect(result).toMatchObject({
      id: 'tu-1', status: 'error', duration_ms: 420,
    })
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

  it('turn_done clears busy, sets status, title and an error notice', () => {
    const store = seeded()
    store.chats = [{ ...chat(), busy: true } as any]
    store.handleBotEvent({ event: 'turn_done', chat_id: 'c1',
                           message_id: 'm1', status: 'error',
                           error: 'boom', title: 'derived' })
    expect(store.chats[0].busy).toBe(false)
    expect(store.chats[0].title).toBe('derived')
    expect(store.messages[0].status).toBe('error')
    expect(store.messages[0].blocks.at(-1)).toEqual({
      type: 'notice', level: 'error', text: 'boom',
    })
  })

  it('queued send appends the message without marking busy', async () => {
    const store = seeded()
    const fetchApi = (app as any).api.fetchApi
    fetchApi.mockResolvedValueOnce(jsonResp({
      queued: true,
      user_message: message({ id: 'u9', role: 'user', status: 'queued' }),
    }))
    await store.send('later please')
    expect(store.messages.some(m => m.id === 'u9' && m.status === 'queued'))
      .toBe(true)
    expect(store.chats[0].busy).not.toBe(true)
  })

  it('message_queued event appends once; turn_start flips its status', () => {
    const store = seeded()
    const queuedMsg = message({ id: 'u9', role: 'user', status: 'queued' })
    store.handleBotEvent({ event: 'message_queued', chat_id: 'c1',
                           user_message: queuedMsg })
    store.handleBotEvent({ event: 'message_queued', chat_id: 'c1',
                           user_message: queuedMsg })
    expect(store.messages.filter(m => m.id === 'u9')).toHaveLength(1)
    store.handleBotEvent({
      event: 'turn_start', chat_id: 'c1',
      user_message: message({ id: 'u9', role: 'user', status: 'done' }),
      assistant_message: message({ id: 'a9' }),
    })
    expect(store.messages.find(m => m.id === 'u9')?.status).toBe('done')
    expect(store.messages.some(m => m.id === 'a9')).toBe(true)
  })

  it('branchChat switches to the new chat with copied messages', async () => {
    const store = seeded()
    const fetchApi = (app as any).api.fetchApi
    fetchApi.mockResolvedValueOnce(jsonResp({
      chat: chat({ id: 'c2', title: 'fork' }),
      messages: [message({ id: 'b1', chat_id: 'c2' })],
    }))
    const ok = await store.branchChat('m1')
    expect(ok).toBe(true)
    expect(fetchApi.mock.calls.at(-1)?.[0])
      .toBe('/comfytv/bot/chats/c1/branch')
    expect(store.activeChatId).toBe('c2')
    expect(store.messages.map(m => m.id)).toEqual(['b1'])
  })

  it('turn_ask appends an ask block once and resolution updates it', () => {
    const store = seeded()
    const ask = {
      event: 'turn_ask', chat_id: 'c1', message_id: 'm1', ask_id: 'ask-1',
      prompt: 'Run it?', options: [{ id: 'run', label: 'Run' },
                                   { id: 'cancel', label: 'Cancel' }],
      min_selections: 1, max_selections: 1, allow_other: false,
      kind: 'run_approval',
    }
    store.handleBotEvent(ask)
    store.handleBotEvent(ask)
    const blocks = store.messages[0].blocks.filter(b => b.type === 'ask')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      ask_id: 'ask-1', status: 'pending', kind: 'run_approval',
    })
    store.handleBotEvent({
      event: 'turn_ask_resolved', chat_id: 'c1', message_id: 'm1',
      ask_id: 'ask-1', status: 'answered', selected: ['run'],
    })
    expect(store.messages[0].blocks.find(b => b.ask_id === 'ask-1'))
      .toMatchObject({ status: 'answered', selected: ['run'] })
  })

  it('answerAsk posts to the ask endpoint', async () => {
    const store = seeded()
    const fetchApi = (app as any).api.fetchApi
    fetchApi.mockResolvedValueOnce(new Response(
      JSON.stringify({ ok: true }),
      { status: 202, headers: { 'content-type': 'application/json' } }))
    const ok = await store.answerAsk('ask-1', ['run'], 'note')
    expect(ok).toBe(true)
    const [path, init] = fetchApi.mock.calls.at(-1)
    expect(path).toBe('/comfytv/bot/chats/c1/asks/ask-1/answer')
    expect(JSON.parse(String(init.body))).toEqual({
      selected: ['run'], other_text: 'note',
    })
  })

  it('turn_done skips a duplicate notice and stores usage', () => {
    const store = seeded()
    store.messages[0].blocks.push({ type: 'notice', level: 'error',
                                    text: 'persisted' })
    const usage = { input_tokens: 12, output_tokens: 4, cost_usd: 0.01 }
    store.handleBotEvent({ event: 'turn_done', chat_id: 'c1',
                           message_id: 'm1', status: 'error',
                           error: 'boom', usage })
    const notices = store.messages[0].blocks.filter(b => b.type === 'notice')
    expect(notices).toHaveLength(1)
    expect(store.messages[0].usage).toEqual(usage)
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

  it('send skips messages the turn_start broadcast already appended', async () => {
    const store = seeded()
    fetchApi.mockImplementation(async () => {
      store.handleBotEvent({
        event: 'turn_start', chat_id: 'c1',
        user_message: message({ id: 'u9', role: 'user', status: 'done',
                                content: '[{"type":"text","text":"hey"}]' }),
        assistant_message: message({ id: 'a9' }),
      })
      return jsonResp({
        user_message: message({ id: 'u9', role: 'user', status: 'done',
                                content: '[{"type":"text","text":"hey"}]' }),
        assistant_message: message({ id: 'a9' }),
      })
    })
    await store.send('hey')
    expect(store.messages.map(m => m.id)).toEqual(['m1', 'u9', 'a9'])
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

  it('deleteChats removes deleted chats and keeps failures', async () => {
    const store = seeded()
    store.chats = [chat(), chat({ id: 'c2' }), chat({ id: 'c3' })] as any
    fetchApi.mockImplementation(async (url: string) =>
      url.endsWith('/c2')
        ? jsonResp({ error: 'boom' }, 500)
        : jsonResp({ ok: true }))
    await store.deleteChats(['c1', 'c2', 'c3'])
    expect(store.chats.map(c => c.id)).toEqual(['c2'])
    expect(store.activeChatId).toBeNull()
  })

  it('newChat requires an available provider', async () => {
    const store = useBotStore()
    store.providers = []
    expect(await store.newChat()).toBeNull()
  })
})
