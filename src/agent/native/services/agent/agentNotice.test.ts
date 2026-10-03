import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import AgentMessage from '../../components/agent/message/AgentMessage.vue'
import { parseAgentWsEvent, toTurnId } from '../../schemas/agentApiSchema'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { createAgentEventSource } from './agentEventSource'

beforeEach(() => setActivePinia(createPinia()))

function notice(thread_id = 'thread-a', message_id = 'assistant-a', text = 'Progress') {
  const parsed = parseAgentWsEvent({ type: 'agent_notice', data: {
    thread_id, message_id, text, level: 'info', detail: 'hermes.tool.started'
  } })
  if (!parsed.success) throw parsed.error
  return parsed.data
}

function history(status = 'complete'): import('../../schemas/agentApiSchema').AgentMessages {
  return [{
    id: 'assistant-a', thread_id: 'thread-a', turn_id: 'user-a', seq: 2,
    role: 'assistant', status, created_at: '2026-01-01T00:00:00Z',
    content: { text: 'Before\nAfter', blocks: [
      { type: 'text', text: 'Before' },
      { type: 'notice', text: 'Progress', level: 'info', detail: 'hermes.tool.started' },
      { type: 'notice', text: 'Incomplete', level: 'warn' },
      { type: 'text', text: 'After' }
    ] }
  }] as import('../../schemas/agentApiSchema').AgentMessages
}

it('replaces live notices with persisted blocks once on message refresh', () => {
  const store = useAgentConversationStore()
  store.setThreadId('thread-a')
  store.startTurn(toTurnId('assistant-a'))
  store.ingest(notice())
  store.hydrate(history())
  store.hydrate(history())
  store.ingest(notice()) // late event after completion must not recreate a turn
  expect(store.messages).toHaveLength(1)
  expect(store.messages[0]!.parts).toEqual([
    { type: 'text', text: 'Before', state: 'done' },
    { type: 'notice', text: 'Progress', level: 'info', detail: 'hermes.tool.started' },
    { type: 'notice', text: 'Incomplete', level: 'warning' },
    { type: 'text', text: 'After', state: 'done' }
  ])
})

it('continues streaming into the hydrated assistant row after refresh', () => {
  const store = useAgentConversationStore()
  store.setThreadId('thread-a')
  store.hydrate(history('streaming'))
  store.ingest(notice('thread-a', 'assistant-a', 'Next progress'))
  expect(store.isStreaming).toBe(true)
  expect(store.messages).toHaveLength(1)
  expect(store.messages[0]!.parts).toHaveLength(5)
  expect(store.messages[0]!.parts.at(-1)).toMatchObject({ text: 'Next progress' })
})

it.each([false, true])('does not duplicate hydrated notices on background resume (settled=%s)', (settled) => {
  const store = useAgentConversationStore()
  store.setThreadId('thread-a')
  store.startTurn(toTurnId('assistant-a'))
  store.ingest(notice())
  store.stashActiveTurn()
  if (settled) store.ingest({ type: 'agent_message_done', data: { thread_id: 'thread-a', message_id: 'assistant-a' } })
  store.reset()
  store.setThreadId('thread-a')
  store.hydrate(history(settled ? 'complete' : 'streaming'))
  store.resumeBackgroundTurn()
  expect(store.messages).toHaveLength(1)
  expect(store.messages[0]!.parts.filter(p => p.type === 'notice' && p.text === 'Progress')).toHaveLength(1)
  if (settled) expect(store.messages[0]!.parts).toContainEqual({ type: 'notice', text: 'Incomplete', level: 'warning' })
  else {
    store.ingest(notice('thread-a', 'assistant-a', 'Next progress'))
    expect(store.messages[0]!.parts.at(-1)).toMatchObject({ text: 'Next progress' })
  }
})

it.each([
  { message_id: 'assistant-a', text: 'Progress', level: 'info' },
  { thread_id: 'thread-a', text: 'Progress', level: 'info' },
  { thread_id: 'thread-a', message_id: 'assistant-a', text: 'Progress', level: 'success' }
])('rejects notices without valid routing and level: %j', data => {
  expect(parseAgentWsEvent({ type: 'agent_notice', data }).success).toBe(false)
})

