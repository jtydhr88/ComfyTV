<template>
  <div class="pano-multi-stage">
    <div class="info">
      <span v-if="!panoramaUrl" class="muted">{{ $t('panoramaView.connectPanorama') }}</span>
      <span v-else-if="capturing" class="muted">{{ $t('panoramaView.capturingCount', { i: captureProgress, n: viewCount }) }}</span>
      <span v-else-if="state.output" class="ok">{{ $t('panoramaView.capturedN', { n: viewCount }) }}</span>
      <span v-else class="muted">{{ $t('panoramaView.adjustCountToCapture') }}</span>
    </div>

    <div class="ratio-row">
      <div class="ctl">
        <span class="label">{{ $t('panoramaView.aspect') }}</span>
        <select v-model="aspectRatio" class="select">
          <option v-for="opt in aspectOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
      <div class="ctl">
        <span class="label">{{ $t('panoramaView.resolution') }}</span>
        <select v-model="resolution" class="select">
          <option v-for="opt in resolutionOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
      <span class="dims">{{ captureW }}×{{ captureH }}</span>
    </div>

    <div class="controls">
      <span class="label">{{ $t('panoramaView.viewCount') }}</span>
      <input
        type="range"
        min="2" max="24" step="1"
        :value="viewCount"
        :disabled="!panoramaUrl"
        @input="(e) => viewCount = Number((e.target as HTMLInputElement).value)"
      />
      <span class="value">{{ viewCount }}</span>
    </div>

    <StageCard
      :state="state"
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
import { capturePanoramaOffscreen } from '@/widgets/three/PanoramaViewer'
import { app } from '@/lib/comfyApp'

const aspectOptions = [
  '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9',
] as const
const resolutionOptions = ['1K', '2K', '4K'] as const
const RESOLUTION_TO_SHORT_SIDE: Record<string, number> = {
  '1K': 1024,
  '2K': 2048,
  '4K': 4096,
}
const CAPTURE_FOV = 75
const LABELS_4 = ['Front', 'Right', 'Back', 'Left']

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

const store = useStageStore()

const panoramaUrl = computed<string | null>(() => {
  const inp = props.state.inputs.find(i => i.slot === 'panorama')
  if (!inp || inp.source !== 'upstream' || !inp.content) return null
  return inp.content
})

function getWidget(name: string): any | null {
  return props.node?.widgets?.find((w: any) => w.name === name) ?? null
}

function readWidgetStr(name: string, fallback: string): string {
  const w = getWidget(name)
  if (!w) return fallback
  const v = String(w.value ?? '')
  return v || fallback
}

const viewCount   = ref<number>(Number(getWidget('view_count')?.value ?? 4) || 4)
const aspectRatio = ref<string>(readWidgetStr('aspect_ratio', '16:9'))
const resolution  = ref<string>(readWidgetStr('resolution',   '1K'))

function writeWidget(name: string, value: number | string) {
  const w = getWidget(name)
  if (!w) return
  if (w.value !== value) {
    w.value = value
    w.callback?.(value)
  }
}

function parseAspect(s: string): { w: number; h: number } {
  const [a, b] = s.split(':')
  const wa = Number(a), wb = Number(b)
  if (!Number.isFinite(wa) || !Number.isFinite(wb) || wb === 0) {
    return { w: 16, h: 9 }
  }
  return { w: wa, h: wb }
}

const aspectParts = computed(() => parseAspect(aspectRatio.value))
const captureW = computed(() => {
  const { w, h } = aspectParts.value
  const short = RESOLUTION_TO_SHORT_SIDE[resolution.value] ?? 1024
  return w >= h
    ? Math.max(16, Math.round((short * w / h) / 8) * 8)
    : Math.max(16, Math.round(short / 8) * 8)
})
const captureH = computed(() => {
  const { w, h } = aspectParts.value
  const short = RESOLUTION_TO_SHORT_SIDE[resolution.value] ?? 1024
  return w >= h
    ? Math.max(16, Math.round(short / 8) * 8)
    : Math.max(16, Math.round((short * h / w) / 8) * 8)
})

const vcw = getWidget('view_count')
if (vcw) {
  const orig = vcw.callback
  vcw.callback = (v: unknown) => {
    orig?.call(vcw, v)
    const n = Number(v)
    if (Number.isFinite(n) && n !== viewCount.value) viewCount.value = n
  }
}

