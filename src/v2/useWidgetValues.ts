import { onBeforeUnmount, reactive } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import { observeProperty } from '@/v2/observeProps'

interface WidgetLike {
  name?: string
  value?: unknown
  callback?: (v: unknown) => void
  options?: Record<string, unknown> & { values?: unknown[] }
  type?: string
}

export function useWidgetValues(getNode: () => LGraphNode | undefined, names: string[]) {
  const values = reactive<Record<string, unknown>>({})
  const disposers: Array<() => void> = []

  const widgetOf = (name: string): WidgetLike | undefined =>
    (getNode()?.widgets as WidgetLike[] | undefined)?.find(w => w.name === name)

  for (const name of names) {
    const w = widgetOf(name)
    if (!w) continue
    values[name] = w.value
    try {
      disposers.push(observeProperty(w, 'value', () => { values[name] = w.value }))
    } catch {
      const orig = w.callback
      w.callback = (v: unknown) => {
        orig?.call(w, v)
        values[name] = w.value
      }
    }
  }

  onBeforeUnmount(() => {
    for (const d of disposers) d()
    disposers.length = 0
  })

  function write(name: string, v: unknown) {
    const w = widgetOf(name)
    if (!w) return
    w.value = v
    w.callback?.(v)
  }

  return { values, widgetOf, write }
}
