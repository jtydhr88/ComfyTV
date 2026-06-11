<template>
  <div class="grid-split-stage">
    <div class="preview-shell">
      <div v-if="!sourceImageUrl" class="empty-state">
        <div class="empty-icon">▦</div>
        <div class="empty-text">{{ $t('gridSplit.connectImage') }}</div>
      </div>
      <template v-else>
        <img
          :src="sourceImageUrl"
          class="preview-img"
          draggable="false"
          @dragstart.prevent
        />
        <div class="grid-overlay">
          <div
            v-for="c in cols - 1"
            :key="`v${c}`"
            class="line v"
            :style="{ left: `${(c / cols) * 100}%` }"
          />
          <div
            v-for="r in rows - 1"
            :key="`h${r}`"
            class="line h"
            :style="{ top: `${(r / rows) * 100}%` }"
          />
        </div>
      </template>
    </div>

    <div class="status">
      <span v-if="!sourceImageUrl" class="muted">{{ $t('gridSplit.connectImage') }}</span>
      <span v-else-if="splitting" class="muted">{{ $t('gridSplit.splitting', { n: rows * cols }) }}</span>
      <span v-else-if="state.output" class="ok">{{ $t('gridSplit.done', { n: rows * cols }) }}</span>
      <span v-else class="muted">{{ $t('gridSplit.pickGrid') }}</span>
    </div>

    <div class="presets">
      <button
        v-for="p in PRESETS"
        :key="p.label"
        type="button"
        class="preset"
        :class="{ active: rows === p.r && cols === p.c }"
        @click="setGrid(p.r, p.c)"
      >{{ p.label }}</button>
    </div>
    <div class="steppers">
      <div class="stepper">
        <span class="label">{{ $t('gridSplit.rows') }}</span>
        <button type="button" @click="setGrid(rows - 1, cols)">−</button>
        <span class="num">{{ rows }}</span>
        <button type="button" @click="setGrid(rows + 1, cols)">+</button>
      </div>
      <div class="stepper">
        <span class="label">{{ $t('gridSplit.cols') }}</span>
        <button type="button" @click="setGrid(rows, cols - 1)">−</button>
        <span class="num">{{ cols }}</span>
        <button type="button" @click="setGrid(rows, cols + 1)">+</button>
      </div>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStageStore, type StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { app } from '@/lib/comfyApp'

const PRESETS = [
  { label: '1×2', r: 1, c: 2 },
  { label: '2×1', r: 2, c: 1 },
  { label: '2×2', r: 2, c: 2 },
  { label: '2×3', r: 2, c: 3 },
  { label: '3×3', r: 3, c: 3 },
] as const

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

const store = useStageStore()

const sourceImageUrl = computed<string | null>(() => {
  const inp = props.state.inputs.find(i => i.slot === 'image')
  if (!inp || inp.source !== 'upstream' || !inp.content) return null
  return inp.content
})

function getWidget(name: string): any | null {
  return props.node?.widgets?.find((w: any) => w.name === name) ?? null
}
function readInt(name: string, fallback: number): number {
  const w = getWidget(name)
  const n = w ? Number(w.value) : NaN
  return Number.isFinite(n) ? n : fallback
}
function writeWidget(name: string, value: number) {
  const w = getWidget(name)
  if (!w) return
  if (w.value !== value) { w.value = value; w.callback?.(value) }
}

const rows = ref<number>(readInt('rows', 2))
const cols = ref<number>(readInt('cols', 2))

function setGrid(r: number, c: number) {
  rows.value = Math.max(1, Math.min(10, r))
  cols.value = Math.max(1, Math.min(10, c))
}

function wireWidget(name: string, apply: (v: number) => void) {
  const w = getWidget(name)
  if (!w) return
  const orig = w.callback
  w.callback = (v: unknown) => { orig?.call(w, v); apply(Number(v)) }
}
wireWidget('rows', v => { if (v !== rows.value) rows.value = v })
wireWidget('cols', v => { if (v !== cols.value) cols.value = v })

