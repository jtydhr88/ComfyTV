import { getCurrentInstance, inject, provide, ref, type Component, type InjectionKey, type Ref } from 'vue'

import { messages } from './locales'

export interface PentradoUploadOptions {
  subfolder: string
  filename?: string
  filenamePrefix?: string
}

export interface PentradoUploadResult {
  url: string
}

export interface PentradoMediaInput {
  url: string
  name?: string | null
  mime?: string | null
}

export interface PentradoFontResource {
  name: string
  url: string
}

export interface PentradoLibraryExport {
  blob: Blob
  filename: string
  mime: string
  width: number
  height: number
  preview: HTMLCanvasElement
}

export interface PentradoCanvasDropHandler {
  dragActive: Ref<boolean>
  onDragEnter(e: DragEvent): void
  onDragOver(e: DragEvent): void
  onDragLeave(e: DragEvent): void
  onDrop(e: DragEvent): void
}

export interface PentradoDropTarget {
  addImageFromFile(file: File): void
  importPsdFile(file: File): Promise<void>
  addMedia(media: PentradoMediaInput): Promise<void>
}

export interface PentradoToolbarAction {
  id: string
  label?: string
  title?: string
  icon?: Component
  busy?(editor: any): boolean
  run(editor: any): void | Promise<void>
}

export interface PentradoHost {
  uploadBlob?(blob: Blob, opts: PentradoUploadOptions): Promise<PentradoUploadResult>
  uploadCanvas?(canvas: HTMLCanvasElement, opts: PentradoUploadOptions): Promise<string>
  download?(filename: string, blob: Blob): void
  notify?(kind: 'error' | 'success', message: string): void
  t?(key: string): string
  fontManifestUrl?: string
  listFonts?(): Promise<PentradoFontResource[]>
  saveToLibrary?(item: PentradoLibraryExport): Promise<void>
  components?: {
    AssetPicker?: Component
  }
  toolbarActions?: PentradoToolbarAction[]
  createCanvasDropHandler?(target: PentradoDropTarget): PentradoCanvasDropHandler
}

export const PSD_MIME = 'image/vnd.adobe.photoshop'

export function isPsdMedia(media: PentradoMediaInput): boolean {
  if (media.mime === PSD_MIME) return true
  const name = (media.name ?? '').toLowerCase()
  if (name.endsWith('.psd') || name.endsWith('.psb')) return true
  const url = media.url.toLowerCase()
  return /\.(psd|psb)([?&#]|$)/.test(url) || /filename=[^&]*\.(psd|psb)/.test(url)
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  queueMicrotask(() => URL.revokeObjectURL(url))
}

function lookupMessage(key: string): string {
  const path = key.split('.')
  let cur: unknown = messages.en
  for (const part of path) {
    if (!cur || typeof cur !== 'object') return key
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string' ? cur : key
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('canvas.toBlob returned null')
  return blob
}

export function createDefaultFileDrop(target: PentradoDropTarget): PentradoCanvasDropHandler {
  const dragActive = ref(false)
  let depth = 0
  const hasFiles = (e: DragEvent): boolean =>
    [...(e.dataTransfer?.types ?? [])].includes('Files')
  return {
    dragActive,
    onDragEnter(e) {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth += 1
      dragActive.value = true
    },
    onDragOver(e) {
      if (!hasFiles(e)) return
      e.preventDefault()
    },
    onDragLeave(e) {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) dragActive.value = false
    },
    onDrop(e) {
      e.preventDefault()
      depth = 0
      dragActive.value = false
      for (const file of [...(e.dataTransfer?.files ?? [])]) {
        if (isPsdMedia({ url: '', name: file.name, mime: file.type })) {
          void target.importPsdFile(file)
        } else if (file.type.startsWith('image/')) {
          target.addImageFromFile(file)
        }
      }
    },
  }
}

function createStandaloneHost(): Required<Pick<PentradoHost, 'uploadBlob' | 'uploadCanvas' | 'download' | 'notify' | 't'>> & PentradoHost {
  return {
    async uploadBlob(blob) {
      return { url: URL.createObjectURL(blob) }
    },
    async uploadCanvas(canvas) {
      return URL.createObjectURL(await canvasToBlob(canvas))
    },
    download: downloadBlob,
    notify(kind, message) {
      if (kind === 'error') console.error('[pentrado]', message)
      else console.info('[pentrado]', message)
    },
    t: lookupMessage,
  }
}

export interface ResolvedPentradoHost {
  uploadBlob(blob: Blob, opts: PentradoUploadOptions): Promise<PentradoUploadResult>
  uploadCanvas(canvas: HTMLCanvasElement, opts: PentradoUploadOptions): Promise<string>
  download(filename: string, blob: Blob): void
  notify(kind: 'error' | 'success', message: string): void
  t(key: string): string
  fontManifestUrl?: string
  listFonts?(): Promise<PentradoFontResource[]>
  saveToLibrary?(item: PentradoLibraryExport): Promise<void>
  components: NonNullable<PentradoHost['components']>
  toolbarActions: PentradoToolbarAction[]
  createCanvasDropHandler(target: PentradoDropTarget): PentradoCanvasDropHandler
}

export function resolvePentradoHost(host?: PentradoHost | null): ResolvedPentradoHost {
  const fallback = createStandaloneHost()
  const h = host ?? {}
  return {
    uploadBlob: h.uploadBlob?.bind(h) ?? fallback.uploadBlob,
    uploadCanvas: h.uploadCanvas?.bind(h) ?? fallback.uploadCanvas,
    download: h.download?.bind(h) ?? fallback.download,
    notify: h.notify?.bind(h) ?? fallback.notify,
    t: h.t?.bind(h) ?? fallback.t,
    fontManifestUrl: h.fontManifestUrl,
    listFonts: h.listFonts?.bind(h),
    saveToLibrary: h.saveToLibrary?.bind(h),
    components: h.components ?? {},
    toolbarActions: h.toolbarActions ?? [],
    createCanvasDropHandler: h.createCanvasDropHandler?.bind(h) ?? createDefaultFileDrop,
  }
}

const PENTRADO_HOST_KEY: InjectionKey<ResolvedPentradoHost> = Symbol('pentrado-host')

export function providePentradoHost(host?: PentradoHost | null): ResolvedPentradoHost {
  const resolved = resolvePentradoHost(host)
  provide(PENTRADO_HOST_KEY, resolved)
  return resolved
}

export function usePentradoHost(): ResolvedPentradoHost {
  const injected = getCurrentInstance() ? inject(PENTRADO_HOST_KEY, null) : null
  return injected ?? resolvePentradoHost(null)
}
