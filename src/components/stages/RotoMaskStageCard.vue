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
          @dblclick="onDbl"
        />
      </template>
    </div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.rotoHint') }}</div>
      <FxSlider v-model="feather" :label="$t('fx.feather')" :min="0" :max="200" :step="1" :decimals="0" :reset-to="0" />
      <div class="ctv:flex ctv:items-center ctv:gap-1.5">
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="invert" class="ctv:accent-primary-background" />
          {{ $t('fx.invert') }}
        </label>
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="smooth" class="ctv:accent-primary-background" />
          Bezier
        </label>
        <button
          type="button"
          class="ctv:ml-auto ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-destructive-background
                 ctv:hover:border-destructive-background"
          @click="clearShape"
        ><i class="pi pi-trash" /> {{ $t('fx.clearKeys') }}</button>
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
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useRotoMaskEditor } from '@/composables/stages/useRotoMaskEditor'
import { useBoolWidget, useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const feather = useNumWidget(props.node, 'feather', 0)
const invert = useBoolWidget(props.node, 'invert', false)

const videoEl = ref<HTMLVideoElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)

const { smooth, onMeta, onDown, onMovePtr, onUp, onDbl, clearShape } =
  useRotoMaskEditor({ node: props.node, videoEl, overlayEl })
</script>
