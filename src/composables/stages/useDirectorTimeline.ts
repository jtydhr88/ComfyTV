import { computed, ref, type Ref } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { readWidgetStr, writeWidget } from '@/utils/widget'

export interface DirectorClip {
  id: string
  enabled: boolean
  workflow: string
  prompt: string
  duration_s: number
  seed: number
  transition: string
  transition_s: number
  images: string[]
  videos: string[]
  audio: string[]
}

export type ChainMode = 'off' | 'prepend' | 'replace'

export const CHAIN_MODES: ChainMode[] = ['off', 'prepend', 'replace']

export const TRANSITIONS = [
  'cut', 'fade', 'dissolve', 'fadeblack', 'fadewhite',
  'wipeleft', 'wiperight', 'wipeup', 'wipedown',
  'slideleft', 'slideright', 'slideup', 'slidedown',
  'smoothleft', 'smoothright', 'circleopen', 'circleclose',
  'radial', 'pixelize', 'zoomin', 'hblur', 'distance',
]

export interface DirectorClipStatus {
  url: string
  cached: boolean
}

export const PPS = 14
export const CLIP_MIN_W = 20
export const CLIP_GAP_PX = 4
export const DURATION_MIN_S = 1
export const DURATION_MAX_S = 120

export function clipWidthPxOf(c: DirectorClip): number {
  return Math.max(CLIP_MIN_W, c.duration_s * PPS)
}

function newId(): string {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

function toUrlList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x).map(String) : []
}

export function normalizeClip(raw: any): DirectorClip {
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : newId(),
    enabled: raw?.enabled !== false,
    workflow: typeof raw?.workflow === 'string' ? raw.workflow : '',
    prompt: typeof raw?.prompt === 'string' ? raw.prompt : '',
    duration_s: Math.max(DURATION_MIN_S, Math.min(DURATION_MAX_S,
      Math.round(Number(raw?.duration_s) || 5))),
    seed: Number.isFinite(Number(raw?.seed)) ? Number(raw.seed) : newSeed(),
    transition: TRANSITIONS.includes(raw?.transition) ? raw.transition : 'cut',
    transition_s: Math.max(0.1, Math.min(5,
      Number(raw?.transition_s) || 1)),
    images: toUrlList(raw?.images),
    videos: toUrlList(raw?.videos),
    audio: toUrlList(raw?.audio),
  }
}

export interface DirectorSettings {
  chain: ChainMode
}

function normalizeSettings(raw: any): DirectorSettings {
  const chain: ChainMode = CHAIN_MODES.includes(raw?.chain) ? raw.chain
    : raw?.chain_last_frame === true ? 'prepend' : 'off'
  return { chain }
}

export function parseTimeline(raw: string): { clips: DirectorClip[]; settings: DirectorSettings } {
  try {
    const p = JSON.parse(raw)
    const clips = Array.isArray(p?.clips)
      ? p.clips.filter((c: any) => c && typeof c === 'object').map(normalizeClip)
      : []
    return { clips, settings: normalizeSettings(p?.settings) }
  } catch {
    return { clips: [], settings: normalizeSettings(null) }
  }
}

export function serializeTimeline(clips: DirectorClip[], settings: DirectorSettings): string {
  return JSON.stringify({ version: 1, settings, clips })
}

export function clipStatuses(directorClips: string | null | undefined): Map<string, DirectorClipStatus> {
  const out = new Map<string, DirectorClipStatus>()
  if (!directorClips) return out
  try {
    const rows = JSON.parse(directorClips)
    if (!Array.isArray(rows)) return out
    for (const r of rows) {
      if (r && typeof r.id === 'string' && r.id) {
        out.set(r.id, { url: String(r.url ?? ''), cached: r.cached === true })
      }
    }
  } catch {}
  return out
}

