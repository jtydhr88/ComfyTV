import { onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'
import { proxyEnsure } from '@/api'
import { app } from '@/lib/comfyApp'

const POLL_MS = 2500
const PROXY_NODE_CLASS = 'ComfyTV.MakeProxyStage'

const readyCache = new Map<string, string>()
const originalCache = new Set<string>()
const candidateCache = new Set<string>()
const requestedUrls = reactive(new Set<string>())
const autoChecked = new Set<string>()
const ensureInFlight = new Map<string, Promise<Awaited<ReturnType<typeof proxyEnsure>>>>()
let promptSeq = 0

export function clearProxyCaches(): void {
  readyCache.clear()
  originalCache.clear()
  candidateCache.clear()
  requestedUrls.clear()
  autoChecked.clear()
  ensureInFlight.clear()
}

function ensureDeduped(url: string): Promise<Awaited<ReturnType<typeof proxyEnsure>>> {
  let p = ensureInFlight.get(url)
  if (!p) {
    p = proxyEnsure(url).finally(() => { ensureInFlight.delete(url) })
    ensureInFlight.set(url, p)
  }
  return p
}

async function queueProxyPrompt(url: string): Promise<void> {
  const queue = (app as any)?.api?.queuePrompt
  if (typeof queue !== 'function') return
  const id = `ctvproxy${++promptSeq}`
  await queue.call((app as any).api, 0, {
    output: { [id]: { class_type: PROXY_NODE_CLASS, inputs: { video: url } } },
    workflow: { nodes: [] },
    __comfytvOwnRun: true,
  })
}

export async function requestProxyBuild(
  url: string,
  retry = false,
): Promise<void> {
  try {
    await proxyEnsure(url, { create: true, retry })
    if (!requestedUrls.has(url)) await queueProxyPrompt(url)
  } catch {
    return
  }
  candidateCache.delete(url)
  requestedUrls.add(url)
}

export async function autoProxyOutput(url: string): Promise<void> {
  if (!url || !url.includes('/view')) return
  if (autoChecked.has(url) || requestedUrls.has(url)
      || readyCache.has(url) || originalCache.has(url)) return
  autoChecked.add(url)
  let res
  try {
    res = await ensureDeduped(url)
  } catch {
    return
  }
  if (res.status === 'candidate') await requestProxyBuild(url)
}

const autoBuildInFlight = new Set<string>()

export function useProxiedVideoUrl(
  source: Ref<string | null>,
  opts: { autoBuild?: boolean } = {},
) {
  const autoBuild = opts.autoBuild === true
  const url = ref<string | null>(source.value)
  const isProxy = ref(false)
  const canProxy = ref(false)
  const building = ref(false)
  const pct = ref(0)
  let timer: ReturnType<typeof setTimeout> | null = null
  let generation = 0

  function stop(): void {
    if (timer != null) clearTimeout(timer)
    timer = null
  }

  async function tick(src: string, gen: number): Promise<void> {
    let res
    try {
      res = await ensureDeduped(src)
    } catch {
      building.value = false
      return
    }
    if (gen !== generation || source.value !== src) return
    if (res.status === 'ready' && res.proxy_url) {
      readyCache.set(src, res.proxy_url)
      url.value = res.proxy_url
      isProxy.value = true
      canProxy.value = false
      building.value = false
    } else if (res.status === 'original') {
      originalCache.add(src)
      building.value = false
    } else if (res.status === 'candidate') {
      candidateCache.add(src)
      if (autoBuild) {
        canProxy.value = false
        building.value = true
        pct.value = 0
        if (!requestedUrls.has(src) && !autoBuildInFlight.has(src)) {
          autoBuildInFlight.add(src)
          try {
            await requestProxyBuild(src)
          } finally {
            autoBuildInFlight.delete(src)
          }
          if (gen !== generation || source.value !== src) return
        }
        timer = setTimeout(() => { void tick(src, gen) }, POLL_MS)
      } else {
        canProxy.value = true
        building.value = false
      }
    } else if (res.status === 'pending' || res.status === 'running') {
      building.value = true
      pct.value = res.pct ?? 0
      timer = setTimeout(() => { void tick(src, gen) }, POLL_MS)
    } else {
      building.value = false
      canProxy.value = true
    }
  }

  async function requestProxy(): Promise<void> {
    const src = source.value
    if (!src || isProxy.value || building.value) return
    canProxy.value = false
    building.value = true
    pct.value = 0
    await requestProxyBuild(src, true)
    if (source.value !== src) return
    void tick(src, generation)
  }

  watch(source, (src) => {
    generation++
    stop()
    isProxy.value = false
    canProxy.value = false
    building.value = false
    pct.value = 0
    url.value = src
    if (!src || !src.includes('/view')) return
    const cached = readyCache.get(src)
    if (cached) {
      url.value = cached
      isProxy.value = true
      return
    }
    if (originalCache.has(src)) return
    if (candidateCache.has(src) && !requestedUrls.has(src) && !autoBuild) {
      canProxy.value = true
      return
    }
    void tick(src, generation)
  }, { immediate: true })

  watch(() => source.value != null && requestedUrls.has(source.value), (req) => {
    const src = source.value
    if (!req || !src || isProxy.value || building.value || timer != null) return
    canProxy.value = false
    building.value = true
    void tick(src, generation)
  })

  onBeforeUnmount(() => {
    generation++
    stop()
  })

  return { url, isProxy, canProxy, building, pct, requestProxy }
}
