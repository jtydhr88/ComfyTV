import { reactive, markRaw } from 'vue'
import type { Component } from 'vue'

export interface WidgetMount {
  key: string
  container: HTMLElement
  component: Component
  props: Record<string, any>
}

export const mounts = reactive<WidgetMount[]>([])

export function registerMount(
  key: string,
  container: HTMLElement,
  component: Component,
  props: Record<string, any>,
): void {
  mounts.push({
    key,
    container: markRaw(container),
    component: markRaw(component),
    props: markRaw(props),
  })
}

export function unregisterMount(key: string): void {
  const idx = mounts.findIndex((m) => m.key === key)
  if (idx >= 0) mounts.splice(idx, 1)
}
