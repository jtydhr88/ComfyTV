<template>
  <div
    ref="container"
    class="ctv:overflow-y-auto ctv:[overflow-anchor:none]"
  >
    <div :style="{ height: topSpacerHeight }" />
    <div :style="gridStyle">
      <div
        v-for="(item, i) in renderedItems"
        :key="item.key"
        data-virtual-grid-item
      >
        <slot name="item" :item="item" :index="start + i" />
      </div>
    </div>
    <div :style="{ height: bottomSpacerHeight }" />
  </div>
</template>

<script setup lang="ts" generic="T extends { key: string | number }">
import { useDebounceFn, useElementSize, useScroll } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

const props = withDefaults(defineProps<{
  items: T[]
  gridStyle: CSSProperties
  bufferRows?: number
  defaultItemHeight?: number
  defaultItemWidth?: number
}>(), { bufferRows: 2, defaultItemHeight: 240, defaultItemWidth: 160 })

const container = ref<HTMLElement | null>(null)
const itemHeight = ref(props.defaultItemHeight)
const itemWidth = ref(props.defaultItemWidth)
const { width, height } = useElementSize(container)
const { y: scrollY } = useScroll(container, {
  eventListenerOptions: { passive: true },
})

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

const cols = computed(() => Math.floor(width.value / itemWidth.value) || 1)
const viewRows = computed(() => Math.ceil(height.value / itemHeight.value))
const offsetRows = computed(() => Math.floor(scrollY.value / itemHeight.value))
const ready = computed(() =>
  Boolean(height.value && width.value && props.items.length))

const start = computed(() =>
  clamp((offsetRows.value - props.bufferRows) * cols.value, 0, props.items.length))
const end = computed(() => clamp(
  (offsetRows.value + props.bufferRows + viewRows.value) * cols.value,
  start.value, props.items.length))
const renderedItems = computed(() =>
  ready.value ? props.items.slice(start.value, end.value) : [])

function rowsToHeight(count: number): string {
  return `${Math.ceil(count / cols.value) * itemHeight.value}px`
}
const topSpacerHeight = computed(() => rowsToHeight(start.value))
const bottomSpacerHeight = computed(() =>
  rowsToHeight(props.items.length - end.value))

function updateItemSize(): void {
  const first = container.value
    ?.querySelector('[data-virtual-grid-item]') as HTMLElement | null
  if (first?.clientHeight) itemHeight.value = first.clientHeight
  if (first?.clientWidth) itemWidth.value = first.clientWidth
}
const onResize = useDebounceFn(updateItemSize, 64)
watch([width, height], () => { void onResize() }, { flush: 'post' })
watch(() => props.items, updateItemSize, { flush: 'post' })
watch(() => props.gridStyle, updateItemSize, { flush: 'post' })
</script>
