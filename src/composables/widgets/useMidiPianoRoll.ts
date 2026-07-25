import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { midiEvents } from '@/api'
import {
  buildRollNotes, drawRoll, followOffset, maxEnd, KEY_WIDTH, PX_PER_SEC,
  type RollNote,
} from '@/utils/midiRoll'

export interface UseMidiPianoRollOptions {
  url: Ref<string | null>
  enabled: Ref<boolean>
  canvas: Ref<HTMLCanvasElement | null>
  currentTime: () => number
}

export function useMidiPianoRoll(opts: UseMidiPianoRollOptions) {
  const ready = ref(false)
  let notes: RollNote[] = []
  let contentEnd = 0
  let lastOffset = 0
  let token = 0
  let raf = 0

  function render(): void {
    const el = opts.canvas.value
    if (!el || !ready.value) return
    const box = el.parentElement
    const width = Math.max(1, Math.floor(box?.clientWidth ?? el.clientWidth))
    const height = Math.max(1, Math.floor(box?.clientHeight ?? el.clientHeight))
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    if (el.width !== width * dpr || el.height !== height * dpr) {
      el.width = width * dpr
      el.height = height * dpr
    }
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const playhead = opts.currentTime()
    const viewSec = Math.max(0.5, (width - KEY_WIDTH) / PX_PER_SEC)
    lastOffset = followOffset(lastOffset, playhead, contentEnd, viewSec)
    drawRoll(ctx, width, height, notes, lastOffset, playhead)
  }

  function loop(): void {
    render()
    raf = requestAnimationFrame(loop)
  }

  function stop(): void {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  async function reload(): Promise<void> {
    const my = ++token
    ready.value = false
    stop()
    notes = []
    lastOffset = 0
    const url = opts.url.value
    if (!opts.enabled.value || !url) return
    try {
      const res = await midiEvents(url)
      if (my !== token) return
      if (res.status !== 'ready' || !res.events) return
      notes = buildRollNotes(res.events, res.programs ?? {})
      contentEnd = Math.max(res.duration ?? 0, maxEnd(notes))
      ready.value = true
      loop()
    } catch {
      if (my === token) ready.value = false
    }
  }

  watch([opts.url, opts.enabled], () => void reload(), { immediate: true })

  onBeforeUnmount(() => {
    token++
    stop()
  })

  return { ready, render }
}
