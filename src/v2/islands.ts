import type { Component } from 'vue'

import { registerMount, unregisterMount } from '@/composables/stages/widgetMounts'
import { isLodFar, onLodChange } from '@/v2/lodV2'

let seq = 0

export interface IslandGroup {
  mount(anchor: HTMLElement, comp: Component, props?: Record<string, any>): void
  mountWhenVisible(card: HTMLElement, anchor: HTMLElement, comp: Component, props?: Record<string, any>): void
  unmountAll(): void
}

interface Pending { group: IslandGroup; anchor: HTMLElement; comp: Component; props: Record<string, any> }
const pendingByCard = new Map<HTMLElement, Pending[]>()
const VISIBLE_MARGIN = '256px'
let io: IntersectionObserver | null = null

function observer(): IntersectionObserver {
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) flushCard(e.target as HTMLElement)
  }, { rootMargin: VISIBLE_MARGIN })
  return io
}

function flushCard(card: HTMLElement): void {
  if (isLodFar()) return
  const items = pendingByCard.get(card)
  if (!items) return
  pendingByCard.delete(card)
  io?.unobserve(card)
  for (const it of items) it.group.mount(it.anchor, it.comp, it.props)
}

onLodChange((far) => {
  if (far || !io) return
  for (const card of [...pendingByCard.keys()]) {
    io.unobserve(card)
    io.observe(card)
  }
})

export function createIslandGroup(): IslandGroup {
  const keys: string[] = []
  const cards = new Set<HTMLElement>()
  const group: IslandGroup = {
    mount(anchor, comp, props = {}) {
      const key = `v2-island-${++seq}`
      keys.push(key)
      registerMount(key, anchor, comp, props)
    },
    mountWhenVisible(card, anchor, comp, props = {}) {
      if (typeof IntersectionObserver === 'undefined') { group.mount(anchor, comp, props); return }
      const items = pendingByCard.get(card) ?? []
      items.push({ group, anchor, comp, props })
      pendingByCard.set(card, items)
      cards.add(card)
      observer().observe(card)
    },
    unmountAll() {
      for (const card of cards) {
        const items = pendingByCard.get(card)
        if (!items) continue
        const rest = items.filter(it => it.group !== group)
        if (rest.length) pendingByCard.set(card, rest)
        else { pendingByCard.delete(card); io?.unobserve(card) }
      }
      cards.clear()
      for (const key of keys) unregisterMount(key)
      keys.length = 0
    },
  }
  return group
}
