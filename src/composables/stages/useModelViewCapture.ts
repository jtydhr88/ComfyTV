import { uploadCanvas } from '@/utils/uploadCanvas'

export const MODEL_VIEW_CAPTURE_SIZE = 1024
export const MODEL_VIEW_CAPTURE_DELAY_MS = 700

export interface ModelViewCaptureOptions {
  getCanvas: () => HTMLCanvasElement | null | undefined
  filenamePrefix: string
  logTag: string
  onCaptured: (url: string) => void
  enabled?: () => boolean
  delayMs?: number
}

export function useModelViewCapture(opts: ModelViewCaptureOptions) {
  let captureTimer: number | null = null
  let captureSeq = 0

  function scheduleCapture(): void {
    if (opts.enabled && !opts.enabled()) return
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureTimer = window.setTimeout(() => {
      captureTimer = null
      void runCapture()
    }, opts.delayMs ?? MODEL_VIEW_CAPTURE_DELAY_MS)
  }

  async function runCapture(): Promise<void> {
    const canvas = opts.getCanvas()
    if (!canvas) return
    const mySeq = ++captureSeq
    try {
      const url = await uploadCanvas(canvas, {
        subfolder: 'comfytv/model3d-view',
        filename: `${opts.filenamePrefix}-${Date.now()}.png`,
      })
      if (mySeq !== captureSeq) return
      opts.onCaptured(url)
    } catch (e) {
      console.error(`[ComfyTV/${opts.logTag}] capture upload failed`, e)
    }
  }

  function cancelCapture(): void {
    captureSeq++
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureTimer = null
  }

  return { scheduleCapture, runCapture, cancelCapture }
}
