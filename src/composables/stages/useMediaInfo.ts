import { shallowRef, toValue, watch, type MaybeRefOrGetter, type ShallowRef } from 'vue'

import { fetchMediaInfo } from '@/api'
import type { MediaInfo } from '@/api/schemas'

const CACHE_MAX = 400
const cache = new Map<string, MediaInfo | null>()
const inflight = new Map<string, Promise<MediaInfo | null>>()

export function loadMediaInfo(url: string): Promise<MediaInfo | null> {
  const hit = cache.get(url)
  if (hit !== undefined) return Promise.resolve(hit)
  let p = inflight.get(url)
  if (!p) {
    p = fetchMediaInfo(url)
      .catch(() => null)
      .then((info) => {
        inflight.delete(url)
        cache.set(url, info)
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
        return info
      })
    inflight.set(url, p)
  }
  return p
}

export function resetMediaInfoCache() {
  cache.clear()
  inflight.clear()
}

export function useMediaInfo(url: MaybeRefOrGetter<string | null | undefined>): ShallowRef<MediaInfo | null> {
  const info = shallowRef<MediaInfo | null>(null)
  watch(
    () => String(toValue(url) ?? ''),
    (key) => {
      if (!key) { info.value = null; return }
      const hit = cache.get(key)
      info.value = hit ?? null
      if (hit !== undefined) return
      void loadMediaInfo(key).then((res) => {
        if (String(toValue(url) ?? '') === key) info.value = res
      })
    },
    { immediate: true },
  )
  return info
}
