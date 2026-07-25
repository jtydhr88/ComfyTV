import { ref, watch, type Ref } from 'vue'
import { midiEnsure } from '@/api'

const readyCache = new Map<string, string>()

export function clearMidiRenderCache(): void {
  readyCache.clear()
}

export function isMidiUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return /\.midi?([?&#]|$)/i.test(url)
    || /filename=[^&]*\.midi?([&#]|$)/i.test(url)
}

export function useMidiRenderedUrl(source: Ref<string | null>) {
  const url = ref<string | null>(source.value)
  const rendering = ref(false)
  let generation = 0

  watch(source, (src) => {
    generation++
    rendering.value = false
    if (!src || !isMidiUrl(src)) {
      url.value = src
      return
    }
    const cached = readyCache.get(src)
    if (cached) {
      url.value = cached
      return
    }
    url.value = null
    rendering.value = true
    const gen = generation
    void midiEnsure(src)
      .then((res) => {
        if (gen !== generation || source.value !== src) return
        rendering.value = false
        if (res.status === 'ready' && res.url) {
          readyCache.set(src, res.url)
          url.value = res.url
        } else {
          url.value = src
        }
      })
      .catch(() => {
        if (gen !== generation || source.value !== src) return
        rendering.value = false
        url.value = src
      })
  }, { immediate: true })

  return { url, rendering }
}
