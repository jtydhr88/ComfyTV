import { useRafFn } from '@vueuse/core'
import { effectScope } from 'vue'

export type MeasureReader = () => (() => void) | null

const queue = new Map<object, MeasureReader>()
const scope = effectScope(true)
const raf = scope.run(() => useRafFn(() => {
  const readers = [...queue.values()]
  queue.clear()
  const writes: Array<() => void> = []
  for (const read of readers) {
    try {
      const w = read()
      if (w) writes.push(w)
    } catch { }
  }
  for (const w of writes) {
    try { w() } catch { }
  }
  if (!queue.size) raf.pause()
}, { immediate: false }))!

export function scheduleMeasure(key: object, read: MeasureReader): void {
  queue.set(key, read)
  if (!raf.isActive.value) raf.resume()
}

export function cancelMeasure(key: object): void {
  queue.delete(key)
}