export function useDirectorTimeline(
  node: LGraphNode,
  state: StageState,
  rootEl: Ref<HTMLElement | null>,
) {
  const clips = ref<DirectorClip[]>([])
  const settings = ref<DirectorSettings>({ chain: 'off' })
  const selectedId = ref<string | null>(null)
  const drag = ref<{
    id: string
    previewX: number
    baseX: number
    startX: number
    scale: number
    active: boolean
  } | null>(null)

  const selectedClip = computed(() =>
    clips.value.find(c => c.id === selectedId.value) ?? null,
  )
  const totalSeconds = computed(() =>
    clips.value.filter(c => c.enabled).reduce((sum, c) => sum + c.duration_s, 0),
  )
  const statuses = computed(() => clipStatuses(state.directorClips))

  const workflowOptions = computed<string[]>(() => {
    const w: any = node?.widgets?.find((x: any) => x.name === 'workflow')
    const values = w?.options?.values
    return Array.isArray(values) ? values.map(String) : []
  })

  function clipWidthPx(c: DirectorClip): number {
    return clipWidthPxOf(c)
  }

  function startPxOf(idx: number): number {
    let x = 0
    for (let i = 0; i < idx; i++) x += clipWidthPx(clips.value[i]) + CLIP_GAP_PX
    return x
  }

  function clipStyle(idx: number) {
    const c = clips.value[idx]
    const base = startPxOf(idx)
    const x = drag.value?.id === c.id && drag.value.active
      ? drag.value.previewX
      : base
    return { left: `${x}px`, width: `${clipWidthPx(c)}px` }
  }

  const trackWidthPx = computed(() =>
    clips.value.reduce((sum, c) => sum + clipWidthPx(c) + CLIP_GAP_PX, 0) + 40,
  )

  function commit() {
    writeWidget(node, 'timeline_data', serializeTimeline(clips.value, settings.value))
  }

  function restore() {
    const parsed = parseTimeline(readWidgetStr(node, 'timeline_data', ''))
    clips.value = parsed.clips
    settings.value = parsed.settings
    if (selectedId.value && !clips.value.some(c => c.id === selectedId.value)) {
      selectedId.value = null
    }
  }

  function addClip() {
    const clip = normalizeClip({})
    clips.value.push(clip)
    selectedId.value = clip.id
    commit()
  }

  function removeClip(id: string) {
    clips.value = clips.value.filter(c => c.id !== id)
    if (selectedId.value === id) selectedId.value = null
    commit()
  }

  function duplicateClip(id: string) {
    const idx = clips.value.findIndex(c => c.id === id)
    if (idx < 0) return
    const copy: DirectorClip = {
      ...clips.value[idx],
      id: newId(),
      seed: newSeed(),
      images: [...clips.value[idx].images],
      videos: [...clips.value[idx].videos],
      audio: [...clips.value[idx].audio],
    }
    clips.value.splice(idx + 1, 0, copy)
    selectedId.value = copy.id
    commit()
  }

  function updateClip(id: string, patch: Partial<DirectorClip>) {
    const c = clips.value.find(x => x.id === id)
    if (!c) return
    Object.assign(c, patch)
    if (patch.duration_s != null) {
      c.duration_s = Math.max(DURATION_MIN_S, Math.min(DURATION_MAX_S,
        Math.round(patch.duration_s)))
    }
    commit()
  }

  function rerollSeed(id: string) {
    updateClip(id, { seed: newSeed() })
  }

  function rerollAllSeeds() {
    for (const c of clips.value) c.seed = newSeed()
    commit()
  }

  function setChainMode(v: ChainMode) {
    settings.value.chain = v
    commit()
  }

  function addRef(id: string, kind: 'images' | 'videos' | 'audio', url: string) {
    const c = clips.value.find(x => x.id === id)
    if (!c || !url || c[kind].includes(url)) return
    c[kind] = [...c[kind], url]
    commit()
  }

  function removeRef(id: string, kind: 'images' | 'videos' | 'audio', url: string) {
    const c = clips.value.find(x => x.id === id)
    if (!c) return
    c[kind] = c[kind].filter(u => u !== url)
    commit()
  }

  function moveRefTo(id: string, kind: 'images' | 'videos' | 'audio',
                     from: number, to: number) {
    const c = clips.value.find(x => x.id === id)
    if (!c) return
    if (from < 0 || from >= c[kind].length || to < 0 || to >= c[kind].length) return
    if (from === to) return
    const next = [...c[kind]]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    c[kind] = next
    commit()
  }

  function beginPointerDrag(
    e: PointerEvent,
    onMove: (ev: PointerEvent) => void,
    onEnd: () => void,
  ) {
    const el = rootEl.value
    if (!el) return
    el.setPointerCapture?.(e.pointerId)
    const move = (ev: PointerEvent) => onMove(ev)
    const finish = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
      try { el.releasePointerCapture?.(e.pointerId) } catch {}
      onEnd()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)
  }

  const DRAG_THRESHOLD_PX = 5

  function overlayScale(): number {
    const el = rootEl.value
    if (!el) return 1
    const w = el.getBoundingClientRect().width
    return el.offsetWidth > 0 && w > 0 ? w / el.offsetWidth : 1
  }

  function onClipPointerDown(e: PointerEvent, clip: DirectorClip, idx: number) {
    selectedId.value = clip.id
    const base = startPxOf(idx)
    drag.value = {
      id: clip.id,
      previewX: base,
      baseX: base,
      startX: e.clientX,
      scale: overlayScale(),
      active: false,
    }
    beginPointerDrag(e, onClipPointerMove, () => {
      const moved = drag.value?.active
      drag.value = null
      if (moved) commit()
    })
  }

  function onClipPointerMove(e: PointerEvent) {
    const d = drag.value
    if (!d) return
    if (!d.active) {
      if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD_PX * d.scale) return
      d.active = true
    }
    const px = d.baseX + (e.clientX - d.startX) / d.scale
    d.previewX = px
    const draggedIdx = clips.value.findIndex(c => c.id === d.id)
    if (draggedIdx < 0) return
    const dragged = clips.value[draggedIdx]
    const centerX = px + clipWidthPx(dragged) / 2

    const others = clips.value.filter(c => c.id !== d.id)
    let acc = 0
    let targetIdx = others.length
    for (let j = 0; j < others.length; j++) {
      const mid = acc + clipWidthPx(others[j]) / 2
      if (centerX < mid) { targetIdx = j; break }
      acc += clipWidthPx(others[j]) + CLIP_GAP_PX
    }
    if (targetIdx !== draggedIdx) {
      clips.value.splice(draggedIdx, 1)
      clips.value.splice(targetIdx, 0, dragged)
    }
  }

  let resizeState: {
    id: string
    startX: number
    startDur: number
    scale: number
  } | null = null
  function onResizePointerDown(e: PointerEvent, clip: DirectorClip) {
    selectedId.value = clip.id
    resizeState = {
      id: clip.id,
      startX: e.clientX,
      startDur: clip.duration_s,
      scale: overlayScale(),
    }
    beginPointerDrag(e, onResizeMove, () => { resizeState = null; commit() })
  }
  function onResizeMove(e: PointerEvent) {
    if (!resizeState) return
    const c = clips.value.find(x => x.id === resizeState!.id)
    if (!c) return
    const ds = Math.round((e.clientX - resizeState.startX) / (PPS * resizeState.scale))
    c.duration_s = Math.max(DURATION_MIN_S, Math.min(DURATION_MAX_S,
      resizeState.startDur + ds))
  }

  function mcpFindClip(id: unknown): DirectorClip {
    const c = clips.value.find(x => x.id === String(id ?? ''))
    if (!c) {
      const ids = clips.value.map(x => x.id).join(', ') || 'none'
      throw new Error(`clip ${String(id)} not found (ids: ${ids})`)
    }
    return c
  }

  function mcpClipPatch(op: any): Partial<DirectorClip> {
    const patch: Partial<DirectorClip> = {}
    if (op.enabled != null) patch.enabled = op.enabled !== false
    if (op.workflow != null) patch.workflow = String(op.workflow)
    if (op.prompt != null) patch.prompt = String(op.prompt)
    if (op.duration_s != null) {
      const d = Number(op.duration_s)
      if (!Number.isFinite(d)) throw new Error('duration_s must be a number')
      patch.duration_s = d
    }
    if (op.seed != null) {
      const s = Number(op.seed)
      if (!Number.isFinite(s)) throw new Error('seed must be a number')
      patch.seed = s
    }
    if (op.transition != null) {
      if (!TRANSITIONS.includes(String(op.transition))) {
        throw new Error(
          `unknown transition '${op.transition}' — valid: ${TRANSITIONS.join(', ')}`)
      }
      patch.transition = String(op.transition)
    }
    if (op.transition_s != null) {
      const t = Number(op.transition_s)
      if (!Number.isFinite(t)) throw new Error('transition_s must be a number')
      patch.transition_s = Math.max(0.1, Math.min(5, t))
    }
    for (const kind of ['images', 'videos', 'audio'] as const) {
      if (op[kind] != null) {
        if (!Array.isArray(op[kind])) {
          throw new Error(`${kind} must be an array of /view?… media URLs`)
        }
        patch[kind] = toUrlList(op[kind])
      }
    }
    return patch
  }

  function mcpApplyOps(ops: any[]): Array<Record<string, unknown>> {
    if (state.running) {
      throw new Error('director is running — wait_stage or cancel_stage first')
    }
    if (!Array.isArray(ops) || ops.length === 0) {
      throw new Error('ops must be a non-empty array of {op, ...} objects')
    }
    const results: Array<Record<string, unknown>> = []
    ops.forEach((op, i) => {
      const where = `ops[${i}]`
      try {
        switch (op?.op) {
          case 'add_clip': {
            const clip = normalizeClip({ ...mcpClipPatch(op), seed: op.seed })
            const idx = op.index != null
              ? Math.max(0, Math.min(clips.value.length, Number(op.index)))
              : clips.value.length
            clips.value.splice(idx, 0, clip)
            selectedId.value = clip.id
            commit()
            results.push({ op: 'add_clip', id: clip.id, index: idx })
            break
          }
          case 'update_clip': {
            const c = mcpFindClip(op.id)
            updateClip(c.id, mcpClipPatch(op))
            results.push({ op: 'update_clip', id: c.id })
            break
          }
          case 'remove_clip': {
            const c = mcpFindClip(op.id)
            removeClip(c.id)
            results.push({ op: 'remove_clip', id: c.id })
            break
          }
          case 'duplicate_clip': {
            const c = mcpFindClip(op.id)
            duplicateClip(c.id)
            results.push({ op: 'duplicate_clip', id: selectedId.value })
            break
          }
          case 'move_clip': {
            const c = mcpFindClip(op.id)
            if (op.index == null) throw new Error('move_clip needs index')
            const from = clips.value.findIndex(x => x.id === c.id)
            const to = Math.max(0, Math.min(clips.value.length - 1, Number(op.index)))
            clips.value.splice(from, 1)
            clips.value.splice(to, 0, c)
            commit()
            results.push({ op: 'move_clip', id: c.id, index: to })
            break
          }
          case 'reroll': {
            if (op.id != null) {
              const c = mcpFindClip(op.id)
              rerollSeed(c.id)
              results.push({ op: 'reroll', id: c.id })
            } else {
              rerollAllSeeds()
              results.push({ op: 'reroll', all: true })
            }
            break
          }
          case 'set_chain': {
            if (!CHAIN_MODES.includes(op.chain)) {
              throw new Error(
                `unknown chain '${op.chain}' — valid: ${CHAIN_MODES.join(', ')}`)
            }
            setChainMode(op.chain)
            results.push({ op: 'set_chain', chain: op.chain })
            break
          }
          default:
            throw new Error(
              `unknown op '${op?.op}'; valid ops: add_clip, update_clip, `
              + 'remove_clip, duplicate_clip, move_clip, reroll, set_chain')
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(
          `${where}: ${detail} (ops before this one were already applied)`)
      }
    })
    return results
  }

  restore()
  if (node) {
    const origOnConfigure = node.onConfigure
    node.onConfigure = function (info: any) {
      origOnConfigure?.call(this, info)
      restore()
    }
    const hostApi = ((node as any).__comfytvStageApi ??= {})
    hostApi.director = {
      getState: () => JSON.parse(JSON.stringify({
        settings: settings.value,
        total_seconds: totalSeconds.value,
        default_workflow: readWidgetStr(node, 'workflow', ''),
        running: state.running === true,
        clips: clips.value.map((c, i) => ({
          ...c,
          index: i,
          status: statuses.value.get(c.id) ?? null,
        })),
        workflow_options: workflowOptions.value,
        transitions: TRANSITIONS,
        chain_modes: CHAIN_MODES,
      })),
      applyOps: async (ops: any[]) => ({ results: mcpApplyOps(ops) }),
    }
  }

  const selectedIndex = computed(() =>
    clips.value.findIndex(c => c.id === selectedId.value),
  )

  return {
    clips, settings, selectedId, drag,
    selectedClip, selectedIndex, totalSeconds, statuses, workflowOptions,
    trackWidthPx,
    clipStyle, clipWidthPx,
    addClip, removeClip, duplicateClip, updateClip, rerollSeed,
    rerollAllSeeds,
    setChainMode,
    addRef, removeRef, moveRefTo,
    onClipPointerDown, onResizePointerDown,
  }
}
