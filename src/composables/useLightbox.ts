import { computed, reactive } from 'vue'

export interface LightboxItem {
  url: string
  label?: string
}

const state = reactive<{ items: LightboxItem[]; index: number }>({
  items: [],
  index: -1,
})

export function openLightbox(items: LightboxItem[], startIndex = 0): void {
  const clean = items.filter((it): it is LightboxItem => !!it && !!it.url)
  if (!clean.length) return
  state.items = clean
  state.index = Math.min(Math.max(startIndex, 0), clean.length - 1)
}

export function useLightbox() {
  const isOpen = computed(
    () => state.index >= 0 && state.index < state.items.length,
  )
  const current = computed<LightboxItem | null>(() =>
    isOpen.value ? state.items[state.index] : null,
  )
  const count = computed(() => state.items.length)
  const hasPrev = computed(() => isOpen.value && state.index > 0)
  const hasNext = computed(
    () => isOpen.value && state.index < state.items.length - 1,
  )

  function close(): void {
    state.index = -1
    state.items = []
  }
  function prev(): void {
    if (hasPrev.value) state.index -= 1
  }
  function next(): void {
    if (hasNext.value) state.index += 1
  }

  return {
    state,
    isOpen,
    current,
    count,
    hasPrev,
    hasNext,
    open: openLightbox,
    close,
    prev,
    next,
    index: computed(() => state.index),
  }
}
