<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <select
        v-if="luts.length"
        v-model="lutFile"
        class="ctv:w-full ctv:py-0.5 ctv:px-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground"
      >
        <option v-for="l in luts" :key="l" :value="l">{{ l }}</option>
      </select>
      <div v-else class="ctv:text-2xs ctv:text-center ctv:text-muted-foreground ctv:py-0.5">{{ $t('fx.noLuts') }}</div>

      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <button type="button" :class="btnClass" @click="fileEl?.click()">
          <i class="pi pi-upload" /> {{ $t('fx.upload') }}
        </button>
        <button type="button" :class="btnClass" :title="$t('fx.refresh')" @click="refreshLuts">
          <i class="pi pi-refresh" />
        </button>
        <input
          ref="fileEl"
          type="file"
          accept=".cube,.3dl,.dat,.m3d,.csp"
          class="ctv:hidden"
          @change="onFilePicked"
        />
      </div>

      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.interp') }}</span>
      <FxChips v-model="interp" :options="INTERPS" />
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
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useLutLibrary } from '@/composables/stages/useLutLibrary'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const INTERPS = [
  { value: 'tetrahedral', label: 'tetrahedral' },
  { value: 'trilinear', label: 'trilinear' },
  { value: 'nearest', label: 'nearest' },
  { value: 'pyramid', label: 'pyramid' },
  { value: 'prism', label: 'prism' },
]

const btnClass = 'ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background'

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const lutFile = useStrWidget(props.node, 'lut_file', '')
const interp = useStrWidget(props.node, 'interp', 'tetrahedral')

const fileEl = ref<HTMLInputElement | null>(null)

const { luts, refreshLuts, onFilePicked } = useLutLibrary(lutFile)
</script>
