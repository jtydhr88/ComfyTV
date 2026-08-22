import type { Component } from 'vue'

import { registerMount, unregisterMount } from '@/composables/stages/widgetMounts'

let seq = 0

export interface IslandGroup {
  mount(anchor: HTMLElement, comp: Component, props?: Record<string, any>): void
  unmountAll(): void
}

export function createIslandGroup(): IslandGroup {
  const keys: string[] = []
  return {
    mount(anchor, comp, props = {}) {
      const key = `v2-island-${++seq}`
      keys.push(key)
      registerMount(key, anchor, comp, props)
    },
    unmountAll() {
      for (const key of keys) unregisterMount(key)
      keys.length = 0
    },
  }
}
