<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div class="ctv-scroll-thin ctv:flex ctv:flex-col ctv:gap-1 ctv:max-h-44 ctv:overflow-y-auto" @wheel.stop>
        <div v-for="(cue, i) in cues" :key="i" class="ctv:flex ctv:items-center ctv:gap-1">
          <input
            type="number"
            step="0.1"
            min="0"
            :value="+cue.start.toFixed(2)"
            class="ctv:w-16 ctv:p-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
            @change="onCueNum(i, 'start', $event)"
          />
          <input
            type="number"
            step="0.1"
            min="0"
            :value="+cue.end.toFixed(2)"
            class="ctv:w-16 ctv:p-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
            @change="onCueNum(i, 'end', $event)"
          />
          <input
            type="text"
            :value="cue.text"
            class="ctv:flex-1 ctv:min-w-0 ctv:p-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
            @change="onCueText(i, $event)"
          />
          <button
            type="button"
            class="ctv:py-0.5 ctv:px-1 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                   ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
                   ctv:hover:border-primary-background"
            @click="removeCue(i)"
          ><i class="pi pi-times" /></button>
        </div>
      </div>

      <button
        type="button"
        class="ctv:py-0.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
               ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
               ctv:hover:border-primary-background"
        @click="addCue"
      >+ Add cue</button>

      <div class="ctv:text-2xs ctv:text-muted-foreground ctv:tracking-wide">{{ cues.length }} {{ $t('fx.cues') }}</div>

      <details class="ctv:flex ctv:flex-col ctv:gap-1">
        <summary class="ctv:text-2xs ctv:text-muted-foreground ctv:tracking-wide ctv:cursor-pointer">SRT source</summary>
        <textarea
          v-model="subs"
          rows="6"
          :placeholder="$t('fx.subsPlaceholder')"
          class="ctv:w-full ctv:p-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground ctv:resize-none ctv:font-mono"
        />
      </details>

      <div class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.fontLbl') }}</div>
      <FxChips v-model="font" :options="FONTS" />

      <FxSlider v-model="size" :label="$t('fx.fontSize')" :min="8" :max="200" :step="1" :decimals="0" />

      <div class="ctv:flex ctv:items-center ctv:gap-3 ctv:text-[11px]">
        <label class="ctv:flex ctv:items-center ctv:gap-1.5">
          <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.colorLbl') }}</span>
          <input
            v-model="color"
            type="color"
            class="ctv:h-6 ctv:w-10 ctv:cursor-pointer ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background"
          />
        </label>
      </div>
      <FxSlider v-model="stroke" :label="$t('fx.strokeLbl')" :min="0" :max="20" :step="1" :decimals="0" />

      <div class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.anchor') }}</div>
      <FxChips v-model="anchor" :options="ANCHORS" />
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
import { computed } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useSubtitleCues } from '@/composables/stages/useSubtitleCues'
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

const ANCHORS = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'top', label: 'Top' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const subs = useStrWidget(props.node, 'subs', '')
const font = useStrWidget(props.node, 'font', 'Inter-Regular')
const size = useNumWidget(props.node, 'size', 36)
const color = useStrWidget(props.node, 'color', '#ffffff')
const stroke = useNumWidget(props.node, 'stroke', 2)
const anchor = useStrWidget(props.node, 'anchor', 'bottom')

const { cues, addCue, removeCue, onCueNum, onCueText } = useSubtitleCues(subs)
</script>