const capturing = ref(false)
const captureProgress = ref(0)
let captureTimer: number | null = null
let captureSeq = 0

function schedule() {
  if (!panoramaUrl.value) return
  if (captureTimer != null) window.clearTimeout(captureTimer)
  captureTimer = window.setTimeout(() => {
    captureTimer = null
    void run()
  }, 350)
}

async function run() {
  const url = panoramaUrl.value
  const n = Math.max(2, Math.min(24, Math.round(viewCount.value)))
  if (!url || n < 2) return

  const mySeq = ++captureSeq
  capturing.value = true
  captureProgress.value = 0
  try {
    const items: { index: string; label: string; image_url: string }[] = []
    const labels = n === 4
      ? LABELS_4
      : Array.from({ length: n }, (_, i) => `View ${i + 1}`)

    for (let i = 0; i < n; i++) {
      if (mySeq !== captureSeq) return
      const yaw = (i / n) * 360
      const canvas = await capturePanoramaOffscreen(url, {
        yaw, pitch: 0, fov: CAPTURE_FOV,
        width: captureW.value, height: captureH.value,
      })
      if (mySeq !== captureSeq) return

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      )
      if (!blob) throw new Error('toBlob returned null')
      if (mySeq !== captureSeq) return

      const nodeId = String(props.node?.id ?? 'unknown')
      const filename = `comfytv-pano-multi-${nodeId}-${Date.now()}-${i}.png`
      const body = new FormData()
      body.append('image', blob, filename)
      body.append('subfolder', 'panorama-view')
      body.append('type', 'input')

      const resp = await (app as any).api.fetchApi('/upload/image', {
        method: 'POST', body,
      })
      if (resp.status !== 200) throw new Error(`upload ${resp.status} ${resp.statusText}`)
      const data = await resp.json() as { name?: string }
      if (!data?.name) throw new Error('upload returned no name')
      if (mySeq !== captureSeq) return

      const imageUrl = `/view?filename=${encodeURIComponent(data.name)}`
                     + `&subfolder=panorama-view&type=input`
      items.push({
        index: String(i + 1),
        label: labels[i] ?? `View ${i + 1}`,
        image_url: imageUrl,
      })
      captureProgress.value = i + 1
    }

    if (mySeq !== captureSeq) return
    const payload = JSON.stringify({ images: items })
    store.applyExecutedPayload(props.state, { output: [payload] })
  } catch (e: any) {
    console.error('[ComfyTV/PanoramaMultiView] capture failed', e)

    store.applyExecutionError(props.state, {
      message: String(e?.message || e || 'panorama multi-view capture failed'),
      type: 'PanoramaMultiViewCaptureFailed',
    })
  } finally {
    if (mySeq === captureSeq) capturing.value = false
  }
}

watch(viewCount, (n) => {
  writeWidget('view_count', n)
  schedule()
})
watch(aspectRatio, (v) => {
  writeWidget('aspect_ratio', v)
  schedule()
})
watch(resolution, (v) => {
  writeWidget('resolution', v)
  schedule()
})

watch(panoramaUrl, () => schedule(), { immediate: true })
</script>

<style scoped>
.pano-multi-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}
.info {
  font-size: 11px;
  text-align: center;
  padding: 4px 0;
}
.info .muted { color: rgba(255, 255, 255, 0.55); }
.info .ok    { color: #b5e3a5; }

.ratio-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ctl {
  display: flex;
  align-items: center;
  gap: 4px;
}
.label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: rgba(255, 255, 255, 0.04);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='6' viewBox='0 0 8 6'><path d='M0 0l4 6 4-6z' fill='%23bbb'/></svg>");
  background-repeat: no-repeat;
  background-position: right 6px center;
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  padding: 3px 18px 3px 6px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  cursor: pointer;
  outline: none;
  min-width: 70px;
}
.select:hover  { border-color: rgba(255, 255, 255, 0.3); }
.select:focus  { border-color: rgba(78, 168, 255, 0.6); }
.select option { background: #1a1a2e; color: #e0e0e0; }
.dims {
  margin-left: auto;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.controls {
  display: grid;
  grid-template-columns: 80px 1fr 36px;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
.controls .label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  text-transform: none;
  letter-spacing: 0;
}
.value {
  text-align: right;
  color: rgba(255, 255, 255, 0.9);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
}
input[type='range'] { width: 100%; }
input[type='range']:disabled { opacity: 0.4; }
</style>