if (props.node) {
  const orig = props.node.onConfigure
  props.node.onConfigure = function (info: any) {
    orig?.call(this, info)
    const r = readInt('rows', rows.value)
    const c = readInt('cols', cols.value)
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
  if (cachedImg && cachedUrl === url && cachedImg.complete) return Promise.resolve(cachedImg)
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
  timer = window.setTimeout(() => { timer = null; void run() }, 250)
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

        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
        if (!blob) throw new Error('toBlob null')
        if (mySeq !== seq) return

        const nodeId = String(props.node?.id ?? 'unknown')
        const filename = `comfytv-grid-${nodeId}-${Date.now()}-${n}.png`
        const body = new FormData()
        body.append('image', blob, filename)
        body.append('subfolder', 'gridsplit')
        body.append('type', 'input')
        const resp = await (app as any).api.fetchApi('/upload/image', { method: 'POST', body })
        if (resp.status !== 200) throw new Error(`upload ${resp.status}`)
        const data = await resp.json() as { name?: string }
        if (!data?.name) throw new Error('no name')
        if (mySeq !== seq) return

        items.push({
          index: String(n),
          label: `R${row + 1}C${col + 1}`,
          image_url: `/view?filename=${encodeURIComponent(data.name)}&subfolder=gridsplit&type=input`,
        })
      }
    }
    if (mySeq !== seq) return
    store.applyExecutedPayload(props.state, { output: [JSON.stringify({ images: items })] })
  } catch (e) {
    console.error('[ComfyTV/gridsplit] split failed', e)
  } finally {
    if (mySeq === seq) splitting.value = false
  }
}

watch([rows, cols], ([r, c]) => {
  writeWidget('rows', r)
  writeWidget('cols', c)
  schedule()
})
watch(sourceImageUrl, () => schedule(), { immediate: true })
</script>

<style scoped>
.grid-split-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}
.preview-shell {
  position: relative;
  width: 100%;
  height: 280px;
  background: #0a0a0f;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}
.grid-overlay { position: absolute; inset: 0; pointer-events: none; }
.line { position: absolute; background: rgba(255, 255, 255, 0.7); box-shadow: 0 0 2px rgba(0,0,0,0.6); }
.line.v { top: 0; bottom: 0; width: 1px; }
.line.h { left: 0; right: 0; height: 1px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: rgba(255, 255, 255, 0.5); gap: 6px;
}
.empty-icon { font-size: 32px; opacity: 0.6; }
.empty-text { font-size: 12px; }

.status { font-size: 10px; text-align: center; padding: 2px 0; }
.status .muted { color: rgba(255, 255, 255, 0.5); }
.status .ok    { color: #b5e3a5; }

.presets { display: flex; gap: 4px; flex-wrap: wrap; }
.preset {
  flex: 1 1 0; min-width: 44px;
  padding: 4px 6px; font-size: 11px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px; color: rgba(255, 255, 255, 0.85); cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.preset:hover { background: rgba(255, 255, 255, 0.1); }
.preset.active {
  background: rgba(233, 61, 130, 0.25);
  border-color: rgba(233, 61, 130, 0.6);
  color: #ffb0d8; font-weight: 600;
}

.steppers { display: flex; gap: 8px; }
.stepper {
  flex: 1; display: flex; align-items: center; gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px; padding: 2px 6px;
}
.stepper .label {
  font-size: 10px; color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase; letter-spacing: 0.4px;
}
.stepper button {
  width: 20px; height: 20px; border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04); color: rgba(255, 255, 255, 0.85);
  cursor: pointer; font-size: 13px; line-height: 1;
}
.stepper button:hover { background: rgba(255, 255, 255, 0.12); }
.stepper .num {
  margin-left: auto; min-width: 16px; text-align: center;
  font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}
</style>
