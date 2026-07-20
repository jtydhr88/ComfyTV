<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl" />
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <textarea
        v-model="text"
        rows="2"
        :placeholder="$t('fx.text')"
        class="ctv:w-full ctv:p-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground ctv:resize-none"
      />

      <div class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.fontLbl') }}</div>
      <FxChips v-model="font" :options="FONTS" />

      <FxSlider v-model="size" :label="$t('fx.fontSize')" :min="8" :max="400" :step="1" :decimals="0" />

      <div class="ctv:flex ctv:items-center ctv:gap-3 ctv:text-[11px]">
        <label class="ctv:flex ctv:items-center ctv:gap-1.5">
          <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.colorLbl') }}</span>
          <input
            v-model="color"
            type="color"
            class="ctv:h-6 ctv:w-10 ctv:cursor-pointer ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background"
          />
        </label>
        <label class="ctv:flex ctv:items-center ctv:gap-1.5">
          <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.strokeLbl') }}</span>
          <input
            v-model="strokeColor"
            type="color"
            class="ctv:h-6 ctv:w-10 ctv:cursor-pointer ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background"
          />
        </label>
      </div>
      <FxSlider v-model="stroke" :label="$t('fx.strokeLbl')" :min="0" :max="20" :step="1" :decimals="0" />

      <div class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.anchor') }}</div>
      <FxChips v-model="anchor" :options="ANCHORS_TOP" />
      <FxChips v-model="anchor" :options="ANCHORS_BOTTOM" />
      <FxChips v-model="anchor" :options="ANCHORS_CENTER" />

      <FxSlider v-model="tStart" :label="$t('fx.tStart')" :min="0" :max="tMax" :step="0.05" />
      <FxSlider v-model="tEnd" :label="$t('fx.tEnd')" :min="-1" :max="tMax" :step="0.05" />
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.tEndAuto') }}</div>
      <FxSlider v-model="fadeS" :label="$t('fx.fade')" :min="0" :max="10" :step="0.1" />

      <div class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">Typewriter</div>
      <FxChips v-model="typewriter" :options="TYPEWRITERS" />
      <FxSlider v-if="typewriter !== 'off'" v-model="typeStep" label="Step" :min="0.02" :max="2" :step="0.01" :reset-to="0.1" unit="s" />
      <div class="ctv:text-3xs ctv:text-muted-foreground ctv:tracking-wide">
        Tokens: #timecode# #shorttimecode# #frame#
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
  </FxCardShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const FONTS = [
  { value: 'Inter-Regular', label: 'Inter' },
  { value: 'NotoSansSC-Regular', label: 'Noto SC' },
  { value: 'msyh', label: '雅黑' },
  { value: 'arial', label: 'Arial' },
]

const ANCHORS_TOP = [
  { value: 'top-left', label: '↖', title: 'top-left' },
  { value: 'top', label: '↑', title: 'top' },
  { value: 'top-right', label: '↗', title: 'top-right' },
]
const ANCHORS_BOTTOM = [
  { value: 'bottom-left', label: '↙', title: 'bottom-left' },
  { value: 'bottom', label: '↓', title: 'bottom' },
  { value: 'bottom-right', label: '↘', title: 'bottom-right' },
]
const ANCHORS_CENTER = [
  { value: 'center', label: '◎', title: 'center' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const tMax = computed(() => {
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? Math.max(0.1, Math.round(d * 10) / 10) : 3600
})
const text = useStrWidget(props.node, 'text', '')
const font = useStrWidget(props.node, 'font', 'Inter-Regular')
const size = useNumWidget(props.node, 'size', 48)
const color = useStrWidget(props.node, 'color', '#ffffff')
const stroke = useNumWidget(props.node, 'stroke', 0)
const strokeColor = useStrWidget(props.node, 'stroke_color', '#000000')
const anchor = useStrWidget(props.node, 'anchor', 'bottom')
const tStart = useNumWidget(props.node, 't_start', 0)
const tEnd = useNumWidget(props.node, 't_end', -1)
const fadeS = useNumWidget(props.node, 'fade_s', 0)
const typewriter = useStrWidget(props.node, 'typewriter', 'off')
const typeStep = useNumWidget(props.node, 'type_step', 0.1)

const TYPEWRITERS = [
  { value: 'off', label: 'Off' },
  { value: 'char', label: 'Chars' },
  { value: 'word', label: 'Words' },
  { value: 'line', label: 'Lines' },
]
</script>
