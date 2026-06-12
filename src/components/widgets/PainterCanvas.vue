<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div
      class="ctv:relative ctv:w-full ctv:max-h-[360px] ctv:flex ctv:items-center ctv:justify-center
             ctv:bg-black ctv:rounded-md ctv:overflow-hidden ctv:border ctv:border-border-subtle"
      :style="canvasShellStyle"
    >
      <img
        v-if="sourceImageUrl"
        :src="sourceImageUrl"
        class="ctv:absolute ctv:inset-0 ctv:size-full ctv:object-contain ctv:pointer-events-none ctv:select-none"
        draggable="false"
        @dragstart.prevent
      />
      <canvas
        ref="canvasEl"
        class="ctv:absolute ctv:inset-0 ctv:size-full ctv:touch-none ctv:cursor-none"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointerenter="handlePointerEnter"
        @pointerleave="handlePointerLeave"
      />
      <div
        v-show="cursorVisible"
        ref="cursorEl"
        class="ctv:absolute ctv:top-0 ctv:left-0 ctv:rounded-full ctv:pointer-events-none ctv:border ctv:border-black/70
               ctv:shadow-[0_0_0_1px_rgb(255_255_255/0.8)] ctv:will-change-transform"
        :style="cursorStyle"
      />
    </div>

    <div v-if="sourceImageUrl" class="ctv:text-2xs ctv:text-center ctv:font-mono ctv:text-muted-foreground">
      {{ canvasWidth }} × {{ canvasHeight }}
    </div>

    <div class="ctv:flex ctv:flex-col ctv:gap-1">
      <div :class="rowClass">
        <span :class="labelClass">{{ $t('painter.tool') }}</span>
        <div class="ctv:flex ctv:gap-0.5 ctv:p-0.5 ctv:rounded ctv:bg-secondary-background">
          <button v-for="t in TOOLS" :key="t.id" type="button"
                  :class="toolBtnClass(tool === t.id)"
                  :title="$t(t.i18n)"
                  @click="tool = t.id">{{ t.icon }}</button>
        </div>
      </div>

      <div :class="rowClass">
        <span :class="labelClass">{{ $t('painter.size') }}</span>
        <input
          type="range" min="1" max="200" step="1"
          class="ctv:w-full"
          :value="brushSize"
          @input="(e) => brushSize = Number((e.target as HTMLInputElement).value)"
        />
        <span :class="valueClass">{{ brushSize }}</span>
      </div>

      <template v-if="tool !== 'eraser'">
        <div :class="rowClass">
          <span :class="labelClass">{{ $t('painter.color') }}</span>
          <input
            type="color"
            class="ctv:w-7 ctv:h-[18px] ctv:p-0 ctv:border-0 ctv:bg-transparent ctv:cursor-pointer"
            :value="brushColorDisplay"
            @input="(e) => brushColorDisplay = (e.target as HTMLInputElement).value"
          />
          <span :class="`${valueClass} ctv:font-mono`">{{ brushColorDisplay }}</span>
        </div>

        <div :class="rowClass">
          <span :class="labelClass">{{ $t('painter.opacity') }}</span>
          <input
            type="range" min="0" max="100" step="1"
            class="ctv:w-full"
            :value="brushOpacityPercent"
            @input="(e) => brushOpacityPercent = Number((e.target as HTMLInputElement).value)"
          />
          <span :class="valueClass">{{ brushOpacityPercent }}%</span>
        </div>
      </template>

      <template v-if="tool === 'brush'">
        <div :class="rowClass">
          <span :class="labelClass">{{ $t('painter.hardness') }}</span>
          <input
            type="range" min="0" max="100" step="1"
            class="ctv:w-full"
            :value="brushHardnessPercent"
            @input="(e) => brushHardnessPercent = Number((e.target as HTMLInputElement).value)"
          />
          <span :class="valueClass">{{ brushHardnessPercent }}%</span>
        </div>
      </template>

      <button
        type="button"
        class="ctv:mt-0.5 ctv:py-1 ctv:px-2.5 ctv:text-[11px] ctv:rounded ctv:cursor-pointer ctv:transition-colors ctv:duration-150
               ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle ctv:hover:bg-secondary-background-hover"
        @click="handleClear"
      >↶ {{ $t('painter.clear') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { usePainter } from '@/composables/widgets/usePainter'

const props = defineProps<{
  node: LGraphNode
  sourceImageUrl: string | null
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const cursorEl = ref<HTMLElement | null>(null)
const sourceImageUrlRef = computed(() => props.sourceImageUrl)

const {
  tool, brushSize, brushOpacity, brushHardness, brushColorDisplay,
  canvasWidth, canvasHeight,
  cursorVisible, displayBrushSize,
  handlePointerDown, handlePointerMove, handlePointerUp,
  handlePointerEnter, handlePointerLeave,
  handleClear,
  commitMask,
} = usePainter({
  canvasEl,
  cursorEl,
  sourceImageUrl: sourceImageUrlRef,
  node: props.node,
})

defineExpose({ commitMask })

const SHELL_MAX_HEIGHT_PX = 360
const canvasShellStyle = computed(() => {
  const ratio = canvasWidth.value / Math.max(1, canvasHeight.value)
  return {
    aspectRatio: `${canvasWidth.value} / ${canvasHeight.value}`,
    maxWidth: `${SHELL_MAX_HEIGHT_PX * ratio}px`,
  }
})

const cursorStyle = computed(() => ({
  width: `${displayBrushSize.value}px`,
  height: `${displayBrushSize.value}px`,
}))

const brushOpacityPercent = computed({
  get: () => Math.round(brushOpacity.value * 100),
  set: (v: number) => { brushOpacity.value = v / 100 },
})
const brushHardnessPercent = computed({
  get: () => Math.round(brushHardness.value * 100),
  set: (v: number) => { brushHardness.value = v / 100 },
})

const TOOLS = [
  { id: 'brush',   icon: '✏️', i18n: 'painter.brush' },
  { id: 'eraser',  icon: '🧽', i18n: 'painter.eraser' },
  { id: 'rect',    icon: '▭',  i18n: 'painter.rect' },
  { id: 'ellipse', icon: '◯',  i18n: 'painter.ellipse' },
  { id: 'label',   icon: '①',  i18n: 'painter.label' },
] as const

const rowClass   = 'ctv:grid ctv:grid-cols-[64px_1fr_48px] ctv:items-center ctv:gap-1.5 ctv:text-[11px]'
const labelClass = 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground'
const valueClass = 'ctv:text-right ctv:text-base-foreground'

function toolBtnClass(active: boolean) {
  return [
    'ctv:flex-1 ctv:py-0.5 ctv:px-2 ctv:text-[11px] ctv:cursor-pointer ctv:border-0 ctv:bg-transparent ctv:rounded-sm',
    active
      ? 'ctv:bg-secondary-background-selected ctv:text-primary-background ctv:font-semibold'
      : 'ctv:text-muted-foreground ctv:hover:text-base-foreground',
  ].join(' ')
}
</script>
