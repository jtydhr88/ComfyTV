import type { Entry } from '@/api/schemas'
import type { EntryKind } from '@/stores/entryStore'

export interface MetaField {
  name: string
  label: string
  type: 'text' | 'textarea'
  placeholder?: string
}

export interface Draft {
  label: string
  content: string
  metadata: Record<string, any>
}

export const KIND_LABELS: Record<EntryKind, string> = {
  fragment: 'Fragments',
  prompt: 'Prompts',
}

export const KIND_META_FIELDS: Record<EntryKind, MetaField[]> = {
  fragment: [],
  prompt: [],
}

export const KIND_CONTENT_PLACEHOLDER: Record<EntryKind, string> = {
  fragment: 'Content this @-token expands to',
  prompt: 'Prompt text; may reference slots as @image_N / @video_N / @audio_N. Inserted expanded, not as a tag.',
}

export function draftFromEntry(e: Entry): Draft {
  return {
    label:    e.label,
    content:  e.content,
    metadata: { ...e.metadata },
  }
}
