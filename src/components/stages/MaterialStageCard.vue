<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full ctv:p-2 ctv:box-border ctv:text-xs ctv:text-base-foreground"
    @pointerdown.stop
    @mousedown.stop
    @contextmenu.stop.prevent
  >
    <div class="ctv:relative ctv:w-full ctv:h-[200px] ctv:shrink-0 ctv:rounded-lg ctv:overflow-hidden ctv:bg-black">
      <MaterialSphere ref="sphereEl" :params="params" @rendered="scheduleCapture" />
    </div>

    <div class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1">
      <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
        {{ $t('materialStage.presets') }}
      </span>
      <button
        v-for="p in MATERIAL_PRESETS"
        :key="p.key"
        type="button"
        :class="presetChipClass"
        @click="applyPreset(p)"
      >{{ $t(`materialStage.preset.${p.key}`) }}</button>
    </div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span :class="paramLabelClass">{{ $t('materialStage.color') }}</span>
        <input
          type="color"
          class="ctv:h-6 ctv:w-10 ctv:p-0 ctv:cursor-pointer ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-transparent"
          :value="params.color"
          @input="(e) => setColor((e.target as HTMLInputElement).value)"
        />
        <input
          type="text"
          class="ctv-num-input ctv:w-20 ctv:py-0.5 ctv:px-1 ctv:text-[11px] ctv:font-mono ctv:rounded
                 ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
          :value="params.color"
          @change="(e) => setColor((e.target as HTMLInputElement).value)"
        />
      </div>

      <div
        v-for="s in SLIDERS"
        :key="s.key"
        class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]"
      >
        <span :class="paramLabelClass">{{ $t(`materialStage.param.${s.key}`) }}</span>
        <input
          type="range" :min="s.min" :max="s.max" :step="s.step"
          class="ctv:flex-1 ctv:accent-primary-background ctv:cursor-pointer"
          :value="params[s.key]"
          @input="(e) => setParam(s.key, Number((e.target as HTMLInputElement).value))"
        />
        <span class="ctv:w-9 ctv:text-right ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">
          {{ params[s.key].toFixed(2) }}
        </span>
      </div>
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
      hide-output
      hide-actions
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import MaterialSphere from '@/components/widgets/MaterialSphere.vue'
import StageCard from '@/components/stages/StageCard.vue'
import type { StageState } from '@/stores/stageStore'
import {
  CAPTURE_SIZE,
  MATERIAL_SLIDERS as SLIDERS,
  useMaterialStage,
} from '@/composables/stages/useMaterialStage'
import { MATERIAL_PRESETS } from '@/widgets/material/types'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sphereEl = ref<InstanceType<typeof MaterialSphere> | null>(null)

const {
  params,
  setParam,
  setColor,
  applyPreset,
  scheduleCapture,
  teardown,
} = useMaterialStage(props.node, {
  getState: () => props.state,
  captureCanvas: () => sphereEl.value?.captureCanvas(CAPTURE_SIZE, CAPTURE_SIZE) ?? null,
})

onBeforeUnmount(() => {
  teardown()
})

const paramLabelClass = 'ctv:w-20 ctv:shrink-0 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground'

const presetChipClass =
  'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-2 ctv:py-0.5 ' +
  'ctv:text-2xs ctv:text-muted-foreground ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
</script>
