import { describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { api } from '@agent/scripts/api'
import { createAgentRestClient } from './agentRestClient'
import { useAgentSession } from '../../composables/agent/useAgentSession'
import { useAgentConversationStore } from '../../stores/agent/agentConversationStore'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import { createI18n } from 'vue-i18n'
import AgentMessage from '../../components/agent/message/AgentMessage.vue'
import { createAgentInteractions } from './agentInteractions'
import { zTVInteraction } from '../../schemas/hermesInteractionSchema'
import { interactionViewKey } from './agentInteractions'
import { createAgentEventTransport } from './agentEventTransport'
import { createAssistantMessage } from './agentMessageParts'
import { toTurnId, parseAgentWsEvent } from '../../schemas/agentApiSchema'
import { normalizeAgentTranscript } from './agentTranscript'
const approval = { id: 'a'.repeat(32), kind: 'hermes_approval', thread_id: 'thread-A', message_id: 'message-A', revision: 1, state: 'pending', created_at: '2026-10-02T12:00:00Z', expires_at: '2099-10-02T12:02:00Z', can_respond: true, action: { command: 'printf harmless', description: 'Controlled fixture only', redacted: false, truncated: false, approvable: true } }
describe('interaction live and persisted vertical slice (controlled fixtures)', () => {
 it('lost POST response reconciles exact terminal GET without inventing unknown or replaying', async () => {
  let canonical = zTVInteraction.parse(approval)
  vi.mocked(api.fetchApi).mockImplementation(async (url: string) => {
   if (url.endsWith('/interactions/channel')) return new Response(JSON.stringify({ schema_version: 1, channel_id: 'fixture-channel', csrf_token: 'fixture-csrf', expires_at: '2099-01-01T00:00:00Z', can_respond: true }))
   if (url.endsWith('/response')) { canonical = { ...canonical, state: 'approved', can_respond: false }; throw new TypeError('controlled lost response') }
   return new Response(JSON.stringify({ schema_version: 1, thread_id: approval.thread_id, interactions: [canonical] }))
  })
  const rest = createAgentRestClient();await rest.interactionChannel.open();rest.interactionChannel.connected.value = true
  let display: any;const controller = createAgentInteractions(rest, i => { display = i })
  await controller.refresh(approval.thread_id);await controller.respond({ interaction: canonical, decision: { choice: 'once' } })
  expect(display.state).toBe('approved');expect(controller.view.canRespond(canonical)).toBe(false)
  rest.interactionChannel.close()
 })
 it.each(['wrong-message','wrong-revision','wrong-content','unknown-http'])('exact projected readback never accepts %s response as settled', async mode => {
  const canonical = zTVInteraction.parse(approval)
  const confirmed = { ...canonical, state: 'approved', can_respond: false }
  vi.mocked(api.fetchApi).mockImplementation(async (url: string) => {
   if (url.endsWith('/interactions/channel')) return new Response(JSON.stringify({ schema_version: 1, channel_id: 'fixture-channel', csrf_token: 'fixture-csrf', expires_at: '2099-01-01T00:00:00Z', can_respond: true }))
   if (url.endsWith('/response')) return new Response(JSON.stringify({ schema_version: 1, interaction: mode === 'wrong-message' ? { ...confirmed, message_id: 'different-message' } : mode === 'wrong-revision' ? { ...confirmed, revision: 2 } : mode === 'wrong-content' ? { ...confirmed, action: { ...approval.action, command: 'different' } } : { ...confirmed, state: 'delivery_unknown' } }), { status: mode === 'unknown-http' ? 202 : 200 })
   return new Response(JSON.stringify({ schema_version: 1, thread_id: approval.thread_id, interactions: [canonical] }))
  })
  const rest = createAgentRestClient(); await rest.interactionChannel.open(); rest.interactionChannel.connected.value = true
  let display: any;const controller = createAgentInteractions(rest, i => { display = i })
  await controller.refresh(approval.thread_id);await controller.respond({ interaction: canonical, decision: { choice: 'once' } })
  expect(display.state).toBe('delivery_unknown');expect(controller.view.canRespond(canonical)).toBe(false)
  rest.interactionChannel.close()
 })
 it('unknown delivery remains visibly unknown and locked across pending readback; no automatic resend', async () => {
  let canonical = zTVInteraction.parse(approval)
  vi.mocked(api.fetchApi).mockImplementation(async (url: string) => {
   if (url.endsWith('/interactions/channel')) return new Response(JSON.stringify({ schema_version: 1, channel_id: 'fixture-channel', csrf_token: 'fixture-csrf', expires_at: '2099-01-01T00:00:00Z', can_respond: true }))
   if (url.endsWith('/response')) throw new Error('controlled disconnected delivery')
   return new Response(JSON.stringify({ schema_version: 1, thread_id: approval.thread_id, interactions: [canonical] }))
  })
  const rest = createAgentRestClient(); await rest.interactionChannel.open(); rest.interactionChannel.connected.value = true
  let display: any
  const controller = createAgentInteractions(rest, i => { display = i })
  await controller.refresh(approval.thread_id)
  await controller.respond({ interaction: canonical, decision: { choice: 'once' } })
  expect(display.state).toBe('delivery_unknown')
  await controller.refresh(approval.thread_id)
  expect(display.state).toBe('delivery_unknown')
  expect(controller.view.canRespond(canonical)).toBe(false)
  await controller.respond({ interaction: canonical, decision: { choice: 'deny' } })
  canonical = { ...canonical, state: 'denied', can_respond: false }; await controller.refresh(approval.thread_id)
  expect(display.state).toBe('denied')
  rest.interactionChannel.close()
 })
 it.each(['disconnected','no-channel','expired','stale','delivery_unknown','remote-can-false'])('disables real mounted approval for %s', async mode => {
  const i: any = { ...approval, ...(mode === 'expired' ? { expires_at: '2000-01-01T00:00:00Z' } : {}), ...(['stale','delivery_unknown'].includes(mode) ? { state: mode } : {}), ...(mode === 'remote-can-false' ? { can_respond: false } : {}) }
  vi.mocked(api.fetchApi).mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith('/interactions/channel') ? { schema_version: 1, channel_id: 'fixture-channel', csrf_token: 'fixture-csrf', expires_at: '2099-01-01T00:00:00Z', can_respond: true } : { schema_version: 1, thread_id: i.thread_id, interactions: [i] })))
  const rest = createAgentRestClient(); if (mode !== 'no-channel') await rest.interactionChannel.open(); rest.interactionChannel.connected.value = mode !== 'disconnected'
  const controller = createAgentInteractions(rest, () => {}); await controller.refresh(i.thread_id)
  const wrapper = mount(AgentMessage, { props: { message: { id: i.message_id, role: 'assistant', streaming: false, thinking: false, parts: [{ type: 'hermes_interaction', interaction: i }] } }, global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} } })], provide: { [interactionViewKey as symbol]: controller.view } } })
  expect(wrapper.findAll('button').every(b => b.attributes('disabled') !== undefined)).toBe(true)
  wrapper.unmount(); rest.interactionChannel.close()
 })
 it('legacy workflow conflict reads history and never synthesizes answered', async () => {
  localStorage.clear(); setActivePinia(createPinia())
  vi.mocked(api.fetchApi).mockImplementation(async (url: string, init?: RequestInit) => {
   if (url.endsWith('/answer')) return new Response(JSON.stringify({ error: 'conflict' }), { status: 409 })
   if (url.endsWith('/messages')) return new Response(JSON.stringify([{ id: 'legacy-message', turn_id: 'legacy-message', seq: 1, role: 'assistant', status: 'streaming', content: {}, pending_ask: { kind: 'run_approval', message_id: 'legacy-message', ask_id: 'legacy-ask', prompt: 'Run workflow?', options: [], min_selections: 1, max_selections: 1, allow_other: false } }]))
   return new Response(JSON.stringify({}))
  })
  const session = useAgentSession({ rest: createAgentRestClient(), events: { subscribe: () => () => {} } })
  const store = useAgentConversationStore();store.setThreadId('legacy-thread');store.startTurn(toTurnId('legacy-message'))
  store.ingest({ type: 'agent_ask', data: { kind: 'run_approval', thread_id: 'legacy-thread', message_id: 'legacy-message', ask_id: 'legacy-ask', prompt: 'Run workflow?', options: [], min_selections: 1, max_selections: 1, allow_other: false } })
  await session.answerAsk('legacy-ask','run')
  expect(store.messages[0].parts.some(p => p.type === 'runApproval')).toBe(true)
  expect(vi.mocked(api.fetchApi).mock.calls.some(([url]: any[]) => String(url).endsWith('/messages'))).toBe(true)
  session.stop()
 })
 it('broadcast cannot confirm settlement or replace immutable action before canonical GET', async () => {
  localStorage.clear(); setActivePinia(createPinia())
  let listener: (raw: unknown) => void = () => {}
  let delay = false
  vi.mocked(api.fetchApi).mockImplementation(async (url: string) => {
   if (url.endsWith('/interactions/channel')) return new Response(JSON.stringify({ schema_version: 1, channel_id: 'fixture-channel', csrf_token: 'fixture-csrf', expires_at: '2099-01-01T00:00:00Z', can_respond: true }))
   if (url.endsWith('/interactions')) { if (delay) return new Promise(() => {}); return new Response(JSON.stringify({ schema_version: 1, thread_id: approval.thread_id, interactions: [approval] })) }
   return new Response(JSON.stringify([]))
  })
  const session = useAgentSession({ rest: createAgentRestClient(), events: { subscribe: cb => { listener = cb; return () => {} }, onStatus: cb => { cb(true); return () => {} } } })
  const store = useAgentConversationStore(); session.start(); store.setThreadId(approval.thread_id); store.startTurn(toTurnId(approval.message_id))
  listener({ type: 'agent_interaction', data: { thread_id: approval.thread_id, message_id: approval.message_id, interaction: approval } }); await flushPromises()
  delay = true
  listener({ type: 'agent_interaction', data: { thread_id: approval.thread_id, message_id: approval.message_id, interaction: { ...approval, state: 'approved', action: { ...approval.action, command: 'changed malicious command' } } } })
  const p: any = store.messages.at(-1)?.parts.find(p => p.type === 'hermes_interaction')
  expect(p.interaction.state).not.toBe('approved')
  expect(p.interaction.action.command).toBe(approval.action.command)
  expect(session.interactionView?.canRespond(p.interaction)).toBe(false)
  session.stop()
 })
 it.each([200,409])('mounted pending click posts exact bound response and reads canonical settlement (%s)', async status => {
  localStorage.clear(); setActivePinia(createPinia())
  let listener: (raw: unknown) => void = () => {}
  let canonical: any = { ...approval }
  const sent: any[] = []
  vi.mocked(api.fetchApi).mockImplementation(async (url: string, init?: RequestInit) => {
   if (url.endsWith('/interactions/channel')) return new Response(JSON.stringify({ schema_version: 1, channel_id: 'fixture-channel', csrf_token: 'fixture-csrf', expires_at: '2099-01-01T00:00:00Z', can_respond: true }))
   if (url.endsWith('/response')) { sent.push({ url, init, body: JSON.parse(String(init?.body)) }); canonical = { ...canonical, state: status === 409 ? 'denied' : 'approved', can_respond: false }; return new Response(JSON.stringify(status === 409 ? { error: 'conflict' } : { schema_version: 1, interaction: canonical }), { status }) }
   if (url.endsWith('/interactions')) return new Response(JSON.stringify({ schema_version: 1, thread_id: approval.thread_id, interactions: [canonical] }))
   return new Response(JSON.stringify([]))
  })
  const session: any = useAgentSession({ rest: createAgentRestClient(), events: { subscribe: cb => { listener = cb; return () => {} }, onStatus: cb => { cb(true); return () => {} } } })
  const store = useAgentConversationStore()
  store.setThreadId(approval.thread_id); store.startTurn(toTurnId(approval.message_id))
  const wrapper = mount(defineComponent({ setup() { provide(interactionViewKey, session.interactionView); return () => h('div', store.messages.map(message => h(AgentMessage, { message, onRespondInteraction: session.respondInteraction }))) } }), { global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} } })] } })
  session.start(); await flushPromises()
  store.startTurn(toTurnId(approval.message_id))
  listener({ type: 'agent_interaction', data: { thread_id: approval.thread_id, message_id: approval.message_id, interaction: approval } })
  await flushPromises()
  const button = wrapper.findAll('button').find(b => b.text() === 'Approve once')!
  expect(button.exists()).toBe(true); expect(button.attributes('disabled')).toBeUndefined()
  await button.trigger('click'); await flushPromises()
  expect(sent).toHaveLength(1)
  expect(sent[0].body).toEqual({ message_id: approval.message_id, revision: 1, choice: 'once' })
  expect(sent[0].init.headers['X-ComfyTV-Interaction-CSRF']).toBe('fixture-csrf')
  expect(wrapper.text()).toContain(status === 409 ? 'denied' : 'approved')
  expect(wrapper.text()).not.toContain('answered')
  session.stop(); wrapper.unmount()
 })
 it('routes a typed pending card and preserves canonical settlement through reload', () => {
  const event = parseAgentWsEvent({ type: 'agent_interaction', data: { thread_id: approval.thread_id, message_id: approval.message_id, interaction: approval } })
  expect(event.success).toBe(true)
  const message = createAssistantMessage(toTurnId(approval.message_id))
  const transport = createAgentEventTransport(message, () => {})
  if (event.success) transport.ingest(event.data)
  expect(message.parts).toEqual([{ type: 'hermes_interaction', interaction: { ...approval, can_respond: false } }])
  const history: any = [{ id: approval.message_id, turn_id: approval.message_id, seq: 1, role: 'assistant', status: 'completed', content: { blocks: [{ type: 'hermes_interaction', interaction: { ...approval, state: 'denied' } }] } }]
  expect(normalizeAgentTranscript(history).messages[0].parts).toEqual([{ type: 'hermes_interaction', interaction: { ...approval, state: 'denied', can_respond: false } }])
 })
})
