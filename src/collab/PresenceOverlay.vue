<template>
  <div
    v-if="overlayActive"
    class="ctv:fixed ctv:z-[9998] ctv:pointer-events-none ctv:overflow-hidden"
    :style="layerStyle"
  >
    <div
      v-for="box in selectionBoxes"
      :key="box.key"
      class="ctv:absolute ctv:rounded ctv:border-2 ctv:opacity-70"
      :style="{
        left: `${box.x}px`, top: `${box.y}px`,
        width: `${box.w}px`, height: `${box.h}px`,
        borderColor: box.color, borderStyle: 'dashed',
      }"
    />
    <div
      v-for="box in execBoxes"
      :key="box.key"
      class="ctv:absolute ctv:rounded ctv:border-2 ctv:animate-pulse"
      :style="{
        left: `${box.x}px`, top: `${box.y}px`,
        width: `${box.w}px`, height: `${box.h}px`,
        borderColor: box.color,
        boxShadow: `0 0 12px ${box.color}`,
      }"
    >
      <span
        class="ctv:absolute ctv:-top-5 ctv:left-0 ctv:py-px ctv:px-1.5 ctv:rounded ctv:text-[10px]
               ctv:font-medium ctv:whitespace-nowrap ctv:text-black/80"
        :style="{ background: box.color }"
      >⚡ {{ box.label }}</span>
    </div>
    <div
      v-for="arrow in edgeArrows"
      :key="arrow.key"
      class="ctv:absolute ctv:flex ctv:items-center ctv:gap-1"
      :style="{ left: `${arrow.x}px`, top: `${arrow.y}px`, transform: 'translate(-50%, -50%)' }"
    >
      <svg
        width="18" height="18" viewBox="0 0 18 18"
        :style="{ transform: `rotate(${arrow.angle}rad)` }"
      >
        <circle cx="9" cy="9" r="8" :fill="arrow.color" opacity="0.9" />
        <path d="M6 5 L13 9 L6 13 Z" fill="white" />
      </svg>
      <span
        class="ctv:py-px ctv:px-1.5 ctv:rounded ctv:text-[10px] ctv:font-medium ctv:whitespace-nowrap ctv:text-black/80"
        :style="{ background: arrow.color }"
      >{{ arrow.name }}</span>
    </div>
    <div
      v-for="p in cursorPeers"
      :key="p.connId"
      class="ctv:absolute ctv:flex ctv:flex-col ctv:items-start"
      :class="{ 'ctv:opacity-50': p.idle !== 'active' }"
      :style="cursorStyle(p)"
    >
      <svg width="14" height="18" viewBox="0 0 14 18">
        <path d="M0 0 L14 10 L7.5 11 L4.5 18 Z" :fill="p.color" stroke="white" stroke-width="1" />
      </svg>
      <span
        class="ctv:mt-0.5 ctv:ml-2 ctv:py-px ctv:px-1.5 ctv:rounded ctv:text-[10px] ctv:font-medium ctv:whitespace-nowrap ctv:text-black/80"
        :style="{ background: p.color }"
      >{{ p.name }}</span>
    </div>
  </div>

</template>

