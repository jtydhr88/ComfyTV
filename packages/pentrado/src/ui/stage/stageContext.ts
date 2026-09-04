import type { Ref, ShallowRef } from 'vue'

import type { ResolvedPentradoHost } from '../../host'
import type { getFontStore } from '../../fontStore'
import type { PanZoom } from '../../panZoom'
import type { ToolId } from '../../types'
import type { createEditor, createWebGLCompositor, SceneNode, ShapeKind, Transform } from '../../engine'
import type { LayerEditorStorage, UseLayerEditorStageOptions } from '../useLayerEditorStage'

export const UPLOAD_DEBOUNCE_MS = 800
export const CAPTURE_DEBOUNCE_MS = 700
export const SUSPEND_GRACE_MS = 1000
export const MAX_CONTENT_DIM = 4096
export const PERSIST_DEBOUNCE_MS = 250

export type StageEditor = ReturnType<typeof createEditor>
export type StageCompositor = ReturnType<typeof createWebGLCompositor>
export type StageFontStore = ReturnType<typeof getFontStore>

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to load image: ${url}`))
    img.src = url
  })
}

export function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob null'))), 'image/png'))
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export interface StageCtx {
  opts: UseLayerEditorStageOptions
  host: ResolvedPentradoHost
  t: (key: string) => string
  toastError(detail: string): void
  toastInfo(detail: string): void
  storage: LayerEditorStorage
  instanceId: string | number
  editor: StageEditor
  content: StageEditor['content']
  compositor: StageCompositor
  fontStore: StageFontStore
  panZoom: PanZoom
  version: Ref<number>
  activeId: Ref<string | null>
  glOk: Ref<boolean>
  suspended: Ref<boolean>
  capturing: Ref<boolean>
  exportingPsd: Ref<boolean>
  importingPsd: Ref<boolean>
  editingTextId: Ref<string | null>
  maskView: Ref<boolean>
  paintTarget: Ref<'content' | 'mask'>
  capturedImageUrl: ShallowRef<string>
  tool: Ref<ToolId>
  brushSize: Ref<number>
  brushOpacity: Ref<number>
  brushHardness: Ref<number>
  brushColor: Ref<string>
  backgroundColor: Ref<string>
  shapeKind: Ref<ShapeKind>
  shapeFillEnabled: Ref<boolean>
  shapeFillColor: Ref<string>
  shapeStrokeEnabled: Ref<boolean>
  shapeStrokeColor: Ref<string>
  shapeStrokeWidth: Ref<number>
  shapeCombine: Ref<boolean>
  shapeSides: Ref<number>
  shapeStarRatio: Ref<number>
  shapeTurns: Ref<number>
  warpPoints: Ref<number>
  wandThreshold: Ref<number>
  wandAntialias: Ref<boolean>
  wandContiguous: Ref<boolean>
  symmetryMode: Ref<'none' | 'mirror-h' | 'mirror-v' | 'mirror-both' | 'mandala'>
  symmetrySectors: Ref<number>
  gradientShape: Ref<'linear' | 'radial'>
  gradientToTransparent: Ref<boolean>
  gradientReverse: Ref<boolean>
  engineNode(id: string): SceneNode | null
  invalidateIfAwake(): void
  stopPressureSampler: (() => void) | null
  requestRender(): void
  fitView(): void
  mainCanvas(): HTMLCanvasElement | null
  pickColorAt(pt: { x: number; y: number }, target?: 'fg' | 'bg'): boolean
  onChange(): void
  scheduleUpload(): void
  scheduleCapture(): void
  flattenComposite(): HTMLCanvasElement
  readbackCanvas(): HTMLCanvasElement
  editProp<T>(label: string, dirty: number, get: () => T, set: (v: T) => void, value: T, mergeKey?: string): void
  selectionTargets(id: string): string[]
  batch(label: string, ids: string[], apply: (id: string) => void): void
  syncEngineTool(): void
  addEmptyLayer(): void
  addTextLayerAt(at: { x: number; y: number }): string
  addImageFromUrl(url: string, name: string): Promise<void>
  setArtboardSize(w: number, h: number): void
  setLayerTransform(id: string, patch: Partial<Transform>): boolean
}
