<template>
  <div class="pano-view-stage">
    <div class="viewer-wrap">
      <div
        ref="viewerHostEl"
        class="viewer-shell"
        :style="viewerStyle"
      >
        <div v-if="!panoramaUrl" class="empty-state">
          <div class="empty-icon">🌐</div>
          <div class="empty-text">{{ $t('panoramaView.connectPanorama') }}</div>
        </div>
      </div>
    </div>

    <div class="controls">
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

    <div class="status">
      <span v-if="!panoramaUrl" class="muted">{{ $t('panoramaView.connectPanorama') }}</span>
      <span v-else-if="capturing" class="muted">{{ $t('panoramaView.capturing') }}</span>
      <span v-else-if="state.output" class="ok">{{ $t('panoramaView.captured') }}</span>
      <span v-else class="muted">{{ $t('panoramaView.orbitToCapture') }}</span>
    </div>

    <StageCard
      :state="state"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
      hide-output
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStageStore, type StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { PanoramaViewer } from '@/widgets/three/PanoramaViewer'
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
const VIEWER_HEIGHT_PX = 300

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

function readWidgetFloat(name: string, fallback: number): number {
  const w = getWidget(name)
  if (!w) return fallback
  const n = Number(w.value)
  return Number.isFinite(n) ? n : fallback
}

function readWidgetStr(name: string, fallback: string): string {
  const w = getWidget(name)
  if (!w) return fallback
  const v = String(w.value ?? '')
  return v || fallback
}

function writeWidget(name: string, value: number | string) {
  const w = getWidget(name)
  if (!w) return
  if (w.value !== value) {
    w.value = value
    w.callback?.(value)
  }
}

const viewerHostEl = ref<HTMLDivElement | null>(null)
const capturing = ref(false)

const aspectRatio = ref<string>(readWidgetStr('aspect_ratio', '16:9'))
const resolution  = ref<string>(readWidgetStr('resolution',   '1K'))

let viewer: PanoramaViewer | null = null
let captureTimer: number | null = null
let captureSeq = 0

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

  if (w >= h) {
    return Math.max(16, Math.round((short * w / h) / 8) * 8)
  }
  return Math.max(16, Math.round(short / 8) * 8)
})

const captureH = computed(() => {
  const { w, h } = aspectParts.value
  const short = RESOLUTION_TO_SHORT_SIDE[resolution.value] ?? 1024
  if (w >= h) {
    return Math.max(16, Math.round(short / 8) * 8)
  }
  return Math.max(16, Math.round((short * h / w) / 8) * 8)
})

const viewerStyle = computed(() => ({
  height: `${VIEWER_HEIGHT_PX}px`,
  aspectRatio: `${aspectParts.value.w} / ${aspectParts.value.h}`,
}))

function scheduleCapture() {
  if (!viewer || !panoramaUrl.value) return
  if (captureTimer != null) window.clearTimeout(captureTimer)
  captureTimer = window.setTimeout(() => {
    captureTimer = null
    void runCapture()
  }, 250)
}

async function runCapture() {
  if (!viewer || !panoramaUrl.value) return
  const orient = viewer.getCameraOrientation()
  writeWidget('yaw',   Number(orient.yaw.toFixed(2)))
  writeWidget('pitch', Number(orient.pitch.toFixed(2)))
  writeWidget('fov',   Number(orient.fov.toFixed(2)))

  const mySeq = ++captureSeq
  capturing.value = true
  try {
    const canvas = viewer.captureCurrentView(captureW.value, captureH.value)
    if (mySeq !== captureSeq) return

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!blob) throw new Error('toBlob returned null')
    if (mySeq !== captureSeq) return

    const nodeId = String(props.node?.id ?? 'unknown')
    const filename = `comfytv-pano-view-${nodeId}-${Date.now()}.png`
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

    const viewUrl = `/view?filename=${encodeURIComponent(data.name)}`
                  + `&subfolder=panorama-view&type=input`
    store.applyExecutedPayload(props.state, { output: [viewUrl] })
  } catch (e) {
    console.error('[ComfyTV/PanoramaCurrentView] capture failed', e)
  } finally {
    if (mySeq === captureSeq) capturing.value = false
  }
}

watch(aspectRatio, (v) => {
  writeWidget('aspect_ratio', v)
  scheduleCapture()
})
watch(resolution, (v) => {
  writeWidget('resolution', v)
  scheduleCapture()
})

onMounted(() => {
  if (!viewerHostEl.value) return
  viewer = new PanoramaViewer({
    container: viewerHostEl.value,
    onOrbitEnd: () => scheduleCapture(),
  })
  viewer.setCameraOrientation({
    yaw:   readWidgetFloat('yaw',   0),
    pitch: readWidgetFloat('pitch', 0),
    fov:   readWidgetFloat('fov',   75),
  })
  if (panoramaUrl.value) {
    void (async () => {
      await viewer!.setPanoramaUrl(panoramaUrl.value)
      scheduleCapture()
    })()
  }
})

watch(panoramaUrl, async (url) => {
  if (!viewer) return
  await viewer.setPanoramaUrl(url)
  if (url) scheduleCapture()
})

onBeforeUnmount(() => {
  if (captureTimer != null) {
    window.clearTimeout(captureTimer)
    captureTimer = null
  }
  viewer?.dispose()
  viewer = null
})
</script>

<style scoped>
.pano-view-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}

.viewer-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}
.viewer-shell {
  position: relative;
  max-width: 100%;
  background: #0a0a0f;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  gap: 6px;
  pointer-events: none;
}
.empty-icon { font-size: 32px; opacity: 0.6; }
.empty-text { font-size: 12px; text-align: center; padding: 0 12px; }

.controls {
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
.select:hover {
  border-color: rgba(255, 255, 255, 0.3);
}
.select:focus {
  border-color: rgba(78, 168, 255, 0.6);
}
.select option {
  background: #1a1a2e;
  color: #e0e0e0;
}
.dims {
  margin-left: auto;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.status {
  font-size: 10px;
  text-align: center;
  padding: 2px 0;
}
.status .muted { color: rgba(255, 255, 255, 0.5); }
.status .ok    { color: #b5e3a5; }
</style>
