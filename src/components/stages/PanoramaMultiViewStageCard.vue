<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:text-[11px] ctv:text-center ctv:py-1">
      <span v-if="!panoramaUrl" class="ctv:text-muted-foreground">{{ $t('panoramaView.connectPanorama') }}</span>
      <span v-else-if="capturing" class="ctv:text-muted-foreground">{{ $t('panoramaView.capturingCount', { i: captureProgress, n: viewCount }) }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('panoramaView.capturedN', { n: viewCount }) }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('panoramaView.adjustCountToCapture') }}</span>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-2 ctv:flex-wrap">
      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('panoramaView.aspect') }}</span>
        <select v-model="aspectRatio" class="ctv-pano-select">
          <option v-for="opt in aspectOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('panoramaView.resolution') }}</span>
        <select v-model="resolution" class="ctv-pano-select">
          <option v-for="opt in resolutionOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
      <span class="ctv:ml-auto ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">{{ captureSize.w }}×{{ captureSize.h }}</span>
    </div>

    <div class="ctv:grid ctv:grid-cols-[80px_1fr_36px] ctv:items-center ctv:gap-1.5 ctv:py-1 ctv:px-2 ctv:rounded
                ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
      <span class="ctv:text-xs ctv:text-muted-foreground">{{ $t('panoramaView.viewCount') }}</span>
      <input
        type="range"
        min="2" max="24" step="1"
        class="ctv:w-full ctv:disabled:opacity-40"
        :value="viewCount"
        :disabled="!panoramaUrl"
        @input="(e) => viewCount = Number((e.target as HTMLInputElement).value)"
      />
      <span class="ctv:text-right ctv:text-xs ctv:font-mono ctv:text-base-foreground">{{ viewCount }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import StageCard from '@/components/stages/StageCard.vue'
import { useMultiViewCapture } from '@/composables/stages/useMultiViewCapture'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import {
  ASPECT_OPTIONS as aspectOptions,
  RESOLUTION_OPTIONS as resolutionOptions,
} from '@/utils/panoramaProjection'
import { readWidgetNum, readWidgetStr } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const viewCount   = ref<number>(readWidgetNum(props.node, 'view_count', 4))
const aspectRatio = ref<string>(readWidgetStr(props.node, 'aspect_ratio', '16:9'))
const resolution  = ref<string>(readWidgetStr(props.node, 'resolution',   '1K'))

const { panoramaUrl, capturing, captureProgress, captureSize } = useMultiViewCapture(
  props.node, props.state, viewCount, aspectRatio, resolution,
)
</script>

<style scoped>
.ctv-pano-select {
  appearance: none;
  background-color: var(--secondary-background, rgb(255 255 255 / 0.04));
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='6' viewBox='0 0 8 6'><path d='M0 0l4 6 4-6z' fill='%23bbb'/></svg>");
  background-repeat: no-repeat;
  background-position: right 6px center;
  color: var(--base-foreground, rgb(255 255 255 / 0.9));
  border: 1px solid var(--border-subtle, rgb(255 255 255 / 0.15));
  border-radius: 4px;
  padding: 3px 18px 3px 6px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  cursor: pointer;
  outline: none;
  min-width: 70px;
}
.ctv-pano-select:hover { border-color: var(--border-default, rgb(255 255 255 / 0.3)); }
.ctv-pano-select:focus { border-color: var(--primary-background, rgb(78 168 255 / 0.6)); }
.ctv-pano-select option { background: var(--interface-menu-surface, #1a1a2e); color: var(--base-foreground, #e0e0e0); }
</style>
