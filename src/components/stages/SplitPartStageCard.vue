<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <PartAnnotationCanvas
      :source-image-url="sourceImageUrl"
      :parts="parts"
      :active-part-id="activePartId"
      :tool="tool"
      @add-point="onAddPoint"
      @add-box="onAddBox"
    />

    <div
      class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1"
      @pointerdown.stop
      @mousedown.stop
    >
      <button
        v-for="t in TOOLS"
        :key="t.id"
        type="button"
        :class="toolBtnClass(tool === t.id)"
        :title="$t(`splitPart.tool.${t.id}`)"
        @click="tool = t.id"
      ><i :class="['pi', t.icon]" /> {{ $t(`splitPart.tool.${t.id}`) }}</button>

      <span class="ctv:mx-1 ctv:h-4 ctv:border-l ctv:border-border-subtle" />

      <button type="button" :class="toolBtnClass(false)" @click="startNewGroup">
        <i class="pi pi-plus" /> {{ $t('splitPart.newGroup') }}
      </button>
      <button
        v-if="parts.length"
        type="button"
        :class="toolBtnClass(false)"
        @click="clearParts"
      ><i class="pi pi-trash" /> {{ $t('splitPart.clear') }}</button>
    </div>

    <div
      v-if="parts.length"
      class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1"
      @pointerdown.stop
      @mousedown.stop
    >
      <button
        v-for="p in parts"
        :key="p.id"
        type="button"
        class="ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]
               ctv:rounded-lg ctv:border ctv:px-1.5 ctv:py-0.5 ctv:text-2xs ctv:transition-colors"
        :style="{
          borderColor: partColor(p.id),
          background: p.id === activePartId ? `${partColor(p.id)}33` : 'transparent',
          color: 'var(--base-foreground, #ddd)',
        }"
        @click="activePartId = p.id"
      >
        <span class="ctv:size-2 ctv:rounded-full" :style="{ background: partColor(p.id) }" />
        {{ p.kind === 'box' ? $t('splitPart.chipBox', { n: p.id }) : $t('splitPart.chipPoints', { n: p.id, count: p.points.length }) }}
        <span
          class="ctv:ml-0.5 ctv:text-muted-foreground ctv:hover:text-destructive-background"
          @click.stop="removePart(p.id)"
        ><i class="pi pi-times" /></span>
      </button>
    </div>

    <div class="ctv:text-2xs ctv:text-muted-foreground ctv:px-0.5">
      {{ $t('splitPart.hint') }}
    </div>

    <StageCard
      class="ctv:h-auto! ctv:shrink-0"
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import PartAnnotationCanvas from '@/components/widgets/PartAnnotationCanvas.vue'
import StageCard from '@/components/stages/StageCard.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import type { StageState } from '@/stores/stageStore'
import { onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import {
  nextPartId,
  parsePartsData,
  partColor,
  serializePartsData,
  type Part,
  type PartBox,
} from '@/widgets/splitpart/types'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const TOOLS = [
  { id: 'point-pos', icon: 'pi-plus-circle' },
  { id: 'point-neg', icon: 'pi-minus-circle' },
  { id: 'box', icon: 'pi-stop' },
] as const

const sourceImageUrl = computed(() => pickSourceImageUrl(props.state.inputs))

const tool = ref<string>('point-pos')
const parts = ref<Part[]>(parsePartsData(readWidgetStr(props.node, 'parts_data', '')))
const activePartId = ref<number | null>(null)

function onAddPoint(p: { x: number; y: number; label: 0 | 1 }): void {
  const active = parts.value.find((q) => q.id === activePartId.value)
  if (active && active.kind === 'points') {
    active.points = [...active.points, p]
    parts.value = [...parts.value]
    return
  }
  const id = nextPartId(parts.value)
  parts.value = [...parts.value, { id, kind: 'points', points: [p] }]
  activePartId.value = id
}

function onAddBox(box: PartBox): void {
  const id = nextPartId(parts.value)
  parts.value = [...parts.value, { id, kind: 'box', box }]
  activePartId.value = id
}

function startNewGroup(): void {
  activePartId.value = null
  if (tool.value === 'box') tool.value = 'point-pos'
}

function removePart(id: number): void {
  parts.value = parts.value.filter((p) => p.id !== id)
  if (activePartId.value === id) activePartId.value = null
}

function clearParts(): void {
  parts.value = []
  activePartId.value = null
}

watch(parts, (v) => {
  writeWidget(props.node, 'parts_data', serializePartsData(v))
}, { deep: true })

onNodeConfigure(props.node, () => {
  parts.value = parsePartsData(readWidgetStr(props.node, 'parts_data', ''))
  activePartId.value = null
})

function toolBtnClass(selected: boolean): string {
  return 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]'
    + ' ctv:rounded-lg ctv:border ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:transition-colors'
    + (selected
      ? ' ctv:border-primary-background ctv:bg-primary-background/20 ctv:text-base-foreground'
      : ' ctv:border-border-subtle ctv:bg-secondary-background ctv:text-muted-foreground'
        + ' ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground')
}
</script>
