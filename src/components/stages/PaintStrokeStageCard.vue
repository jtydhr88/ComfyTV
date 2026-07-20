<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
    <div
      class="ctv:relative ctv:w-full ctv:h-[220px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <div v-if="!sourceVideoUrl"
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <i class="pi pi-video ctv:text-[32px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('videoTrim.noInputVideo') }}</div>
      </div>
      <template v-else>
        <video
          ref="videoEl" :src="sourceVideoUrl" muted playsinline preload="metadata"
          class="ctv:block ctv:size-full ctv:object-contain"
          @loadedmetadata="onMeta"
        />
        <canvas
          ref="overlayEl"
          class="ctv:absolute ctv:inset-0 ctv:size-full ctv:touch-none ctv:cursor-crosshair"
          @pointerdown="onDown"
          @pointermove="onMovePtr"
          @pointerup="onUp"
          @pointercancel="onUp"
        />
      </template>
    </div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <FxChips v-model="mode" :options="MODES" />
      <FxSlider v-model="radius" label="Radius" :min="2" :max="150" :step="1" :decimals="0" :reset-to="20" />
      <FxSlider v-model="hardness" label="Hardness" :min="0" :max="0.99" :step="0.01" :reset-to="0.5" />
      <FxSlider v-if="mode === 'blur'" v-model="sigma" label="Blur σ" :min="0.5" :max="50" :step="0.5" :reset-to="8" />
      <div v-if="mode === 'clone'" class="ctv:flex ctv:gap-1">
        <FxSlider v-model="dx" label="Src ΔX" :min="-300" :max="300" :step="1" :decimals="0" :reset-to="0" class="ctv:flex-1" />
        <FxSlider v-model="dy" label="Src ΔY" :min="-300" :max="300" :step="1" :decimals="0" :reset-to="0" class="ctv:flex-1" />
      </div>
      <div v-if="mode === 'color'" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.colorLbl') }}</span>
        <input type="color" v-model="color"
               class="ctv:w-8 ctv:h-6 ctv:p-0 ctv:border ctv:border-border-subtle ctv:rounded ctv:cursor-pointer ctv:bg-transparent" />
      </div>

      <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground">
        <span>{{ strokes.length }} strokes</span>
        <button
          type="button"
          class="ctv:ml-auto ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
                 ctv:hover:border-primary-background ctv:disabled:opacity-40"
          :disabled="!strokes.length"
          @click="undoStroke"
        ><i class="pi pi-undo" /></button>
        <button
          type="button"
          class="ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-destructive-background
                 ctv:hover:border-destructive-background ctv:disabled:opacity-40"
          :disabled="!strokes.length"
          @click="clearStrokes"
        ><i class="pi pi-trash" /></button>
      </div>

      <div class="ctv:flex ctv:gap-1">
        <FxSlider v-model="tStart" :label="$t('fx.tStart')" :min="0" :max="tMax" :step="0.05" class="ctv:flex-1" />
        <FxSlider v-model="tEnd" :label="$t('fx.tEnd')" :min="-1" :max="tMax" :step="0.05" class="ctv:flex-1" />
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
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
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { usePaintStrokeEditor } from '@/composables/stages/usePaintStrokeEditor'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const MODES = [
  { value: 'clone', label: 'Clone' },
  { value: 'blur', label: 'Blur' },
  { value: 'color', label: 'Color' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const tStart = useNumWidget(props.node, 't_start', 0)
const tEnd = useNumWidget(props.node, 't_end', -1)

const videoEl = ref<HTMLVideoElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)

const {
  duration, strokes, mode, radius, hardness, sigma, dx, dy, color,
  onMeta, onDown, onMovePtr, onUp, undoStroke, clearStrokes,
} = usePaintStrokeEditor({ node: props.node, videoEl, overlayEl })
const tMax = computed(() => {
  const d = duration.value
  return d > 0 ? Math.max(0.1, Math.round(d * 10) / 10) : 3600
})
</script>
