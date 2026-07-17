import { computed, watch, type Ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { VideoClip } from '@/composables/stages/videoClipInputs'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

export const TRANSITIONS = [
  'cut',
  'fade', 'dissolve',
  'wipeleft', 'wiperight', 'wipeup', 'wipedown',
  'slideleft', 'slideright',
  'circleopen', 'circleclose',
  'radial', 'pixelize', 'zoomin',
]

export interface Segment {
  slot: string
  in_s: number
  out_s: number
  transition: string
  trans_dur: number
}

export function parseSegments(raw: string): Segment[] {
  try {
    const v = JSON.parse(raw || '[]')
    if (!Array.isArray(v)) return []
    return v.filter((s): s is Segment => !!s && typeof s.slot === 'string')
  } catch {
    return []
  }
}

export function reconcileSegments(saved: Segment[], connectedKeys: string[]): Segment[] {
  const connected = new Set(connectedKeys)
  const kept = saved.filter(s => connected.has(s.slot))
  const known = new Set(kept.map(s => s.slot))
  const added = connectedKeys
    .filter(k => !known.has(k))
    .map(k => ({ slot: k, in_s: 0, out_s: 0, transition: 'cut', trans_dur: 0.5 }))
  return [...kept, ...added]
}

export function useSequenceItems(node: LGraphNode, clips: Ref<VideoClip[]>) {
  const segmentsRaw = useStrWidget(node, 'segments', '')

  const rows = computed<Segment[]>(() =>
    reconcileSegments(parseSegments(segmentsRaw.value), clips.value.map(c => c.key)))

  watch(rows, (v) => {
    const s = v.length ? JSON.stringify(v) : ''
    if (s !== segmentsRaw.value) segmentsRaw.value = s
  }, { immediate: true })

  function writeRows(next: Segment[]): void {
    segmentsRaw.value = next.length ? JSON.stringify(next) : ''
  }

  function moveRow(idx: number, dir: -1 | 1): void {
    const next = [...rows.value]
    const j = idx + dir
    if (idx < 0 || idx >= next.length || j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    writeRows(next)
  }

  function updateRow(idx: number, patch: Partial<Segment>): void {
    const cur = rows.value
    if (idx < 0 || idx >= cur.length) return
    writeRows(cur.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function onTimeInput(idx: number, field: 'in_s' | 'out_s', e: Event): void {
    const v = Number((e.target as HTMLInputElement).value)
    if (!Number.isFinite(v)) return
    updateRow(idx, { [field]: Math.min(3600, Math.max(0, v)) })
  }

  function onTransitionChange(idx: number, e: Event): void {
    updateRow(idx, { transition: (e.target as HTMLSelectElement).value })
  }

  function onDurInput(idx: number, e: Event): void {
    const v = Number((e.target as HTMLInputElement).value)
    if (!Number.isFinite(v)) return
    updateRow(idx, { trans_dur: Math.min(5, Math.max(0.1, v)) })
  }

  return { rows, moveRow, updateRow, onTimeInput, onTransitionChange, onDurInput }
}
