import type { Compositor, CompositeInput } from '../compositor'
import type { ContentStore } from '../content'
import type { Rect } from '../node'

export interface PreviewOverride {
  canvas: HTMLCanvasElement
  version: number
  rects?: Rect[] | null
}

export interface RenderDeps {
  content: ContentStore
  compositor: Compositor
  devicePixelRatio?: number
  overrides?: Map<string, PreviewOverride>
  viewport?: Rect | null
}

export interface BuiltInputs {
  inputs: CompositeInput[]
  cleanup: () => void
}

export { buildDocumentInputs, docRectToSourceRect, renderDocument } from './renderInputs'
export {
  VIEWPORT_STAMP_QUANTUM,
  clipRunAround,
  createMergeCache,
  invalidateMergeCache,
  renderDocumentCached,
  viewportStamp,
  type MergeCache,
} from './mergeCache'
