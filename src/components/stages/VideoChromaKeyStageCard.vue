<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl">
        <template #overlay>
          <canvas
            ref="canvasEl"
            class="ctv:absolute ctv:inset-0 ctv:size-full ctv:object-contain ctv-checker"
            :class="picking ? 'ctv:cursor-crosshair' : 'ctv:cursor-pointer'"
            @click="onCanvasClick"
          />
        </template>
      </VideoPlayerLite>
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span class="ctv:min-w-16 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.keyColor') }}</span>
        <input
          type="color" :value="keyColor"
          class="ctv:w-8 ctv:h-6 ctv:p-0 ctv:border ctv:border-border-subtle ctv:rounded ctv:cursor-pointer ctv:bg-transparent"
          @input="(e) => keyColor = (e.target as HTMLInputElement).value"
        />
        <span class="ctv:font-mono ctv:text-2xs ctv:text-muted-foreground">{{ keyColor }}</span>
        <button
          type="button"
          class="ctv:ml-auto ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors"
          :class="picking
            ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
            : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'"
          @click="picking = !picking"
        ><i class="pi pi-eye-dropper" /> {{ $t('fx.pickFromVideo') }}</button>
      </div>

      <FxSlider v-model="similarity" :label="$t('fx.similarity')" :min="0.01" :max="1" :step="0.01" :reset-to="0.1" />
      <FxSlider v-model="blend" :label="$t('fx.blend')" :min="0" :max="1" :step="0.01" :reset-to="0.05" />
      <div :class="output === 'matte' ? 'ctv:invisible' : ''" class="ctv:flex ctv:flex-col ctv:gap-1">
        <FxSlider v-model="despillMix" :label="$t('fx.despill')" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
        <FxSlider v-model="despillExpand" :label="$t('fx.despillExpand')" :min="0" :max="1" :step="0.01" :reset-to="0" />
      </div>
      <FxChips v-model="output" :options="OUTPUTS" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.previewNote') }}</span>
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
import { computed, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useChromaKeyPicker } from '@/composables/stages/useChromaKeyPicker'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { t } = useI18n()
const OUTPUTS = computed(() => [
  { value: 'alpha', label: t('fx.outAlpha') },
  { value: 'matte', label: t('fx.outMatte') },
]).value

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const keyColor = useStrWidget(props.node, 'key_color', '#00FF00')
const similarity = useNumWidget(props.node, 'similarity', 0.1)
const blend = useNumWidget(props.node, 'blend', 0.05)
const despillMix = useNumWidget(props.node, 'despill_mix', 0.5)
const despillExpand = useNumWidget(props.node, 'despill_expand', 0)
const output = useStrWidget(props.node, 'output', 'alpha')

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const videoEl = computed<HTMLVideoElement | null>(() => playerRef.value?.videoEl ?? null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const { picking, startLoop, onCanvasClick } = useChromaKeyPicker({
  videoEl,
  canvasEl,
  nodeId: String(props.node.id),
  node: props.node,
  keyColor,
  similarity,
  blend,
  despillMix,
  despillExpand,
  outputMode: output,
})

watch(videoEl, (v) => {
  if (v) startLoop()
}, { immediate: true })
</script>

<style scoped>
.ctv-checker {
  background-image:
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}
</style>
