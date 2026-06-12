import { defineStore } from 'pinia'
import { reactive } from 'vue'

import { apiFetch, apiSend } from '@/api'
import {
  DeleteEntrySchema,
  type Entry,
  ListEntriesSchema,
  UpsertEntrySchema,
} from '@/api/schemas'
import { app } from '@/lib/comfyApp'
import { LABEL_RE, MENTION_RE } from '@/utils/labelRegex'

export const ENTRY_KINDS = ['fragment'] as const
export type EntryKind = typeof ENTRY_KINDS[number]

export interface UpsertOpts {
  id?: number
  kind: EntryKind
  label: string
  content: string
  metadata?: Record<string, unknown>
}

export const useEntryStore = defineStore('entries', () => {
  const byProject = reactive<Map<string, Entry[]>>(new Map())
  const hydrated = reactive<Map<string, 'in-flight' | 'fetched'>>(new Map())

  async function _hydrate(projectId: string): Promise<void> {
    if (!projectId || hydrated.get(projectId)) return
    hydrated.set(projectId, 'in-flight')
    try {
      const data = await apiFetch(
        `/comfytv/projects/${encodeURIComponent(projectId)}/entries`,
        ListEntriesSchema,
      )
      byProject.set(projectId, data.entries)
      hydrated.set(projectId, 'fetched')
    } catch (e) {
      console.warn('[ComfyTV/entries] hydrate failed', projectId, e)
      hydrated.delete(projectId)
    }
  }

  function list(projectId: string, kind?: EntryKind): Entry[] {
    if (projectId && !hydrated.has(projectId)) void _hydrate(projectId)
    const all = byProject.get(projectId) ?? []
    return kind ? all.filter(e => e.kind === kind) : all
  }

  function findByLabel(projectId: string, label: string): Entry[] {
    return (byProject.get(projectId) ?? []).filter(e => e.label === label)
  }

  async function upsert(projectId: string, opts: UpsertOpts): Promise<Entry | null> {
    if (!projectId || !LABEL_RE.test(opts.label)) return null
    try {
      const data = await apiSend(
        `/comfytv/projects/${encodeURIComponent(projectId)}/entries`,
        'POST',
        UpsertEntrySchema,
        opts,
      )
      const row = data.entry
      const list = byProject.get(projectId) ?? []
      const i = list.findIndex(e => e.id === row.id)
      if (i >= 0) list[i] = row
      else list.push(row)
      byProject.set(projectId, [...list])
      return row
    } catch (e) {
      console.warn('[ComfyTV/entries] upsert failed', opts.label, e)
      return null
    }
  }

  async function remove(projectId: string, id: number): Promise<void> {
    if (!projectId) return
    const list = byProject.get(projectId) ?? []
    byProject.set(projectId, list.filter(e => e.id !== id))
    try {
      await apiSend(
        `/comfytv/projects/${encodeURIComponent(projectId)}/entries/${id}`,
        'DELETE',
        DeleteEntrySchema,
      )
    } catch (e) {
      console.warn('[ComfyTV/entries] delete failed', id, e)
    }
  }

  function expand(projectId: string, text: string): string {
    if (!text || !text.includes('@')) return text
    const all = byProject.get(projectId)
    if (!all || all.length === 0) return text
    return text.replace(MENTION_RE, (match, label) => {
      const hit = all
        .filter(e => e.label === label)
        .sort((a, b) => a.id - b.id)[0]
      return hit ? hit.content : match
    })
  }

  function installWebSocketSync(): void {
    const api = (app as any)?.api
    if (!api?.addEventListener) return
    api.addEventListener('comfytv-entries', (event: any) => {
      const detail = event?.detail ?? event
      const pid = detail?.project_id
      if (!pid) return
      hydrated.delete(pid)
      void _hydrate(pid)
    })
  }

  return {
    byProject,
    list,
    findByLabel,
    upsert,
    remove,
    expand,
    installWebSocketSync,
    _hydrate,
  }
})
