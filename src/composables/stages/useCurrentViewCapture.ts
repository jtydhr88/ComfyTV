import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

import { useStageStore, type StageState } from '@/stores/stageStore'
import { captureDimensions } from '@/utils/panoramaProjection'
import { uploadCanvas } from '@/utils/uploadCanvas'
import { PanoramaViewer } from '@/widgets/three/PanoramaViewer'

const SCHEDULE_DELAY_MS = 250

export function useCurrentViewCapture(
  node: any,
  state: StageState,
  viewerHostEl: Ref<HTMLElement | null>,
  aspectRatio: Ref<string>,
  resolution: Ref<string>,
) {
  const store = useStageStore()

  const panoramaUrl = computed<string | null>(() => {
    const inp = state.inputs.find(i => i.slot === 'panorama')
    return inp && inp.source === 'upstream' && inp.content ? inp.content : null
  })

  const capturing = ref(false)

  function getWidget(name: string): any | null {
    return node?.widgets?.find((w: any) => w.name === name) ?? null
  }
  function readWidgetFloat(name: string, fallback: number): number {
    const w = getWidget(name)
    if (!w) return fallback
    const n = Number(w.value)
    return Number.isFinite(n) ? n : fallback
  }
  function writeWidget(name: string, value: number | string) {
    const w = getWidget(name)
    if (!w) return
    if (w.value !== value) {
      w.value = value
      w.callback?.(value)
    }
  }

  const captureSize = computed(() => captureDimensions(aspectRatio.value, resolution.value))

  let viewer: PanoramaViewer | null = null
  let captureTimer: number | null = null
  let captureSeq = 0

  function scheduleCapture() {
    if (!viewer || !panoramaUrl.value) return
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureTimer = window.setTimeout(() => {
      captureTimer = null
      void runCapture()
    }, SCHEDULE_DELAY_MS)
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
      const { w, h } = captureSize.value
      const canvas = viewer.captureCurrentView(w, h)
      if (mySeq !== captureSeq) return

      const nodeId = String(node?.id ?? 'unknown')
      const viewUrl = await uploadCanvas(canvas, {
        subfolder: 'panorama-view',
        filename: `comfytv-pano-view-${nodeId}-${Date.now()}.png`,
      })
      if (mySeq !== captureSeq) return

      store.applyExecutedPayload(state, { output: [viewUrl] })
    } catch (e) {
      console.error('[ComfyTV/PanoramaCurrentView] capture failed', e)
    } finally {
      if (mySeq === captureSeq) capturing.value = false
    }
  }

  watch(aspectRatio, (v) => { writeWidget('aspect_ratio', v); scheduleCapture() })
  watch(resolution,  (v) => { writeWidget('resolution',   v); scheduleCapture() })

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
    viewer?.dispose?.()
    viewer = null
  })

  return {
    panoramaUrl,
    capturing,
    captureSize,
  }
}