<script setup lang="ts">
import { useRafFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { usePresenceStore } from '@/collab/presenceStore'
import type { CollabPeer } from '@/collab/presenceStore'
import { useProjectStore } from '@/stores/projectStore'
import { app } from '@/lib/comfyApp'

interface SelectionBox { key: string; x: number; y: number; w: number; h: number; color: string }
interface ExecBox extends SelectionBox { label: string }
interface EdgeArrow { key: string; x: number; y: number; angle: number; color: string; name: string }

const ARROW_MARGIN = 24

const store = usePresenceStore()
const projectStore = useProjectStore()

const layer = ref({ left: 0, top: 0, width: 0, height: 0 })
const view = ref({ ox: 0, oy: 0, scale: 1 })
const selectionBoxes = ref<SelectionBox[]>([])
const execBoxes = ref<ExecBox[]>([])
const edgeArrows = ref<EdgeArrow[]>([])


const visiblePeers = computed(() =>
  store.peerList.filter((p) => p.projectId === projectStore.currentProjectId && p.idle !== 'away'))
const cursorPeers = computed(() => visiblePeers.value.filter((p) => p.cursor))
const overlayActive = computed(() =>
  visiblePeers.value.length > 0 || Object.keys(store.remoteExec).length > 0)

const layerStyle = computed(() => ({
  left: `${layer.value.left}px`,
  top: `${layer.value.top}px`,
  width: `${layer.value.width}px`,
  height: `${layer.value.height}px`,
}))

function toScreen(x: number, y: number): { x: number; y: number } {
  const { ox, oy, scale } = view.value
  return { x: (x + ox) * scale, y: (y + oy) * scale }
}

function cursorStyle(p: CollabPeer) {
  const pos = toScreen(p.cursor!.x, p.cursor!.y)
  return { left: `${pos.x}px`, top: `${pos.y}px` }
}

function nodeBounds(node: any): { x: number; y: number; w: number; h: number } {
  const b = node.getBounding?.()
  if (b) return { x: b[0], y: b[1], w: b[2], h: b[3] }
  return { x: node.pos?.[0] ?? 0, y: node.pos?.[1] ?? 0, w: node.size?.[0] ?? 0, h: node.size?.[1] ?? 0 }
}

const { pause, resume } = useRafFn(() => {
  const a = app as any
  const canvasEl = a?.canvas?.canvas as HTMLCanvasElement | undefined
  const ds = a?.canvas?.ds
  if (!canvasEl || !ds?.offset) return
  const rect = canvasEl.getBoundingClientRect()
  layer.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  view.value = { ox: ds.offset[0], oy: ds.offset[1], scale: ds.scale ?? 1 }

  const boxes: SelectionBox[] = []
  for (const p of visiblePeers.value) {
    for (const id of p.selected) {
      const node = a.graph?.getNodeById?.(/^\d+$/.test(id) ? Number(id) : id)
      if (!node) continue
      const b = nodeBounds(node)
      const tl = toScreen(b.x, b.y)
      boxes.push({
        key: `${p.connId}:${id}`,
        x: tl.x, y: tl.y,
        w: b.w * view.value.scale, h: b.h * view.value.scale,
        color: p.color,
      })
    }
  }
  selectionBoxes.value = boxes

  const arrows: EdgeArrow[] = []
  for (const p of cursorPeers.value) {
    const pos = toScreen(p.cursor!.x, p.cursor!.y)
    const w = rect.width
    const h = rect.height
    if (pos.x >= 0 && pos.x <= w && pos.y >= 0 && pos.y <= h) continue
    const ax = Math.min(Math.max(pos.x, ARROW_MARGIN), w - ARROW_MARGIN)
    const ay = Math.min(Math.max(pos.y, ARROW_MARGIN), h - ARROW_MARGIN)
    arrows.push({
      key: `arrow:${p.connId}`,
      x: ax, y: ay,
      angle: Math.atan2(pos.y - ay, pos.x - ax),
      color: p.color,
      name: p.name,
    })
  }
  edgeArrows.value = arrows

  const exec: ExecBox[] = []
  for (const [connId, run] of Object.entries(store.remoteExec)) {
    const peer = store.peers[connId]
    const node = a.graph?.getNodeById?.(/^\d+$/.test(run.node) ? Number(run.node) : run.node)
    if (!node) continue
    const b = nodeBounds(node)
    const tl = toScreen(b.x, b.y)
    const pct = run.max > 0 ? ` ${Math.round((run.value / run.max) * 100)}%` : ''
    exec.push({
      key: `exec:${connId}`,
      x: tl.x, y: tl.y,
      w: b.w * view.value.scale, h: b.h * view.value.scale,
      color: peer?.color ?? '#fff',
      label: `${peer?.name ?? '?'}${pct}`,
    })
  }
  execBoxes.value = exec
}, { immediate: false })

watch(overlayActive, (active) => {
  if (active) resume()
  else { pause(); selectionBoxes.value = []; execBoxes.value = []; edgeArrows.value = [] }
}, { immediate: true })
</script>
