import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export interface ScoreEngraveOptions {
  xml: Ref<string>
  container: Ref<HTMLElement | null>
  debounceMs?: number
}

interface OsmdIterator {
  EndReached: boolean
  CurrentEnrolledTimestamp?: { RealValue: number }
  currentTimeStamp?: { RealValue: number }
  clone?: () => OsmdIterator
  moveToNext?: () => void
}

interface OsmdCursor {
  show(): void
  hide(): void
  reset(): void
  next(): void
  update(): void
  cursorElement?: HTMLElement
  iterator: OsmdIterator
}

interface OsmdLike {
  load(xml: string): Promise<unknown>
  render(): void
  clear(): void
  zoom: number
  cursor?: OsmdCursor
}

type OsmdCtor = new (el: HTMLElement, opts: Record<string, unknown>) => OsmdLike

let osmdCtorPromise: Promise<OsmdCtor> | null = null

function loadOsmd(): Promise<OsmdCtor> {
  if (!osmdCtorPromise) {
    osmdCtorPromise = import('opensheetmusicdisplay').then(
      (m) => m.OpenSheetMusicDisplay as unknown as OsmdCtor,
    )
  }
  return osmdCtorPromise
}

export function useScoreEngrave(opts: ScoreEngraveOptions) {
  const error = ref('')
  const rendering = ref(false)
  const empty = ref(true)
  const zoom = ref(0.6)

  let osmd: OsmdLike | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let token = 0
  let lastXml = ''

  async function renderNow(): Promise<void> {
    const el = opts.container.value
    const xml = opts.xml.value.trim()
    const my = ++token
    if (!el) return
    if (!xml || !xml.includes('<score-partwise')) {
      empty.value = true
      error.value = ''
      if (osmd) osmd.clear()
      return
    }
    rendering.value = true
    try {
      const Ctor = await loadOsmd()
      if (my !== token || !opts.container.value) return
      if (!osmd) {
        osmd = new Ctor(el, {
          autoResize: false,
          backend: 'svg',
          drawTitle: true,
          drawPartNames: true,
          drawingParameters: 'compacttight',
        })
      }
      if (xml !== lastXml) {
        await osmd.load(xml)
        lastXml = xml
      }
      if (my !== token) return
      osmd.zoom = zoom.value
      osmd.render()
      cursorBeat = -1
      shadow = null
      empty.value = false
      error.value = ''
    } catch (e) {
      if (my !== token) return
      error.value = e instanceof Error ? e.message : String(e)
      empty.value = true
    } finally {
      if (my === token) rendering.value = false
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void renderNow(), opts.debounceMs ?? 450)
  }

  let resizeObserver: ResizeObserver | null = null
  let lastWidth = 0

  function observeResize(el: HTMLElement | null): void {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (!el || typeof ResizeObserver === 'undefined') return
    lastWidth = el.clientWidth
    resizeObserver = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0 && Math.abs(w - lastWidth) > 24 && !rendering.value) {
        lastWidth = w
        schedule()
      }
    })
    resizeObserver.observe(el)
  }

  watch(opts.xml, schedule)
  watch(opts.container, (el) => {
    observeResize(el)
    void renderNow()
  })
  watch(zoom, () => void renderNow())

  function zoomBy(delta: number): void {
    zoom.value = Math.min(1.6, Math.max(0.25,
      Math.round((zoom.value + delta) * 100) / 100))
  }

  let cursorBeat = -1
  let lastScrollTop = -1

  function iterTs(it: OsmdIterator): number {
    const ts = it.CurrentEnrolledTimestamp ?? it.currentTimeStamp
    return (ts?.RealValue ?? 0) * 4
  }

  function cursorTs(cur: OsmdCursor): number {
    return iterTs(cur.iterator)
  }

  let shadow: OsmdIterator | null = null

  function rebuildShadow(cur: OsmdCursor): void {
    shadow = null
    const it = cur.iterator
    if (typeof it.clone !== 'function') return
    try {
      const copy = it.clone()
      if (typeof copy.moveToNext !== 'function') return
      copy.moveToNext()
      shadow = copy
    } catch {
      shadow = null
    }
  }

  function shadowNextTs(): number | null {
    return shadow ? iterTs(shadow) : null
  }

  function scrollCursorIntoView(cur: OsmdCursor): void {
    const el = cur.cursorElement
    const scroller = opts.container.value?.parentElement
    if (!el || !scroller) return
    const top = el.offsetTop
    if (Math.abs(top - lastScrollTop) < 4) return
    lastScrollTop = top
    const viewTop = scroller.scrollTop
    const viewBottom = viewTop + scroller.clientHeight
    const elBottom = top + el.offsetHeight
    if (top < viewTop + 8 || elBottom > viewBottom - 8) {
      scroller.scrollTop = Math.max(0, top - scroller.clientHeight * 0.25)
    }
  }

  let stallCount = 0
  let lastStallTs = -1

  function seekCursorToBeat(beat: number): void {
    const cur = osmd?.cursor
    if (!cur || empty.value) return
    try {
      if (beat < cursorBeat - 1e-6) {
        cur.reset()
        rebuildShadow(cur)
      }
      cur.show()
      if (!shadow) {
        cur.reset()
        rebuildShadow(cur)
      }
      let guard = 0
      while (!cur.iterator.EndReached && guard < 4096) {
        const next = shadowNextTs()
        if (next === null) {
          if (cursorTs(cur) < beat - 1e-6) {
            cur.next()
            guard++
            continue
          }
          break
        }
        if (next <= beat + 1e-6) {
          cur.next()
          shadow?.moveToNext?.()
          guard++
        } else {
          break
        }
      }
      cur.update()
      cursorBeat = beat
      scrollCursorIntoView(cur)

      const ts = cursorTs(cur)
      if (guard === 0 && Math.abs(beat - ts) > 1.5) {
        if (ts === lastStallTs) {
          stallCount++
        } else {
          stallCount = 0
          lastStallTs = ts
        }
        if (stallCount === 90 || stallCount === 600) {
          const next = shadowNextTs()
          console.warn(
            '[ComfyTV/score-cursor] desync: playheadBeat='
            + beat.toFixed(3)
            + ' cursorEnrolledBeat=' + ts.toFixed(3)
            + ' nextEnrolledBeat='
            + (next === null ? 'n/a' : next.toFixed(3))
            + ' endReached=' + String(cur.iterator.EndReached))
        }
      } else {
        stallCount = 0
        lastStallTs = -1
      }
    } catch {}
  }

  function hideCursor(): void {
    try {
      osmd?.cursor?.hide()
    } catch {}
    cursorBeat = -1
  }

  onBeforeUnmount(() => {
    token++
    if (timer) clearTimeout(timer)
    resizeObserver?.disconnect()
    resizeObserver = null
    try {
      osmd?.clear()
    } catch {}
    osmd = null
  })

  return { error, rendering, empty, zoom, zoomBy, renderNow,
           seekCursorToBeat, hideCursor }
}
