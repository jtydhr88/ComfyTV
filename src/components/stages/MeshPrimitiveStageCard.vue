<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full ctv:p-2 ctv:box-border ctv:text-xs ctv:text-base-foreground"
    @contextmenu.stop.prevent
  >
    <div class="ctv:flex ctv:flex-wrap ctv:gap-1" @pointerdown.stop @mousedown.stop>
      <button
        v-for="k in PRIM_KINDS"
        :key="k"
        type="button"
        :class="kindBtnClass(k === kind)"
        @click="setKind(k)"
      >
        {{ $t('meshPrimitive.kind.' + k) }}
      </button>
    </div>

    <div class="ctv:relative ctv:w-full ctv:flex-1 ctv:min-h-[240px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black">
      <PrimitivePreview ref="previewEl" :kind="kind" :params="params" @view-changed="scheduleCapture" />
    </div>

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @mousedown.stop>
      <div v-for="def in controls" :key="def.key" class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span
          class="ctv:w-24 ctv:shrink-0 ctv:truncate ctv:text-2xs ctv:text-muted-foreground"
          :title="$t(def.labelKey)"
        >{{ $t(def.labelKey) }}</span>
        <template v-if="def.type === 'bool'">
          <input
            type="checkbox"
            class="ctv:cursor-pointer"
            :checked="Boolean(params[def.key])"
            @change="setParam(def, ($event.target as HTMLInputElement).checked)"
          />
        </template>
        <template v-else>
          <input
            type="range"
            class="ctv:flex-1 ctv:cursor-pointer"
            :min="def.min"
            :max="def.max"
            :step="def.step"
            :value="Number(params[def.key])"
            @input="setParam(def, Number(($event.target as HTMLInputElement).value))"
          />
          <span class="ctv:w-10 ctv:shrink-0 ctv:text-right ctv:text-2xs ctv:tabular-nums">
            {{ fmt(params[def.key]) }}
          </span>
        </template>
      </div>
    </div>

    <div class="ctv:shrink-0">
      <StageCard
        :state="state"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-context
        hide-output
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import StageCard from '@/components/stages/StageCard.vue'
import PrimitivePreview from '@/components/stages/PrimitivePreview.vue'
import type { StageState } from '@/stores/stageStore'
import {
  PRIM_KINDS,
  PRIM_PARAMS,
  useMeshPrimitive,
  type ParamDef,
} from '@/composables/stages/useMeshPrimitive'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string, context?: { imageUrl?: string }) => void
  node: LGraphNode
}>()

const previewEl = ref<InstanceType<typeof PrimitivePreview> | null>(null)

const { kind, params, setKind, setParam, scheduleCapture, cancelCapture } = useMeshPrimitive(props.node, {
  captureCanvas: () => previewEl.value?.captureCanvas(1024, 1024) ?? null,
})

const controls = computed<ParamDef[]>(() => PRIM_PARAMS[kind.value])

function kindBtnClass(active: boolean): string {
  return 'ctv:cursor-pointer ctv:rounded ctv:border ctv:px-2 ctv:py-1 ctv:text-2xs ctv:[font-family:inherit] ctv:transition-colors '
    + (active
      ? 'ctv:border-primary-background ctv:bg-primary-background/20 ctv:text-base-foreground'
      : 'ctv:border-border-subtle ctv:bg-secondary-background ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover')
}

function fmt(v: number | boolean): string {
  const n = Number(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

onMounted(() => scheduleCapture())
onBeforeUnmount(() => cancelCapture())
</script>
