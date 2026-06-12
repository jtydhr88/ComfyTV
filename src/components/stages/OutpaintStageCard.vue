<template>
  <div ref="rootEl" class="flex flex-col gap-1.5 size-full">
    <div
      ref="canvasEl"
      class="relative flex-auto min-h-[280px] bg-black rounded-md overflow-hidden select-none
             border border-border-subtle"
      :class="{ 'flex items-center justify-center': !sourceImageUrl }"
    >
      <template v-if="!sourceImageUrl">
        <div class="flex flex-col items-center gap-1.5 text-white/50">
          <div class="text-[28px] opacity-60">↔</div>
          <div class="text-xs">{{ $t('outpaint.noInputImage') }}</div>
        </div>
      </template>
      <template v-else>
        <div class="absolute ctv-pad-area" :style="padAreaStyle" />
        <img
          :src="sourceImageUrl"
          class="absolute pointer-events-none outline outline-1 outline-white/70"
          :style="imgStyle"
          draggable="false"
          @load="onSourceLoaded"
          @dragstart.prevent
        />
        <div
          v-for="side in SIDES"
          :key="side"
          class="absolute flex items-center justify-center z-[3] ctv-outpaint-handle"
          :class="[
            `ctv-handle-${side}`,
            side === 'left' || side === 'right' ? 'cursor-ew-resize' : 'cursor-ns-resize',
          ]"
          :style="handleStyle(side)"
          @pointerdown="onHandlePointerDown($event, side)"
        >
          <span class="absolute size-3 rounded-full bg-primary-background border-2 border-white
                       shadow-[0_1px_4px_rgb(0_0_0/0.5)]" />
        </div>
        <span
          v-for="side in SIDES"
          :key="`v-${side}`"
          class="absolute z-[2] pointer-events-none py-px px-[5px] rounded-sm
                 text-2xs font-mono bg-black/60 text-white/90"
          :style="badgeStyle(side)"
        >{{ pad[side] }}px</span>
      </template>
    </div>

    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-1.5 flex-wrap">
        <label v-for="side in SIDES" :key="`in-${side}`"
               class="flex items-center gap-[3px] py-0.5 px-1 rounded-sm
                      bg-secondary-background border border-border-subtle">
          <span class="text-3xs min-w-8 uppercase tracking-wide text-muted-foreground">{{ $t(`outpaint.${side}`) }}</span>
          <input
            type="number" min="0" max="4096" step="8"
            class="w-12 py-px px-[3px] rounded-sm text-[11px] font-mono
                   bg-secondary-background text-base-foreground border border-border-subtle
                   disabled:opacity-40"
            :value="pad[side]"
            :disabled="!sourceImageUrl"
            @change="(e) => setPad(side, Number((e.target as HTMLInputElement).value))"
          />
        </label>
        <button
          type="button"
          class="ml-auto py-0.5 px-2.5 text-[11px] rounded-sm cursor-pointer
                 bg-secondary-background text-base-foreground border border-border-subtle
                 hover:enabled:bg-secondary-background-hover disabled:opacity-40 disabled:cursor-default"
          :disabled="!sourceImageUrl"
          @click="resetAll"
        >{{ $t('outpaint.reset') }}</button>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-2xs text-muted-foreground/60">{{ $t('outpaint.output') }}:</span>
        <span class="text-[11px] font-mono text-base-foreground">{{ outDims }}</span>
      </div>
    </div>

    <StageCard
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
import { ref } from 'vue'

import StageCard from '@/components/stages/StageCard.vue'
import { SIDES, useOutpaintCanvas } from '@/composables/stages/useOutpaintCanvas'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const rootEl   = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLDivElement | null>(null)

const {
  sourceImageUrl,
  pad, setPad, resetAll,
  onSourceLoaded,
  padAreaStyle, imgStyle, handleStyle, badgeStyle,
  outDims,
  onHandlePointerDown,
} = useOutpaintCanvas(props.node, props.state, canvasEl, rootEl)
</script>

<style scoped>
.ctv-pad-area {
  background-image:
    linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%),
    linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%);
  background-size: 12px 12px;
  background-position: 0 0, 6px 6px;
  border: 1px dashed color-mix(in srgb, var(--primary-background, #4ea8ff) 45%, transparent);
}
.ctv-outpaint-handle::before {
  content: '';
  position: absolute;
  background: color-mix(in srgb, var(--primary-background, #4ea8ff) 65%, transparent);
  border-radius: 2px;
}
.ctv-handle-left::before,  .ctv-handle-right::before  { width: 3px; height: 100%; }
.ctv-handle-top::before,   .ctv-handle-bottom::before { height: 3px; width: 100%; }
.ctv-outpaint-handle:hover::before { background: var(--primary-background, #4ea8ff); }
</style>
