import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { interactionViewKey } from '../../../services/agent/agentInteractions'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AgentMessage from './AgentMessage.vue'
const approval = { id: 'a'.repeat(32), kind: 'hermes_approval', thread_id: 'thread-A', message_id: 'message-A', revision: 1, state: 'pending', created_at: '2026-10-02T12:00:00Z', expires_at: '2099-10-02T12:02:00Z', can_respond: true, action: { command: 'printf harmless', description: 'Controlled fixture only', redacted: false, truncated: false, approvable: true } }
describe('real native message controls (synthetic fixtures)', () => {
 it('keeps actual workflow Run/Cancel emits separate from Hermes decisions', async () => {
  const wrapper = mount(AgentMessage, { props: { message: { id: 'legacy' as any, role: 'assistant', streaming: true, thinking: false, parts: [{ type: 'runApproval', askId: 'legacy-ask', workflowName: 'Fixture workflow' }] } }, global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: { agent: { runApproval: { lead: 'This tool wants to run the workflow:', question: 'Do you approve?', cancel: 'Cancel', run: 'Run', thisWorkflow: 'this workflow' } } } } })] } })
  await wrapper.findAll('button').find(b => b.text() === 'Run')!.trigger('click')
  expect(wrapper.emitted('answerAsk')).toEqual([['legacy-ask','run']])
  expect(wrapper.emitted('respondInteraction')).toBeUndefined()
  wrapper.unmount()
 })
 it('renders single, multi, Other, free text and batch skip with exact qids', async () => {
  const { action: _action, ...common } = approval
  const interaction = { ...common, kind: 'hermes_question', expires_at: null, questions: [
   { id: 'q0', question: 'Single?', choices: ['A','B'], multi_select: false, allow_other: true },
   { id: 'q1', question: 'Multi?', choices: ['C','D'], multi_select: true, allow_other: true },
   { id: 'q2', question: 'Free?', choices: [], multi_select: false, allow_other: false }
  ] }
  const wrapper = mount(AgentMessage, { props: { message: { id: 'message-A' as any, role: 'assistant', streaming: true, thinking: false, parts: [{ type: 'hermes_interaction', interaction } as any] } }, global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} } })], provide: { [interactionViewKey as symbol]: { now: ref(Date.now()), canRespond: () => true } } } })
  expect(wrapper.text()).toContain('Single?')
  await wrapper.get('input[value="A"]').setValue(true)
  await wrapper.get('input[value="C"]').setValue(true)
  await wrapper.get('input[value="D"]').setValue(true)
  await wrapper.get('textarea[data-qid="q2"]').setValue('human answer')
  await wrapper.get('button[data-action="answer"]').trigger('click')
  expect(wrapper.emitted('respondInteraction')?.[0]).toEqual([{ interaction, decision: { answers: [{ id: 'q0', selected: ['A'] }, { id: 'q1', selected: ['C','D'] }, { id: 'q2', selected: [], other_text: 'human answer' }] } }])
  await wrapper.get('button[data-action="skip"]').trigger('click')
  expect(wrapper.emitted('respondInteraction')?.[1]).toEqual([{ interaction, decision: { skip: true } }])
  wrapper.unmount()
 })
 it('renders distinct approval controls pure text and read-only without channel', () => {
  const wrapper = mount(AgentMessage, { props: { message: { id: 'message-A' as any, role: 'assistant', streaming: true, thinking: false, parts: [{ type: 'hermes_interaction', interaction: { ...approval, action: { ...approval.action, command: '<script>bad()</script>' } } } as any] } }, global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} } })] } })
  expect(wrapper.text()).toContain('Approve once')
  expect(wrapper.text()).toContain('Deny')
  expect(wrapper.find('script').exists()).toBe(false)
  expect(wrapper.findAll('button').every(b => b.attributes('disabled') !== undefined)).toBe(true)
  expect(wrapper.text()).not.toContain('Always allow')
  wrapper.unmount()
 })
})
