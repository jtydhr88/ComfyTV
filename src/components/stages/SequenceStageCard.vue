<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div
        v-if="rows.length === 0"
        class="ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:h-24
               ctv:rounded-md ctv:bg-black/40 ctv:border ctv:border-dashed ctv:border-border-subtle ctv:text-white/50"
      >
        <i class="pi pi-video ctv:text-[24px] ctv:opacity-60" />
        <div class="ctv:text-xs">Connect video clips to build a sequence</div>
      </div>

      <div v-else class="ctv:flex ctv:flex-col ctv:gap-1">
        <div
          v-for="(seg, idx) in rows"
          :key="seg.slot"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:p-1 ctv:rounded-md
                 ctv:bg-black/40 ctv:border ctv:border-border-subtle"
        >
          <span class="ctv:shrink-0 ctv:w-4 ctv:text-center ctv:text-2xs ctv:font-bold ctv:font-mono"
                :style="{ color: clipBySlot.get(seg.slot)?.color }">
            {{ idx + 1 }}
          </span>

          <video
            v-if="clipBySlot.get(seg.slot)"
            :src="clipBySlot.get(seg.slot)!.url"
            class="ctv:shrink-0 ctv:w-12 ctv:h-7 ctv:rounded ctv:object-cover ctv:bg-black ctv:border ctv:pointer-events-none"
            :style="{ borderColor: clipBySlot.get(seg.slot)!.color }"
            muted playsinline preload="metadata"
          />

          <div class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:shrink-0">
            <button
              type="button"
              class="ctv-seq-btn"
              :disabled="idx === 0"
              title="Move up"
              @click="moveRow(idx, -1)"
            ><i class="pi pi-chevron-up ctv:text-[9px]" /></button>
            <button
              type="button"
              class="ctv-seq-btn"
              :disabled="idx === rows.length - 1"
              title="Move down"
              @click="moveRow(idx, 1)"
            ><i class="pi pi-chevron-down ctv:text-[9px]" /></button>
          </div>

          <div class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:flex-1 ctv:min-w-0">
            <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-3xs ctv:text-muted-foreground">
              <span class="ctv:shrink-0">{{ $t('fx.tStart') }}</span>
              <input
                type="number" min="0" max="3600" step="0.1"
                class="ctv-seq-num"
                :value="seg.in_s"
                title="In (s) · 0 = clip start"
                @change="onTimeInput(idx, 'in_s', $event)"
              />
              <span class="ctv:shrink-0">{{ $t('fx.tEnd') }}</span>
              <input
                type="number" min="0" max="3600" step="0.1"
                class="ctv-seq-num"
                :value="seg.out_s"
                title="Out (s) · 0 = clip end"
                @change="onTimeInput(idx, 'out_s', $event)"
              />
            </div>
            <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-3xs ctv:text-muted-foreground">
              <select
                class="ctv:flex-1 ctv:min-w-0 ctv:py-0.5 ctv:px-1 ctv:text-[11px] ctv:rounded
                       ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
                       ctv:disabled:opacity-50 ctv:disabled:cursor-not-allowed"
                :value="idx === 0 ? 'cut' : seg.transition"
                :disabled="idx === 0"
                :title="idx === 0 ? 'First clip has no incoming transition' : 'Transition from previous clip'"
                @change="onTransitionChange(idx, $event)"
              >
                <option v-for="t in TRANSITIONS" :key="t" :value="t">{{ t }}</option>
              </select>
              <input
                v-if="idx > 0 && seg.transition !== 'cut'"
                type="number" min="0.1" max="5" step="0.1"
                class="ctv-seq-num"
                :value="seg.trans_dur"
                title="Transition duration (s)"
                @change="onDurInput(idx, $event)"
              />
              <span v-if="idx > 0 && seg.transition !== 'cut'" class="ctv:shrink-0">s</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="rows.length < 2" class="ctv:text-muted-foreground">Connect at least two clips</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.adjustThenRun') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { TRANSITIONS, useSequenceItems } from '@/composables/stages/useSequenceItems'
import { videoClipsFromInputs } from '@/composables/stages/videoClipInputs'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const clips = computed(() => videoClipsFromInputs(props.state.inputs))
const clipBySlot = computed(() => new Map(clips.value.map(c => [c.key, c])))

const {
  rows, moveRow, onTimeInput, onTransitionChange, onDurInput,
} = useSequenceItems(props.node, clips)
</script>

<style scoped>
.ctv-seq-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 12px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid var(--ctv-border-subtle, rgb(255 255 255 / 0.15));
  background: transparent;
  color: inherit;
}
.ctv-seq-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.ctv-seq-num {
  width: 3.25rem;
  padding: 2px 4px;
  text-align: right;
  font-size: 11px;
  font-family: monospace;
  border-radius: 4px;
  background: var(--p-secondary-background, rgb(0 0 0 / 0.4));
  border: 1px solid var(--ctv-border-subtle, rgb(255 255 255 / 0.15));
  color: inherit;
  -moz-appearance: textfield;
}
.ctv-seq-num::-webkit-inner-spin-button,
.ctv-seq-num::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>
