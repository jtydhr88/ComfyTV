import { useTimeoutFn } from '@vueuse/core'
import { effectScope, shallowRef, toValue, watch, type MaybeRefOrGetter, type ShallowRef } from 'vue'

import { ApiError, fetchMediaInfo, fetchMediaInfoBatch } from '@/api'
import type { MediaInfo } from '@/api/schemas'

const CACHE_MAX = 400
const BATCH_MS = 20
const BATCH_MAX = 100
const cache = new Map<string, MediaInfo | null>()
const inflight = new Map<string, Promise<MediaInfo | null>>()
const pending = new Map<string, (info: MediaInfo | null) => void>()
const scope = effectScope(true)
const flushTimer = scope.run(() => useTimeoutFn(() => { void flush() }, BATCH_MS, { immediate: false }))!

function remember(url: string, info: MediaInfo | null): void {
  cache.set(url, info)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
}

async function flush(): Promise<void> {
  const batch = [...pending.entries()]
  pending.clear()
  for (let i = 0; i < batch.length; i += BATCH_MAX) {
    const chunk = batch.slice(i, i + BATCH_MAX)
    let infos: Record<string, MediaInfo | null> = {}
    try {
      infos = await fetchMediaInfoBatch(chunk.map(([u]) => u))
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        await Promise.all(chunk.map(async ([u]) => {
          infos[u] = await fetchMediaInfo(u).catch(() => null)
        }))
      }
    }
    for (const [url, resolve] of chunk) {
      const info = infos[url] ?? null
      inflight.delete(url)
      remember(url, info)
      resolve(info)
    }
  }
}

export function loadMediaInfo(url: string): Promise<MediaInfo | null> {
  const hit = cache.get(url)
  if (hit !== undefined) return Promise.resolve(hit)
  let p = inflight.get(url)
  if (!p) {
    p = new Promise<MediaInfo | null>((resolve) => { pending.set(url, resolve) })
    inflight.set(url, p)
    if (!flushTimer.isPending.value) flushTimer.start()
  }
  return p
}

export function resetMediaInfoCache() {
  cache.clear()
  inflight.clear()
  pending.clear()
  flushTimer.stop()
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
