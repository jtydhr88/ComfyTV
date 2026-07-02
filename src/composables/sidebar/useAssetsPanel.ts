import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Asset } from '@/api/schemas'
import { type LightboxItem, openLightbox } from '@/composables/useLightbox'
import { ASSET_DRAG_MIME } from '@/composables/sidebar/assetCanvasDrop'
import { canvasCenter, createAssetLoaderNode } from '@/composables/stages/assetLoaderNode'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { type AssetCategoryFilter, useAssetStore } from '@/stores/assetStore'
import { uploadBlobNamed } from '@/utils/uploadCanvas'

function stripExtension(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 ? filename.slice(0, i) : filename
}

type AssetMediaType = 'image' | 'video' | 'audio'
export type AssetMediaFilter = 'all' | AssetMediaType
export type AssetViewMode = 'grid' | 'list'

export const ASSET_MEDIA_FILTERS: AssetMediaFilter[] = ['all', 'image', 'video', 'audio']

const ASSET_MENU_WIDTH = 192
const TAG_EDITOR_WIDTH = 176

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function mediaTypeOf(file: File): AssetMediaType | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return null
}

function probeImageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function probeVideoSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({ width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}

function probeMediaSize(file: File, kind: AssetMediaType): Promise<{ width: number; height: number } | null> {
  if (kind === 'image') return probeImageSize(file)
  if (kind === 'video') return probeVideoSize(file)
  return Promise.resolve(null)
}

export function useAssetsPanel(isActive: () => boolean | undefined) {
  const { t } = useI18n()
  const store = useAssetStore()

  const activeFilter = ref<AssetCategoryFilter>('all')
  const mediaFilter = ref<AssetMediaFilter>('all')
  const viewMode = useStorage<AssetViewMode>('comfytv:assets:view-mode', 'grid')
  const searchQuery = ref('')

  const uploading = ref(false)
  const uploadDone = ref(0)
  const uploadTotal = ref(0)
  const uploadError = ref<string | null>(null)

  const fileDragDepth = ref(0)

  const categoryAssets = computed(() => store.listByCategory(activeFilter.value))
  const visibleAssets = computed(() => {
    let rows = mediaFilter.value === 'all'
      ? categoryAssets.value
      : categoryAssets.value.filter(a => a.media_type === mediaFilter.value)
    const q = searchQuery.value.trim().toLowerCase()
    if (q) rows = rows.filter(a => a.name.toLowerCase().includes(q))
    return rows
  })

  function mediaCount(type: AssetMediaFilter): number {
    return type === 'all'
      ? categoryAssets.value.length
      : categoryAssets.value.filter(a => a.media_type === type).length
  }
  const uploadCategoryIds = computed<number[]>(() =>
    typeof activeFilter.value === 'number' ? [activeFilter.value] : [],
  )

  const tagEditor = ref<{ assetId: number; x: number; y: number } | null>(null)
  const editorAsset = computed(() =>
    tagEditor.value ? store.byId(tagEditor.value.assetId) ?? null : null,
  )
  const tagEditorStyle = computed(() =>
    tagEditor.value
      ? { left: `${tagEditor.value.x}px`, top: `${tagEditor.value.y}px` }
      : {},
  )

  function catName(id: number): string {
    return store.categories.find(c => c.id === id)?.name ?? `#${id}`
  }

  function closeTagEditor() {
    tagEditor.value = null
  }

  function editorHas(catId: number): boolean {
    return editorAsset.value?.category_ids.includes(catId) ?? false
  }

  function toggleTag(catId: number) {
    const a = editorAsset.value
    if (!a) return
    if (a.category_ids.includes(catId)) void store.removeTag(a.id, catId)
    else void store.addTag(a.id, catId)
  }

  function assetTooltip(asset: Asset): string {
    const dims = asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''
    return `${asset.name || '—'}${dims}`
  }

  function assetMeta(asset: Asset): string {
    if (asset.media_type === 'image' && asset.width && asset.height)
      return `${asset.width}×${asset.height}`
    if (asset.size_bytes) return formatSize(asset.size_bytes)
    return ''
  }

  const assetMenu = ref<{ assetId: number; x: number; y: number } | null>(null)
  const menuAsset = computed(() =>
    assetMenu.value ? store.byId(assetMenu.value.assetId) ?? null : null,
  )
  const assetMenuStyle = computed(() =>
    assetMenu.value
      ? { left: `${assetMenu.value.x}px`, top: `${assetMenu.value.y}px` }
      : {},
  )

  function openAssetMenu(asset: Asset, e: MouseEvent, anchor: 'pointer' | 'element' = 'element') {
    let x: number
    let y: number
    if (anchor === 'pointer') {
      x = e.clientX
      y = e.clientY
    } else {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
      x = r.right - ASSET_MENU_WIDTH
      y = r.bottom + 4
    }
    x = Math.min(Math.max(8, x), window.innerWidth - ASSET_MENU_WIDTH - 8)
    y = Math.min(Math.max(8, y), window.innerHeight - 176)
    assetMenu.value = { assetId: asset.id, x, y }
  }

  function closeAssetMenu() {
    assetMenu.value = null
  }

  function menuLoadNode() {
    const a = menuAsset.value
    closeAssetMenu()
    if (a) onLoadAssetNode(a)
  }

  function menuEditTags() {
    const m = assetMenu.value
    const a = menuAsset.value
    closeAssetMenu()
    if (!m || !a) return
    tagEditor.value = {
      assetId: a.id,
      x: Math.min(Math.max(8, m.x), window.innerWidth - TAG_EDITOR_WIDTH - 8),
      y: m.y,
    }
  }

  function menuRenameAsset() {
    const a = menuAsset.value
    closeAssetMenu()
    if (a) void onRenameAsset(a)
  }

  function menuDeleteAsset() {
    const a = menuAsset.value
    closeAssetMenu()
    if (a) void onDeleteAsset(a)
  }

  function viewFullAsset(asset: Asset) {
    if (asset.media_type !== 'image') return
    const imgs = visibleAssets.value.filter((a) => a.media_type === 'image')
    const idx = imgs.findIndex((a) => a.id === asset.id)
    if (idx < 0) return
    const items: LightboxItem[] = imgs.map((a) => ({
      url: a.payload_url,
      label: a.name,
    }))
    openLightbox(items, idx)
  }

  function menuViewFull() {
    const a = menuAsset.value
    closeAssetMenu()
    if (a) viewFullAsset(a)
  }

  function onPickFiles(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    void addFiles(files)
  }

  async function addFiles(files: File[]) {
    const media = files
      .map(f => ({ file: f, kind: mediaTypeOf(f) }))
      .filter((m): m is { file: File; kind: AssetMediaType } => m.kind !== null)
    if (media.length === 0 || uploading.value) return
    uploading.value = true
    uploadDone.value = 0
    uploadTotal.value = media.length
    uploadError.value = null
    try {
      for (const { file, kind } of media) {
        const dims = await probeMediaSize(file, kind)
        const uploaded = await uploadBlobNamed(file, {
          subfolder: 'comfytv/assets',
          type: 'input',
          filename: file.name,
        })
        await store.create({
          name: stripExtension(file.name),
          payload_url: uploaded.url,
          media_type: kind,
          category_ids: uploadCategoryIds.value,
          mime_type: file.type || null,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          size_bytes: file.size,
          source: 'upload',
        })
        uploadDone.value += 1
      }
    } catch (e) {
      console.warn('[ComfyTV/assets] upload failed', e)
      uploadError.value = t('assets.uploadFailed', { detail: String(e) })
    } finally {
      uploading.value = false
    }
  }

  async function onCreateCategory() {
    const name = (await askText({
      title: t('assets.category.new'),
      label: t('assets.category.newPrompt'),
    }))?.trim()
    if (!name) return
    const cat = await store.createCategory(name)
    if (cat) activeFilter.value = cat.id
  }

  async function onRenameCategory(id: number, current: string) {
    const name = (await askText({
      title: t('assets.category.rename'),
      label: t('assets.category.renamePrompt'),
      initialValue: current,
    }))?.trim()
    if (!name || name === current) return
    void store.renameCategory(id, name)
  }

  async function onDeleteCategory(id: number) {
    const ok = await askConfirm({
      title: t('assets.category.delete'),
      message: t('assets.category.deleteConfirm'),
      danger: true,
    })
    if (!ok) return
    const removed = await store.removeCategory(id)
    if (removed && activeFilter.value === id) activeFilter.value = 'all'
  }

  async function onRenameAsset(asset: Asset) {
    const name = (await askText({
      title: t('assets.card.rename'),
      label: t('assets.card.renamePrompt'),
      initialValue: asset.name,
    }))?.trim()
    if (!name || name === asset.name) return
    void store.rename(asset.id, name)
  }

  async function onDeleteAsset(asset: Asset) {
    const ok = await askConfirm({
      title: t('assets.card.delete'),
      message: t('assets.card.deleteConfirm'),
      danger: true,
    })
    if (!ok) return
    void store.remove(asset.id)
  }

  function onLoadAssetNode(asset: Asset) {
    createAssetLoaderNode(asset, canvasCenter(), { anchor: 'center', select: true })
  }

  function onAssetDragStart(asset: Asset, e: DragEvent) {
    if (!e.dataTransfer) return
    e.dataTransfer.setData(ASSET_DRAG_MIME, String(asset.id))
    e.dataTransfer.effectAllowed = 'copy'
  }

  function onChipDrop(categoryId: number, e: DragEvent) {
    const raw = e.dataTransfer?.getData(ASSET_DRAG_MIME)
    if (!raw) return
    const id = Number(raw)
    if (!Number.isFinite(id)) return
    void store.addTag(id, categoryId)
  }

  function isFileDrag(e: DragEvent): boolean {
    const types = Array.from(e.dataTransfer?.types ?? [])
    return types.includes('Files') && !types.includes(ASSET_DRAG_MIME)
  }

  function onDragEnter(e: DragEvent) {
    if (isFileDrag(e)) fileDragDepth.value += 1
  }

  function onDragLeave(e: DragEvent) {
    if (isFileDrag(e)) fileDragDepth.value = Math.max(0, fileDragDepth.value - 1)
  }

  function onDrop(e: DragEvent) {
    if (isFileDrag(e)) {
      fileDragDepth.value = 0
      void addFiles(Array.from(e.dataTransfer?.files ?? []))
    }
  }

  watch(isActive, (active) => {
    if (active) {
      store.ensureHydrated()
      store.installWebSocketSync()
    }
  }, { immediate: true })

  return {
    store,
    activeFilter,
    mediaFilter,
    mediaCount,
    mediaFilters: ASSET_MEDIA_FILTERS,
    viewMode,
    searchQuery,
    uploading,
    uploadDone,
    uploadTotal,
    uploadError,
    fileDragDepth,
    visibleAssets,
    tagEditor,
    tagEditorStyle,
    catName,
    closeTagEditor,
    editorHas,
    toggleTag,
    assetTooltip,
    assetMeta,
    assetMenu,
    assetMenuStyle,
    menuAsset,
    openAssetMenu,
    closeAssetMenu,
    menuLoadNode,
    menuEditTags,
    menuRenameAsset,
    menuDeleteAsset,
    menuViewFull,
    viewFullAsset,
    onPickFiles,
    addFiles,
    onCreateCategory,
    onRenameCategory,
    onDeleteCategory,
    onRenameAsset,
    onDeleteAsset,
    onLoadAssetNode,
    onAssetDragStart,
    onChipDrop,
    onDragEnter,
    onDragLeave,
    onDrop,
  }
}
