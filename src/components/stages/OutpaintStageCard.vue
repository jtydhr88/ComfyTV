<template>
  <div ref="rootEl" class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div
      ref="canvasEl"
      class="ctv:relative ctv:flex-auto ctv:min-h-[280px] ctv:bg-black ctv:rounded-md ctv:overflow-hidden ctv:select-none
             ctv:border ctv:border-border-subtle"
      :class="{ 'ctv:flex ctv:items-center ctv:justify-center': !sourceImageUrl }"
    >
      <template v-if="!sourceImageUrl">
        <div class="ctv:flex ctv:flex-col ctv:items-center ctv:gap-1.5 ctv:text-white/50">
          <div class="ctv:text-[28px] ctv:opacity-60">↔</div>
          <div class="ctv:text-xs">{{ $t('outpaint.noInputImage') }}</div>
        </div>
      </template>
      <template v-else>
        <div class="ctv:absolute ctv-pad-area" :style="padAreaStyle" />
        <img
          :src="sourceImageUrl"
          class="ctv:absolute ctv:pointer-events-none ctv:outline ctv:outline-1 ctv:outline-white/70"
          :style="imgStyle"
          draggable="false"
          @load="onSourceLoaded"
          @dragstart.prevent
        />
        <div
          v-for="side in SIDES"
          :key="side"
          class="ctv:absolute ctv:flex ctv:items-center ctv:justify-center ctv:z-[3] ctv-outpaint-handle"
          :class="[
            `ctv-handle-${side}`,
            side === 'left' || side === 'right' ? 'ctv:cursor-ew-resize' : 'ctv:cursor-ns-resize',
          ]"
          :style="handleStyle(side)"
          @pointerdown="onHandlePointerDown($event, side)"
        >
          <span class="ctv:absolute ctv:size-3 ctv:rounded-full ctv:bg-primary-background ctv:border-2 ctv:border-white
                       ctv:shadow-[0_1px_4px_rgb(0_0_0/0.5)]" />
        </div>
        <span
          v-for="side in SIDES"
          :key="`v-${side}`"
          class="ctv:absolute ctv:z-[2] ctv:pointer-events-none ctv:py-px ctv:px-[5px] ctv:rounded-sm
                 ctv:text-2xs ctv:font-mono ctv:bg-black/60 ctv:text-white/90"
          :style="badgeStyle(side)"
        >{{ pad[side] }}px</span>
      </template>
    </div>

    <div class="ctv:flex ctv:flex-col ctv:gap-1">
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:flex-wrap">
        <label v-for="side in SIDES" :key="`in-${side}`"
               class="ctv:flex ctv:items-center ctv:gap-[3px] ctv:py-0.5 ctv:px-1 ctv:rounded-sm
                      ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
          <span class="ctv:text-3xs ctv:min-w-8 ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t(`outpaint.${side}`) }}</span>
          <input
            type="number" min="0" max="4096" step="8"
            class="ctv:w-12 ctv:py-px ctv:px-[3px] ctv:rounded-sm ctv:text-[11px] ctv:font-mono
                   ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle
                   ctv:disabled:opacity-40"
            :value="pad[side]"
            :disabled="!sourceImageUrl"
            @change="(e) => setPad(side, Number((e.target as HTMLInputElement).value))"
          />
        </label>
        <button
          type="button"
          class="ctv:ml-auto ctv:py-0.5 ctv:px-2.5 ctv:text-[11px] ctv:rounded-sm ctv:cursor-pointer
                 ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle
                 ctv:hover:enabled:bg-secondary-background-hover ctv:disabled:opacity-40 ctv:disabled:cursor-default"
          :disabled="!sourceImageUrl"
          @click="resetAll"
        >{{ $t('outpaint.reset') }}</button>
      </div>
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:flex-wrap">
        <span class="ctv:text-2xs ctv:text-muted-foreground/60">{{ $t('outpaint.output') }}:</span>
        <span class="ctv:text-[11px] ctv:font-mono ctv:text-base-foreground">{{ outDims }}</span>
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
