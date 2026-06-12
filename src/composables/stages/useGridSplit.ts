import { computed, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { uploadCanvas } from '@/utils/uploadCanvas'
import { getWidget, readWidgetNum, writeWidget } from '@/utils/widget'

const SCHEDULE_DELAY_MS = 250
const MIN_GRID = 1
const MAX_GRID = 10

export function useGridSplit(node: LGraphNode, state: StageState) {
  const store = useStageStore()

  const sourceImageUrl = computed<string | null>(() => {
    const inp = state.inputs.find(i => i.slot === 'image')
    return inp && inp.source === 'upstream' && inp.content ? inp.content : null
  })

  const rows = ref<number>(readWidgetNum(node, 'rows', 2))
  const cols = ref<number>(readWidgetNum(node, 'cols', 2))

  function setGrid(r: number, c: number) {
    rows.value = Math.max(MIN_GRID, Math.min(MAX_GRID, r))
    cols.value = Math.max(MIN_GRID, Math.min(MAX_GRID, c))
  }

  function wireWidget(name: string, apply: (v: number) => void) {
    const w = getWidget(node, name)
    if (!w) return
    const orig = w.callback
    w.callback = (v: unknown) => { orig?.call(w, v); apply(Number(v)) }
  }
  wireWidget('rows', (v) => { if (v !== rows.value) rows.value = v })
  wireWidget('cols', (v) => { if (v !== cols.value) cols.value = v })

  if (node) {
    const orig = node.onConfigure
    node.onConfigure = function (info: any) {
      orig?.call(this, info)
      const r = readWidgetNum(node, 'rows', rows.value)
      const c = readWidgetNum(node, 'cols', cols.value)
      if (r !== rows.value) rows.value = r
      if (c !== cols.value) cols.value = c
    }
  }

  const splitting = ref(false)
  let timer: number | null = null
  let seq = 0
  let cachedImg: HTMLImageElement | null = null
  let cachedUrl: string | null = null

  function getSourceImage(url: string): Promise<HTMLImageElement> {
    if (cachedImg && cachedUrl === url && cachedImg.complete) {
      return Promise.resolve(cachedImg)
    }
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { cachedImg = img; cachedUrl = url; resolve(img) }
      img.onerror = reject
      img.src = url
    })
  }

  function schedule() {
    if (!sourceImageUrl.value) return
    if (timer != null) window.clearTimeout(timer)
    timer = window.setTimeout(() => { timer = null; void run() }, SCHEDULE_DELAY_MS)
  }

  async function run() {
    const url = sourceImageUrl.value
    const r = rows.value, c = cols.value
    if (!url || r < 1 || c < 1) return

    const mySeq = ++seq
    splitting.value = true
    try {
      const img = await getSourceImage(url)
      if (mySeq !== seq) return
      const cellW = Math.floor(img.naturalWidth / c)
      const cellH = Math.floor(img.naturalHeight / r)
      if (cellW < 1 || cellH < 1) return

      const items: { index: string; label: string; image_url: string }[] = []
      let n = 0
      const nodeId = String(node?.id ?? 'unknown')
      for (let row = 0; row < r; row++) {
        for (let col = 0; col < c; col++) {
          if (mySeq !== seq) return
          n++
          const canvas = document.createElement('canvas')
          canvas.width = cellW
          canvas.height = cellH
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('2d context unavailable')
          ctx.drawImage(img, col * cellW, row * cellH, cellW, cellH, 0, 0, cellW, cellH)

          const imageUrl = await uploadCanvas(canvas, {
            subfolder: 'gridsplit',
            filename: `comfytv-grid-${nodeId}-${Date.now()}-${n}.png`,
          })
          if (mySeq !== seq) return

          items.push({
            index: String(n),
            label: `R${row + 1}C${col + 1}`,
            image_url: imageUrl,
          })
        }
      }
      if (mySeq !== seq) return
      store.applyExecutedPayload(state, { output: [JSON.stringify({ images: items })] })
    } catch (e) {
      console.error('[ComfyTV/gridsplit] split failed', e)
    } finally {
      if (mySeq === seq) splitting.value = false
    }
  }

  watch([rows, cols], ([r, c]) => {
    writeWidget(node, 'rows', r)
    writeWidget(node, 'cols', c)
    schedule()
  })
  watch(sourceImageUrl, () => schedule(), { immediate: true })

  return {
    sourceImageUrl,
    rows, cols, setGrid,
    splitting,
  }
}
