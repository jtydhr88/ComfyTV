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
}

export const KIND_META_FIELDS: Record<EntryKind, MetaField[]> = {
  fragment: [],
}

export const KIND_CONTENT_PLACEHOLDER: Record<EntryKind, string> = {
  fragment: 'Content this @-token expands to',
}

export function draftFromEntry(e: Entry): Draft {
  return {
    label:    e.label,
    content:  e.content,
    metadata: { ...e.metadata },
  }
}
