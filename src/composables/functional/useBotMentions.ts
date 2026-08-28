import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { useAssetStore } from '@/stores/assetStore'
import {
  type BotRef,
  listCanvasStages,
  refKey,
} from '@/utils/botRefs'

const MENTION_TAIL = /(^|\s)@([\w-]*)$/
const MAX_MATCHES = 12

export function useBotMentions(draft: Ref<string>) {
  const refs = ref<BotRef[]>([])
  const stages = ref<BotRef[]>([])
  const assetStore = useAssetStore()

  const tail = computed(() => MENTION_TAIL.exec(draft.value))
  const open = computed(() => tail.value !== null)
  const query = computed(() => (tail.value?.[2] ?? '').toLowerCase())

  const matches = computed<BotRef[]>(() => {
    if (!open.value) return []
    const taken = new Set(refs.value.map(refKey))
    const q = query.value
    const stageHits = stages.value.filter(s =>
      !taken.has(refKey(s))
      && (!q || (s.title ?? '').toLowerCase().includes(q)
          || (s.stage_class ?? '').toLowerCase().includes(q)))
    const assetHits = assetStore.assets
      .filter(a => ['image', 'video', 'audio'].includes(a.media_type))
      .map<BotRef>(a => ({
        kind: 'asset',
        asset_id: a.id,
        name: a.name || `#${a.id}`,
        media_type: a.media_type,
      }))
      .filter(a =>
        !taken.has(refKey(a))
        && (!q || (a.name ?? '').toLowerCase().includes(q)))
    return [...stageHits, ...assetHits].slice(0, MAX_MATCHES)
  })

  watch(open, (isOpen) => {
    if (!isOpen) return
    stages.value = listCanvasStages()
    assetStore.ensureHydrated()
  }, { immediate: true })

  function addRef(item: BotRef): void {
    if (refs.value.some(r => refKey(r) === refKey(item))) return
    refs.value = [...refs.value, item]
  }

  function pick(item: BotRef): void {
    addRef(item)
    draft.value = draft.value.replace(MENTION_TAIL, '$1')
  }

  function pickFirst(): boolean {
    if (!open.value || matches.value.length === 0) return false
    pick(matches.value[0]!)
    return true
  }

  function removeRef(key: string): void {
    refs.value = refs.value.filter(r => refKey(r) !== key)
  }

  function clear(): void {
    refs.value = []
  }

  return { refs, open, query, matches, pick, pickFirst, addRef, removeRef, clear }
}
