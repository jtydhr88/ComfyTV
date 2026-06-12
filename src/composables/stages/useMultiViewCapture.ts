import { computed, ref, watch, type Ref } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { CAPTURE_FOV, captureDimensions, LABELS_4 } from '@/utils/panoramaProjection'
import { uploadCanvas } from '@/utils/uploadCanvas'
import { getWidget, writeWidget } from '@/utils/widget'
import { capturePanoramaOffscreen } from '@/widgets/three/PanoramaViewer'

const SCHEDULE_DELAY_MS = 350
const MIN_VIEWS = 2
const MAX_VIEWS = 24

export function useMultiViewCapture(
  node: LGraphNode,
  state: StageState,
  viewCount: Ref<number>,
  aspectRatio: Ref<string>,
  resolution: Ref<string>,
) {
  const store = useStageStore()

  const panoramaUrl = computed<string | null>(() => {
    const inp = state.inputs.find(i => i.slot === 'panorama')
    return inp && inp.source === 'upstream' && inp.content ? inp.content : null
  })

  const vcw = getWidget(node, 'view_count')
  if (vcw) {
    const orig = vcw.callback
    vcw.callback = (v: unknown) => {
      orig?.call(vcw, v)
      const n = Number(v)
      if (Number.isFinite(n) && n !== viewCount.value) viewCount.value = n
    }
  }

  const captureSize = computed(() => captureDimensions(aspectRatio.value, resolution.value))

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
    }, SCHEDULE_DELAY_MS)
  }

  async function run() {
    const url = panoramaUrl.value
    const n = Math.max(MIN_VIEWS, Math.min(MAX_VIEWS, Math.round(viewCount.value)))
    if (!url || n < MIN_VIEWS) return

    const mySeq = ++captureSeq
    capturing.value = true
    captureProgress.value = 0
    try {
      const items: { index: string; label: string; image_url: string }[] = []
      const labels = n === 4
        ? LABELS_4
        : Array.from({ length: n }, (_, i) => `View ${i + 1}`)

      const { w, h } = captureSize.value
      for (let i = 0; i < n; i++) {
        if (mySeq !== captureSeq) return
        const yaw = (i / n) * 360
        const canvas = await capturePanoramaOffscreen(url, {
          yaw, pitch: 0, fov: CAPTURE_FOV, width: w, height: h,
        })
        if (mySeq !== captureSeq) return

        const nodeId = String(node?.id ?? 'unknown')
        const imageUrl = await uploadCanvas(canvas, {
          subfolder: 'panorama-view',
          filename: `comfytv-pano-multi-${nodeId}-${Date.now()}-${i}.png`,
        })
        if (mySeq !== captureSeq) return

        items.push({
          index: String(i + 1),
          label: labels[i] ?? `View ${i + 1}`,
          image_url: imageUrl,
        })
        captureProgress.value = i + 1
      }

      if (mySeq !== captureSeq) return
      store.applyExecutedPayload(state, { output: [JSON.stringify({ images: items })] })
    } catch (e: any) {
      console.error('[ComfyTV/PanoramaMultiView] capture failed', e)
      store.applyExecutionError(state, {
        message: String(e?.message || e || 'panorama multi-view capture failed'),
        type: 'PanoramaMultiViewCaptureFailed',
      })
    } finally {
      if (mySeq === captureSeq) capturing.value = false
    }
  }

  watch(viewCount,   (n) => { writeWidget(node, 'view_count',   n); schedule() })
  watch(aspectRatio, (v) => { writeWidget(node, 'aspect_ratio', v); schedule() })
  watch(resolution,  (v) => { writeWidget(node, 'resolution',   v); schedule() })

  watch(panoramaUrl, () => schedule(), { immediate: true })

  return {
    panoramaUrl,
    capturing,
    captureProgress,
    captureSize,
  }
}
