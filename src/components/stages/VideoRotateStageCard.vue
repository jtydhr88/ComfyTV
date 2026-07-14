<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite
      ref="playerEl"
      :source-video-url="sourceVideoUrl"
      :video-style="videoStyle"
    />

    <div
      class="ctv:flex ctv:items-center ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <button type="button" :class="btnClass(false)"
              :title="$t('videoRotate.rotateLeft')"
              @click="rotateBy(-90)"><i class="pi pi-undo" /> 90°</button>
      <button type="button" :class="btnClass(false)"
              :title="$t('videoRotate.rotateRight')"
              @click="rotateBy(90)"><i class="pi pi-refresh" /> 90°</button>
      <button type="button" :class="btnClass(flipH)"
              :title="$t('videoRotate.flipH')"
              @click="setFlipH(!flipH)"><i class="pi pi-arrows-h" /></button>
      <button type="button" :class="btnClass(flipV)"
              :title="$t('videoRotate.flipV')"
              @click="setFlipV(!flipV)"><i class="pi pi-arrows-v" /></button>
      <span class="ctv:ml-auto ctv:text-[11px] ctv:font-mono ctv:font-bold ctv:text-primary-background">{{ rotateDeg }}°</span>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoRotate.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoRotate.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoRotate.adjustThenRun') }}</span>
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
import { useResizeObserver } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { bindWidgetCallback, onNodeConfigure, readWidgetNum, writeWidget, getWidget } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const rotateDeg = ref(readWidgetNum(props.node, 'rotate_deg', 0))
const flipH = ref(Boolean(getWidget(props.node, 'flip_h')?.value))
const flipV = ref(Boolean(getWidget(props.node, 'flip_v')?.value))

function rotateBy(delta: number) {
  rotateDeg.value = ((rotateDeg.value + delta) % 360 + 360) % 360
  writeWidget(props.node, 'rotate_deg', rotateDeg.value)
}
function setFlipH(v: boolean) {
  flipH.value = v
  writeWidget(props.node, 'flip_h', v)
}
function setFlipV(v: boolean) {
  flipV.value = v
  writeWidget(props.node, 'flip_v', v)
}

bindWidgetCallback(props.node, 'rotate_deg', (value) => {
  const v = Number(value)
  if (Number.isFinite(v) && v !== rotateDeg.value) rotateDeg.value = ((v % 360) + 360) % 360
})
bindWidgetCallback(props.node, 'flip_h', (value) => { flipH.value = Boolean(value) })
bindWidgetCallback(props.node, 'flip_v', (value) => { flipV.value = Boolean(value) })

onNodeConfigure(props.node, () => {
  rotateDeg.value = readWidgetNum(props.node, 'rotate_deg', rotateDeg.value)
  flipH.value = Boolean(getWidget(props.node, 'flip_h')?.value)
  flipV.value = Boolean(getWidget(props.node, 'flip_v')?.value)
})

const playerEl = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const boxRatio = ref(0.5)
useResizeObserver(() => playerEl.value?.boxEl ?? null, (entries) => {
  const r = entries[0]?.contentRect
  if (r && r.width > 0) boxRatio.value = r.height / r.width
})

const videoStyle = computed<Record<string, string>>(() => {
  const rotated = rotateDeg.value === 90 || rotateDeg.value === 270
  const scale = rotated ? Math.min(1, boxRatio.value) : 1
  return {
    transform: `scaleX(${flipH.value ? -1 : 1}) scaleY(${flipV.value ? -1 : 1})`
      + ` scale(${scale}) rotate(${rotateDeg.value}deg)`,
    transition: 'transform 0.15s ease',
  }
})

function btnClass(active: boolean) {
  return 'ctv:flex-1 ctv:flex ctv:items-center ctv:justify-center ctv:gap-1 ctv:py-1 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors '
    + (active
      ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
      : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background')
}
</script>
