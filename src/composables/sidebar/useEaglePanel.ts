import { computed, ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import {
  eagleFileUrl,
  fetchEagleFolders,
  fetchEagleItems,
  fetchEagleSimilar,
  fetchEagleStatus,
  flushEagle,
  importEagleItem,
} from '@/api/eagle'
import type { EagleFolder, EagleItem, EagleStatus } from '@/api/schemas'
import { openLightbox } from '@/composables/useLightbox'
import { app } from '@/lib/comfyApp'

const PAGE_SIZE = 100

function toast(severity: string, summary: string, detail = ''): void {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity, summary, detail, life: 5000 })
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function useEaglePanel(isActive: () => boolean | undefined) {
  const { t } = useI18n()

  const status = ref<EagleStatus | null>(null)
  const items = ref<EagleItem[]>([])
  const folders = ref<EagleFolder[]>([])
  const keyword = ref('')
  const folder = ref('')
  const mediaType = ref('')
  const aiMode = ref(false)
  const similarTo = ref<EagleItem | null>(null)
  const total = ref<number | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const exhausted = ref(false)
  const flushing = ref(false)
  const error = ref('')
  const importingIds = ref<Set<string>>(new Set())

  const enabled = computed(() => status.value === null || status.value.enabled)
  const mode = computed(() => status.value?.mode ?? 'offline')
  const pendingCount = computed(() => status.value?.pending ?? 0)
  const aiReady = computed(() => status.value?.ai_ready === true)
  const aiActive = computed(() =>
    aiReady.value && aiMode.value && keyword.value.trim() !== '')

  async function refreshStatus(fresh = false): Promise<void> {
    try {
      status.value = await fetchEagleStatus(fresh)
    } catch (e) {
      error.value = message(e)
    }
  }

  async function loadFolders(): Promise<void> {
    if (!enabled.value) return
    try {
      folders.value = (await fetchEagleFolders()).folders
    } catch {
      folders.value = []
    }
  }

  function trackExhausted(pageLen: number, resTotal: number | null | undefined): void {
    total.value = resTotal ?? null
    exhausted.value = resTotal != null
      ? items.value.length >= resTotal
      : pageLen < PAGE_SIZE
  }

  async function reload(): Promise<void> {
    if (!enabled.value) return
    loading.value = true
    error.value = ''
    try {
      const res = similarTo.value
        ? await fetchEagleSimilar(similarTo.value.id)
        : await fetchEagleItems({
            keyword: keyword.value,
            folder: folder.value,
            mediaType: mediaType.value,
            limit: PAGE_SIZE,
            offset: 0,
            search: aiActive.value ? 'ai' : undefined,
          })
      items.value = res.items
      if (similarTo.value || aiActive.value) {
        total.value = res.total ?? res.items.length
        exhausted.value = true
      } else {
        trackExhausted(res.items.length, res.total)
      }
    } catch (e) {
      items.value = []
      error.value = message(e)
    } finally {
      loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (loading.value || loadingMore.value || exhausted.value) return
    if (similarTo.value || aiActive.value) return
    loadingMore.value = true
    try {
      const res = await fetchEagleItems({
        keyword: keyword.value,
        folder: folder.value,
        mediaType: mediaType.value,
        limit: PAGE_SIZE,
        offset: items.value.length,
      })
      const known = new Set(items.value.map((i) => i.id))
      items.value = items.value.concat(res.items.filter((i) => !known.has(i.id)))
      trackExhausted(res.items.length, res.total)
    } catch (e) {
      error.value = message(e)
    } finally {
      loadingMore.value = false
    }
  }

  async function refresh(fresh = false): Promise<void> {
    await refreshStatus(fresh)
    if (!enabled.value) return
    await Promise.all([loadFolders(), reload()])
  }

  async function importItem(item: EagleItem): Promise<void> {
    if (importingIds.value.has(item.id)) return
    importingIds.value = new Set(importingIds.value).add(item.id)
    try {
      const res = await importEagleItem(item.id)
      toast('success', res.existed
        ? t('eagle.import.existed', { name: item.name })
        : t('eagle.import.done', { name: item.name }))
    } catch (e) {
      toast('error', t('eagle.import.failed'), message(e))
    } finally {
      const next = new Set(importingIds.value)
      next.delete(item.id)
      importingIds.value = next
    }
  }

  function viewFull(item: EagleItem): void {
    openLightbox([{ url: eagleFileUrl(item.id), label: item.name }])
  }

  async function findSimilar(item: EagleItem): Promise<void> {
    similarTo.value = item
    await reload()
    if (error.value) {
      toast('error', t('eagle.similar.failed'), error.value)
      similarTo.value = null
    }
  }

  async function clearSimilar(): Promise<void> {
    if (!similarTo.value) return
    similarTo.value = null
    await reload()
  }

  async function flush(): Promise<void> {
    if (flushing.value) return
    flushing.value = true
    try {
      const res = await flushEagle()
      if (res.sent > 0) toast('success', t('eagle.flush.done', { n: res.sent }))
      if (res.failed > 0) toast('error', t('eagle.flush.failed', { n: res.failed }))
      await refreshStatus(true)
    } catch (e) {
      toast('error', t('eagle.flush.failed', { n: '?' }), message(e))
    } finally {
      flushing.value = false
    }
  }

  watchDebounced(keyword, () => {
    similarTo.value = null
    void reload()
  }, { debounce: 300 })
  watch([folder, mediaType, aiMode], () => {
    similarTo.value = null
    void reload()
  })
  watch(isActive, (active) => {
    if (active) void refresh()
  }, { immediate: true })

  return {
    status,
    items,
    folders,
    keyword,
    folder,
    mediaType,
    aiMode,
    aiReady,
    aiActive,
    similarTo,
    total,
    loading,
    loadingMore,
    exhausted,
    flushing,
    error,
    importingIds,
    enabled,
    mode,
    pendingCount,
    refresh,
    reload,
    loadMore,
    importItem,
    viewFull,
    findSimilar,
    clearSimilar,
    flush,
  }
}
