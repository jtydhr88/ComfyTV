import { ref, type Ref } from 'vue'

import type { Entry } from '@/api/schemas'
import { ENTRY_KINDS, useEntryStore, type EntryKind } from '@/stores/entryStore'
import { downloadBlob } from '@/utils/download'
import { isValidLabel } from '@/utils/labelRegex'
import { t } from '@/i18n'

export function useEntryTransfer(projectId: Ref<string>, allRows: Ref<Entry[]>) {
  const entryStore = useEntryStore()
  const ioStatus = ref('')

  function exportEntries() {
    const rows = allRows.value.map(e => ({
      kind: e.kind,
      label: e.label,
      content: e.content,
      metadata: e.metadata,
    }))
    if (rows.length === 0) {
      ioStatus.value = t('entries.exportEmpty')
      return
    }
    const payload = {
      comfytv_entries: 1,
      project_id: projectId.value,
      exported_at: new Date().toISOString(),
      entries: rows,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const stamp = new Date().toISOString().slice(0, 10)
    downloadBlob(`comfytv-entries-${projectId.value}-${stamp}.json`, blob)
    ioStatus.value = ''
  }

  async function importFromFile(file: File) {
    let rows: unknown
    try {
      const parsed = JSON.parse(await file.text())
      rows = Array.isArray(parsed) ? parsed : parsed?.entries
    } catch {
      rows = null
    }
    if (!Array.isArray(rows)) {
      ioStatus.value = t('entries.importError')
      return
    }
    let added = 0, dup = 0, invalid = 0
    for (const r of rows as any[]) {
      const kind: EntryKind = (ENTRY_KINDS as readonly string[]).includes(r?.kind) ? r.kind : 'fragment'
      const label = typeof r?.label === 'string' ? r.label : ''
      const content = typeof r?.content === 'string' ? r.content : ''
      if (!isValidLabel(label) || !content.trim()) { invalid++; continue }
      const metadata = (r?.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata))
        ? r.metadata as Record<string, unknown>
        : {}
      const identical = allRows.value.some(e =>
        e.kind === kind && e.label === label && e.content === content
        && JSON.stringify(e.metadata) === JSON.stringify(metadata))
      if (identical) { dup++; continue }
      const saved = await entryStore.upsert(projectId.value, { kind, label, content, metadata })
      if (!saved) { invalid++; continue }
      added++
    }
    ioStatus.value = t('entries.importResult', { added, dup, invalid })
  }

  return { ioStatus, exportEntries, importFromFile }
}