it('keeps text and notice order while streaming and ignores late events after done', () => {
  const store = useAgentConversationStore()
  store.setThreadId('thread-a')
  store.startTurn(toTurnId('assistant-a'))
  const data = { thread_id: 'thread-a', message_id: 'assistant-a' }
  store.ingest({ type: 'agent_message_delta', data: { ...data, delta: 'Before' } })
  store.ingest(notice())
  store.ingest({ type: 'agent_message_delta', data: { ...data, delta: 'After' } })
  expect(store.messages[0]!.parts.map(p => p.type)).toEqual(['text', 'notice', 'text'])
  expect(store.messages[0]!.parts[0]).toMatchObject({ state: 'done' })
  store.ingest({ type: 'agent_message_done', data })
  store.ingest(notice())
  expect(store.messages[0]!.parts).toHaveLength(3)
  expect(store.isStreaming).toBe(false)
})

it('routes by both thread and assistant ID, including background turns', () => {
  const store = useAgentConversationStore()
  store.setThreadId('thread-a')
  store.startTurn(toTurnId('assistant-a'))
  store.ingest(notice('thread-b'))
  store.ingest(notice('thread-a', 'another-assistant'))
  expect(store.messages[0]!.parts).toEqual([])
  store.stashActiveTurn()
  store.reset()
  store.setThreadId('thread-b')
  store.startTurn(toTurnId('assistant-b'))
  store.ingest(notice('thread-a', 'assistant-a', 'Background progress'))
  expect(store.messages[0]!.parts).toEqual([])
  store.stashActiveTurn()
  store.reset()
  store.setThreadId('thread-a')
  store.resumeBackgroundTurn()
  expect(store.messages[0]!.parts).toEqual([expect.objectContaining({ text: 'Background progress' })])
})

it('delivers native websocket progress inline while streaming, without tool pairing or alerts for success', async () => {
  const store = useAgentConversationStore()
  store.setThreadId('thread-a')
  store.startTurn(toTurnId('assistant-a'))
  const wrapper = mount(defineComponent(() => () => h(AgentMessage, { message: store.messages[0]! })), {
    global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: { agent: { working: 'Working', thinking: 'Thinking' } } } })] }
  })
  const listeners = new Map<string, (event: CustomEvent<unknown>) => void>()
  const source = createAgentEventSource({
    socket: { readyState: 1 },
    addCustomEventListener: (type, fn) => { listeners.set(type, fn) },
    removeCustomEventListener: (type) => { listeners.delete(type) },
    addEventListener: vi.fn(), removeEventListener: vi.fn()
  })
  const unsubscribe = source.subscribe(raw => {
    const parsed = parseAgentWsEvent(raw)
    expect(parsed.success).toBe(true)
    if (parsed.success) store.ingest(parsed.data)
  })
  expect(listeners.has('comfytv_agent_notice')).toBe(true)
  const send = (text: string, level: string, detail: string) => listeners.get('comfytv_agent_notice')!(new CustomEvent('notice', {
    detail: { thread_id: 'thread-a', message_id: 'assistant-a', text, level, detail }
  }))
  send('Started search', 'info', 'hermes.tool.started')
  send('Started search', 'info', 'hermes.tool.started')
  send('Search completed', 'info', 'hermes.tool.completed')
  send('Telemetry incomplete', 'warn', 'hermes.telemetry')
  send('Search failed', 'error', 'hermes.tool.completed')
  await wrapper.vm.$nextTick()
  expect(store.isStreaming).toBe(true)
  expect(store.messages[0]!.parts.map(p => p.type)).toEqual(Array(5).fill('notice'))
  expect(store.messages[0]!.parts.map(p => 'level' in p && p.level)).toEqual(['info', 'info', 'info', 'warning', 'error'])
  expect(wrapper.findAll('[role="status"]').map(n => n.text())).toEqual(['Started search', 'Started search', 'Search completed', 'Telemetry incomplete'])
  expect(wrapper.findAll('[role="alert"]').map(n => n.text())).toEqual(['Search failed'])
  unsubscribe()
  expect(listeners.size).toBe(0)
  wrapper.unmount()
})
