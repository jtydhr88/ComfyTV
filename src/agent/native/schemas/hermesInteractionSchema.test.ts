import { describe, it, expect } from 'vitest'
import { zTVInteraction, zInteractionSnapshot, validInteractionDecision } from './hermesInteractionSchema'
export const approval = { id: 'a'.repeat(32), kind: 'hermes_approval', thread_id: 'thread-A', message_id: 'message-A', revision: 1, state: 'pending', created_at: '2026-10-02T12:00:00Z', expires_at: '2099-10-02T12:02:00Z', can_respond: true, action: { command: 'printf harmless', description: 'Controlled fixture only', redacted: false, truncated: false, approvable: true } }
describe('frozen TV interaction projection', () => {
 it('rejects kind-incompatible settlements, indefinite approvals and unrenderable approvable commands', () => {
  for (const value of [{ ...approval, expires_at: null }, { ...approval, state: 'answered' }, { ...approval, state: 'skipped' }, { ...approval, action: { ...approval.action, command: '  ' } }]) expect(zTVInteraction.safeParse(value).success).toBe(false)
  const { action: _action, ...common } = approval
  const q = { ...common, kind: 'hermes_question', questions: [{ id: 'q0', question: 'Question', choices: [], multi_select: false, allow_other: false }] }
  for (const state of ['approved','denied']) expect(zTVInteraction.safeParse({ ...q, state }).success).toBe(false)
 })
 it('rejects permanent grants, wrong-kind decisions, malformed batches and exact UTF8 overlimits', () => {
  const i = zTVInteraction.parse(approval)
  expect(validInteractionDecision(i, { choice: 'once' })).toBe(true)
  for (const decision of [{ choice: 'always' }, { choice: 'once', all: true }, { answers: [] }, { skip: true }, { choice: 'deny', run_id: 'x' }]) expect(validInteractionDecision(i, decision)).toBe(false)
  const { action: _action, ...common } = approval
  const q = zTVInteraction.parse({ ...common, kind: 'hermes_question', questions: [{ id: 'q0', question: 'Choose', choices: ['A','B'], multi_select: false, allow_other: true }, { id: 'q1', question: 'Open', choices: [], multi_select: false, allow_other: false }] })
  const valid = { answers: [{ id: 'q0', selected: ['A'] }, { id: 'q1', selected: [], other_text: 'x'.repeat(8192) }] }
  expect(validInteractionDecision(q, valid)).toBe(true)
  expect(validInteractionDecision(q, { skip: true })).toBe(true)
  for (const decision of [{ ...valid, skip: true }, { choice: 'once' }, { answers: valid.answers.slice(0,1) }, { answers: [{ id: 'q0', selected: ['A','A'] }, valid.answers[1]] }, { answers: [{ id: 'q0', selected: ['A'], other_text: 'also' }, valid.answers[1]] }, { answers: [{ id: 'q0', selected: ['invented'] }, valid.answers[1]] }, { answers: [valid.answers[0], { id: 'q1', selected: [], other_text: '中'.repeat(2731) }] }, { answers: [valid.answers[0], { id: 'q1', selected: [], other_text: '   ' }] }]) expect(validInteractionDecision(q, decision)).toBe(false)
 })
 it('accepts exact approval and snapshot but rejects unknown secrets and kind crossover', () => {
  expect(zTVInteraction.safeParse(approval).success).toBe(true)
  expect(zInteractionSnapshot.safeParse({ schema_version: 1, thread_id: 'thread-A', interactions: [approval] }).success).toBe(true)
  for (const value of [{ ...approval, run_id: 'secret' }, { ...approval, questions: [] }, { ...approval, revision: true }, { ...approval, state: 'running' }, { ...approval, action: { ...approval.action, command: 'x'.repeat(8193) } }]) expect(zTVInteraction.safeParse(value).success).toBe(false)
  expect(zInteractionSnapshot.safeParse({ schema_version: 1, thread_id: 'other', interactions: [approval] }).success).toBe(false)
 })
})
