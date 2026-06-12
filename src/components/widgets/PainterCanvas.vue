<template>
  <div
    class="flex flex-col gap-1.5 w-full"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div
      class="relative w-full max-h-[360px] flex items-center justify-center
             bg-black rounded-md overflow-hidden border border-border-subtle"
      :style="canvasShellStyle"
    >
      <img
        v-if="sourceImageUrl"
        :src="sourceImageUrl"
        class="absolute inset-0 size-full object-contain pointer-events-none select-none"
        draggable="false"
        @dragstart.prevent
      />
      <canvas
        ref="canvasEl"
        class="absolute inset-0 size-full touch-none cursor-none"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointerenter="handlePointerEnter"
        @pointerleave="handlePointerLeave"
      />
      <div
        v-show="cursorVisible"
        ref="cursorEl"
        class="absolute top-0 left-0 rounded-full pointer-events-none border border-black/70
               shadow-[0_0_0_1px_rgb(255_255_255/0.8)] will-change-transform"
        :style="cursorStyle"
      />
    </div>

    <div v-if="sourceImageUrl" class="text-2xs text-center font-mono text-muted-foreground">
      {{ canvasWidth }} × {{ canvasHeight }}
    </div>

    <div class="flex flex-col gap-1">
      <div :class="rowClass">
        <span :class="labelClass">{{ $t('painter.tool') }}</span>
        <div class="flex gap-0.5 p-0.5 rounded bg-secondary-background">
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
          class="w-full"
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
            class="w-7 h-[18px] p-0 border-0 bg-transparent cursor-pointer"
            :value="brushColorDisplay"
            @input="(e) => brushColorDisplay = (e.target as HTMLInputElement).value"
          />
          <span :class="`${valueClass} font-mono`">{{ brushColorDisplay }}</span>
        </div>

        <div :class="rowClass">
          <span :class="labelClass">{{ $t('painter.opacity') }}</span>
          <input
            type="range" min="0" max="100" step="1"
            class="w-full"
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
            class="w-full"
            :value="brushHardnessPercent"
            @input="(e) => brushHardnessPercent = Number((e.target as HTMLInputElement).value)"
          />
          <span :class="valueClass">{{ brushHardnessPercent }}%</span>
        </div>
      </template>

      <button
        type="button"
        class="mt-0.5 py-1 px-2.5 text-[11px] rounded cursor-pointer transition-colors duration-150
               bg-secondary-background text-base-foreground border border-border-subtle hover:bg-secondary-background-hover"
        @click="handleClear"
      >↶ {{ $t('painter.clear') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePainter } from '@/composables/widgets/usePainter'

const props = defineProps<{
  node: any
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

const rowClass   = 'grid grid-cols-[64px_1fr_48px] items-center gap-1.5 text-[11px]'
const labelClass = 'text-2xs uppercase tracking-wide text-muted-foreground'
const valueClass = 'text-right text-base-foreground'

function toolBtnClass(active: boolean) {
  return [
    'flex-1 py-0.5 px-2 text-[11px] cursor-pointer border-0 bg-transparent rounded-sm',
    active
      ? 'bg-secondary-background-selected text-primary-background font-semibold'
      : 'text-muted-foreground hover:text-base-foreground',
  ].join(' ')
}
</script>
