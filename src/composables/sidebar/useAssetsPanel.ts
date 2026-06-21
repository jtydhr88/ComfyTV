import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Asset } from '@/api/schemas'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { type AssetCategoryFilter, useAssetStore } from '@/stores/assetStore'
import { uploadBlobNamed } from '@/utils/uploadCanvas'

const ASSET_DRAG_MIME = 'application/x-comfytv-asset-id'

function stripExtension(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 ? filename.slice(0, i) : filename
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

export function useAssetsPanel(isActive: () => boolean | undefined) {
  const { t } = useI18n()
  const store = useAssetStore()

  const activeFilter = ref<AssetCategoryFilter>('all')

  const uploading = ref(false)
  const uploadDone = ref(0)
  const uploadTotal = ref(0)
  const uploadError = ref<string | null>(null)

  const fileDragDepth = ref(0)

  const visibleAssets = computed(() => store.listByCategory(activeFilter.value))
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

  function openTagEditor(asset: Asset, e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tagEditor.value = { assetId: asset.id, x: Math.max(8, r.right - 176), y: r.bottom + 4 }
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

  function onPickFiles(e: Event) {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    void addFiles(files)
  }

  async function addFiles(files: File[]) {
    const images = files.filter(f => f.type.startsWith('image/'))
    if (images.length === 0 || uploading.value) return
    uploading.value = true
    uploadDone.value = 0
    uploadTotal.value = images.length
    uploadError.value = null
    try {
      for (const file of images) {
        const dims = await probeImageSize(file)
        const uploaded = await uploadBlobNamed(file, {
          subfolder: 'comfytv/assets',
          type: 'input',
          filename: file.name,
        })
        await store.create({
          name: stripExtension(file.name),
          payload_url: uploaded.url,
          media_type: 'image',
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

  function onAssetDragStart(asset: Asset, e: DragEvent) {
    e.dataTransfer?.setData(ASSET_DRAG_MIME, String(asset.id))
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
    uploading,
    uploadDone,
    uploadTotal,
    uploadError,
    fileDragDepth,
    visibleAssets,
    tagEditor,
    tagEditorStyle,
    catName,
    openTagEditor,
    closeTagEditor,
    editorHas,
    toggleTag,
    assetTooltip,
    onPickFiles,
    addFiles,
    onCreateCategory,
    onRenameCategory,
    onDeleteCategory,
    onRenameAsset,
    onDeleteAsset,
    onAssetDragStart,
    onChipDrop,
    onDragEnter,
    onDragLeave,
    onDrop,
  }
}
