import { remapMentionTokens } from '@/composables/stages/imageSlotMentions'
import {
  applyPositions,
  dropLegacyRefs,
  type MediaEntry,
  type MediaTable,
  type MediaType,
  MEDIA_TYPES,
  moveEntry,
  type PositionRemap,
  positionRemap,
  readMediaTable,
  reconcileTable,
  tablesEqual,
  writeMediaTable,
} from '@/composables/stages/mediaOrder'
import { app } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'
import { usePinnedBatchStore } from '@/stores/pinnedBatchStore'
import { useProjectStore } from '@/stores/projectStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { useStageStore } from '@/stores/stageStore'
import { getWidget, writeWidget } from '@/utils/widget'

export type RemovedToken = { type: MediaType; position: number }

export function rewritePromptTokens(node: unknown, remap: PositionRemap): RemovedToken[] {
  const w = getWidget(node as any, 'main_prompt')
  if (!w) return []
  const text = String(w.value ?? '')
  if (!text.includes('@')) return []
  const { text: next, removed } = remapMentionTokens(text, remap)
  if (next !== text) {
    writeWidget(node as any, 'main_prompt', next, { fireCallback: false })
    const st = useStageStore().getStage(node as object)
    if (st) st.mainPrompt = next
  }
  return removed
}

export function syncMediaTable(
  node: unknown,
  graph: any = (app as any)?.graph,
): { changed: boolean; removed: RemovedToken[] } {
  const result = reconcileTable(node, graph)
  if (result.hadLegacy) dropLegacyRefs(node)
  if (!result.changed) return { changed: false, removed: [] }
  writeMediaTable(node, result.table)
  const removed = rewritePromptTokens(node, result.remap)
  for (const r of removed) {
    console.warn(`[ComfyTV/media] @${r.type}_${r.position} removed from prompt — its media left the stage`)
  }
  return { changed: true, removed }
}

function commit(node: unknown, prev: MediaTable, next: MediaTable): RemovedToken[] {
  if (tablesEqual(prev, next)) return []
  writeMediaTable(node, next)
  const remap: PositionRemap = {}
  for (const type of MEDIA_TYPES) {
    const m = positionRemap(prev[type], next[type])
    if (m.size) remap[type] = m
  }
  const removed = rewritePromptTokens(node, remap)
  useSelectionStore().bumpBindings()
  return removed
}

export function appendMediaEntry(node: unknown, type: MediaType, entry: MediaEntry): boolean {
  const prev = readMediaTable(node)
  if (prev[type].some(e => e.key === entry.key)) return false
  const next = { ...prev, [type]: [...prev[type], entry] }
  commit(node, prev, next)
  return true
}

export function removeMediaEntry(node: unknown, type: MediaType, index: number): RemovedToken[] {
  const prev = readMediaTable(node)
  const entry = prev[type][index]
  if (!entry) return []
  if (entry.src === 'link') {
    const n = node as any
    const idx = (n?.inputs ?? []).findIndex((i: any) => i?.link != null && Number(i.link) === entry.link)
    if (idx >= 0) {
      n.disconnectInput(idx)
      ;(app as any)?.graph?.setDirtyCanvas?.(true, true)
    }
    return syncMediaTable(node).removed
  }
  const next = { ...prev, [type]: prev[type].filter((_, i) => i !== index) }
  return commit(node, prev, next)
}

export function moveMediaEntry(node: unknown, type: MediaType, from: number, to: number): void {
  const prev = readMediaTable(node)
  commit(node, prev, { ...prev, [type]: moveEntry(prev[type], from, to) })
}

export function setMediaPositions(node: unknown, type: MediaType, positions: number[]): void {
  const prev = readMediaTable(node)
  commit(node, prev, { ...prev, [type]: applyPositions(prev[type], positions) })
}

export function replaceAssetEntries(
  node: unknown,
  entries: Array<{ type: MediaType; entry: MediaEntry }>,
): RemovedToken[] {
  const prev = readMediaTable(node)
  const next: MediaTable = { image: [], video: [], audio: [] }
  for (const type of MEDIA_TYPES) next[type] = prev[type].filter(e => e.src === 'link')
  for (const { type, entry } of entries) {
    if (!next[type].some(e => e.key === entry.key)) next[type].push(entry)
  }
  return commit(node, prev, next)
}

export function linkInputName(node: unknown, entry: MediaEntry): string | null {
  if (entry.src !== 'link') return null
  const inp = ((node as any)?.inputs ?? []).find(
    (i: any) => i?.link != null && Number(i.link) === entry.link)
  return typeof inp?.name === 'string' ? inp.name : null
}

export function mediaEntryUrl(node: unknown, entry: MediaEntry): string | null {
  if (entry.src === 'link') {
    const name = linkInputName(node, entry)
    if (!name) return null
    const inputs = useStageStore().getStage(node as object)?.inputs ?? []
    return inputs.find(i => i.slot === name)?.content ?? null
  }
  if (entry.src === 'batch') {
    const pid = useProjectStore().currentProjectId || ''
    const urls = usePinnedBatchStore().byId(pid, entry.batch_id!)?.urls ?? []
    return urls[entry.batch_index!] ?? null
  }
  return useAssetStore().byId(entry.asset_id!)?.payload_url ?? null
}

export function mediaEntrySourceNode(
  node: unknown,
  entry: MediaEntry,
  graph: any = (app as any)?.graph,
): any | null {
  if (entry.src !== 'link') return null
  const links = graph?.links
  const link = links
    ? (typeof links.get === 'function' ? links.get(entry.link) : links[entry.link!])
    : graph?.getLink?.(entry.link)
  const originId = link?.origin_id ?? entry.from?.[0]
  if (originId == null) return null
  return graph?.getNodeById?.(originId) ?? null
}
