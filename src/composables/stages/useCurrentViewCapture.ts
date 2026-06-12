import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { captureDimensions } from '@/utils/panoramaProjection'
import { uploadCanvas } from '@/utils/uploadCanvas'
import { readWidgetNum, writeWidget } from '@/utils/widget'
import { PanoramaViewer } from '@/widgets/three/PanoramaViewer'

const SCHEDULE_DELAY_MS = 250

export function useCurrentViewCapture(
  node: LGraphNode,
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
    writeWidget(node, 'yaw',   Number(orient.yaw.toFixed(2)))
    writeWidget(node, 'pitch', Number(orient.pitch.toFixed(2)))
    writeWidget(node, 'fov',   Number(orient.fov.toFixed(2)))

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

  watch(aspectRatio, (v) => { writeWidget(node, 'aspect_ratio', v); scheduleCapture() })
  watch(resolution,  (v) => { writeWidget(node, 'resolution',   v); scheduleCapture() })

  onMounted(() => {
    if (!viewerHostEl.value) return
    viewer = new PanoramaViewer({
      container: viewerHostEl.value,
      onOrbitEnd: () => scheduleCapture(),
    })
    viewer.setCameraOrientation({
      yaw:   readWidgetNum(node, 'yaw',   0),
      pitch: readWidgetNum(node, 'pitch', 0),
      fov:   readWidgetNum(node, 'fov',   75),
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
