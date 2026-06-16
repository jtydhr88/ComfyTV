import { BUILDER_COMPOSERS } from './builders'
import { toggleToken } from './text'
import type { PromptModule } from './types'

export const SUBJECT_PLACEHOLDER = '[describe your subject here]'

export interface ApplyContext {
  currentPrompt: string
  params?: Record<string, string>
}

export function fillSubject(body: string, subject: string): string {
  if (!body.includes('{subject}')) return body
  const s = subject.trim()
  return body.replace(/\{subject\}/g, s || SUBJECT_PLACEHOLDER)
}

export function composeBuilder(m: PromptModule, params: Record<string, string>): string {
  const custom = BUILDER_COMPOSERS[m.id]
  if (custom) return custom(params)
  return (m.params ?? [])
    .map(p => (params[p.id] ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

function joinNonEmpty(parts: string[], sep: string): string {
  return parts.map(s => s.trim()).filter(Boolean).join(sep)
}

export function resolveBody(m: PromptModule, ctx: ApplyContext): string {
  if (m.kind === 'builder') return composeBuilder(m, ctx.params ?? {})
  return fillSubject(m.body, ctx.currentPrompt)
}

export function applyModule(m: PromptModule, ctx: ApplyContext): string {
  const body = resolveBody(m, ctx)
  const sep = m.separator ?? ', '
  switch (m.apply) {
    case 'toggle':  return toggleToken(ctx.currentPrompt, body)
    case 'wrap':    return body
    case 'replace': return body
    case 'append':  return joinNonEmpty([ctx.currentPrompt, body], sep)
    case 'prepend': return joinNonEmpty([body, ctx.currentPrompt], sep)
    case 'insert':  return ctx.currentPrompt
    default:        return ctx.currentPrompt
  }
}
