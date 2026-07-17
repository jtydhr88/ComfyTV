import { onUnmounted, ref, type Ref } from 'vue'
import type { ColorGradeEffect } from '@/widgets/glsl/effects'
import { GradeRenderer, type GradeValues } from '@/widgets/glsl/renderGrade'

export const GRADE_PREVIEW_DEBOUNCE_MS = 30

export interface UseGradePreviewOptions {
  sourceImageUrl: Ref<string | null>
  canvasEl: Ref<HTMLCanvasElement | null>
  effect: Ref<ColorGradeEffect>
  values: Ref<GradeValues>
}

export function useGradePreview(opts: UseGradePreviewOptions) {
  const renderError = ref<string | null>(null)
  const renderer = new GradeRenderer()

  let previewImg: HTMLImageElement | null = null
  let previewImgUrl: string | null = null
  let previewTimer: number | null = null

  function loadPreviewImage(url: string): Promise<HTMLImageElement> {
    if (previewImg && previewImgUrl === url && previewImg.complete) {
      return Promise.resolve(previewImg)
    }
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        previewImg = img
        previewImgUrl = url
        resolve(img)
      }
      img.onerror = (e) => reject(e)
      img.src = url
    })
  }

  function renderPreview(): void {
    if (previewTimer != null) window.clearTimeout(previewTimer)
    previewTimer = window.setTimeout(() => {
      previewTimer = null
      const url = opts.sourceImageUrl.value
      const canvas = opts.canvasEl.value
      if (!url || !canvas) return
      void loadPreviewImage(url)
        .then((img) => {
          const ok = renderer.renderToCanvas(img, opts.effect.value, opts.values.value, canvas)
          renderError.value = ok ? null : renderer.error
        })
        .catch(() => {
          renderError.value = 'Failed to load image'
        })
    }, GRADE_PREVIEW_DEBOUNCE_MS)
  }

  onUnmounted(() => {
    if (previewTimer != null) window.clearTimeout(previewTimer)
    renderer.dispose()
  })

  return { renderError, renderer, renderPreview }
}
