import { z } from 'zod'
const bytes = (s: string) => new TextEncoder().encode(s).length
const text = (max: number) => z.string().refine(s => bytes(s) <= max)
const timestamp = z.iso.datetime({ offset: true }).refine(s => s.endsWith('Z'))
const common = {
  id: z.string().regex(/^[a-f0-9]{32}$/),
  thread_id: z.string().min(1), message_id: z.string().min(1),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  state: z.enum(['pending','approved','denied','answered','skipped','expired','cancelled','undeliverable','stale','dispatching','delivery_unknown']),
  created_at: timestamp, expires_at: timestamp.nullable(), can_respond: z.boolean()
}
const action = z.strictObject({ command: text(8192), description: text(8192), redacted: z.boolean(), truncated: z.boolean(), approvable: z.boolean() }).refine(a => bytes(a.command) + bytes(a.description) <= 8192)
const question = z.strictObject({ id: z.string().regex(/^q[0-4]$/), question: text(4096), choices: z.array(z.string().max(256)).max(4).refine(a => new Set(a).size === a.length), multi_select: z.boolean(), allow_other: z.boolean() })
export const zTVInteraction = z.discriminatedUnion('kind', [
  z.strictObject({ ...common, kind: z.literal('hermes_approval'), action }),
  z.strictObject({ ...common, kind: z.literal('hermes_question'), questions: z.array(question).min(1).max(5).refine(q => new Set(q.map(x => x.id)).size === q.length) })
]).refine(i => bytes(JSON.stringify(i)) <= 16384)
  .refine(i => i.kind === 'hermes_approval'
    ? i.expires_at !== null && !['answered','skipped'].includes(i.state) && (!i.action.approvable || i.action.command.trim().length > 0)
    : !['approved','denied'].includes(i.state))
export type TVInteraction = z.infer<typeof zTVInteraction>
export const zInteractionSnapshot = z.strictObject({ schema_version: z.literal(1), thread_id: z.string(), interactions: z.array(zTVInteraction) }).refine(s => s.interactions.every(i => i.thread_id === s.thread_id) && new Set(s.interactions.map(i => i.id)).size === s.interactions.length)
export const zInteractionResult = z.strictObject({ schema_version: z.literal(1), interaction: zTVInteraction })
export const zInteractionEvent = z.strictObject({ type: z.literal('agent_interaction'), data: z.strictObject({ thread_id: z.string(), message_id: z.string(), interaction: zTVInteraction }).refine(d => d.thread_id === d.interaction.thread_id && d.message_id === d.interaction.message_id) })
export type QuestionAnswer = { id: string; selected: string[]; other_text?: string }
export type InteractionDecision = { choice: 'once' | 'deny' } | { answers: QuestionAnswer[] } | { skip: true }
export type InteractionResponse = { interaction: TVInteraction; decision: InteractionDecision }
export function validInteractionDecision(i: TVInteraction, decision: unknown): boolean {
 const approval = z.strictObject({ choice: z.enum(['once','deny']) })
 const answer = z.strictObject({ id: z.string(), selected: z.array(z.string()).max(4), other_text: text(8192).optional() })
 const question = z.union([z.strictObject({ skip: z.literal(true) }), z.strictObject({ answers: z.array(answer).min(1).max(5) })])
 const parsed = (i.kind === 'hermes_approval' ? approval : question).safeParse(decision)
 if (!parsed.success || bytes(JSON.stringify({ message_id: i.message_id, revision: i.revision, ...parsed.data })) > 32768) return false
 if (i.kind !== 'hermes_question' || !('answers' in parsed.data)) return true
 const answers = parsed.data.answers
 if (answers.length !== i.questions.length || new Set(answers.map(a => a.id)).size !== answers.length) return false
 return i.questions.every(q => {
  const a = answers.find(a => a.id === q.id)
  if (!a || new Set(a.selected).size !== a.selected.length || a.selected.some(s => !q.choices.includes(s))) return false
  const other = a.other_text !== undefined
  if (other && (!a.other_text!.trim() || (q.choices.length > 0 && !q.allow_other))) return false
  const count = a.selected.length + (other ? 1 : 0)
  return count > 0 && (q.multi_select || count === 1) && (q.choices.length > 0 || other)
 })
}
