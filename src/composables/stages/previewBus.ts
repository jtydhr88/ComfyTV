import { ref } from 'vue'

export type PreviewCanvasGetter = () => HTMLCanvasElement | null

const sources = new Map<string, PreviewCanvasGetter>()

export const previewBusRevision = ref(0)

export function registerPreviewSource(
  nodeId: string,
  getCanvas: PreviewCanvasGetter,
): () => void {
  sources.set(nodeId, getCanvas)
  previewBusRevision.value++
  let active = true
  return () => {
    if (!active) return
    active = false
    if (sources.get(nodeId) === getCanvas) {
      sources.delete(nodeId)
      previewBusRevision.value++
    }
  }
}

export function getPreviewSource(nodeId: string): PreviewCanvasGetter | null {
  return sources.get(nodeId) ?? null
}
