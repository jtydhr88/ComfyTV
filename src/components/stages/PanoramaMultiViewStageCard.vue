<template>
  <div class="flex flex-col gap-1.5 size-full">
    <div class="text-[11px] text-center py-1">
      <span v-if="!panoramaUrl" class="text-muted-foreground">{{ $t('panoramaView.connectPanorama') }}</span>
      <span v-else-if="capturing" class="text-muted-foreground">{{ $t('panoramaView.capturingCount', { i: captureProgress, n: viewCount }) }}</span>
      <span v-else-if="state.output" class="text-success-background">{{ $t('panoramaView.capturedN', { n: viewCount }) }}</span>
      <span v-else class="text-muted-foreground">{{ $t('panoramaView.adjustCountToCapture') }}</span>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <div class="flex items-center gap-1">
        <span class="text-2xs uppercase tracking-wide text-muted-foreground">{{ $t('panoramaView.aspect') }}</span>
        <select v-model="aspectRatio" class="ctv-pano-select">
          <option v-for="opt in aspectOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-2xs uppercase tracking-wide text-muted-foreground">{{ $t('panoramaView.resolution') }}</span>
        <select v-model="resolution" class="ctv-pano-select">
          <option v-for="opt in resolutionOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
      <span class="ml-auto text-2xs font-mono text-muted-foreground">{{ captureSize.w }}×{{ captureSize.h }}</span>
    </div>

    <div class="grid grid-cols-[80px_1fr_36px] items-center gap-1.5 py-1 px-2 rounded
                bg-secondary-background border border-border-subtle">
      <span class="text-xs text-muted-foreground">{{ $t('panoramaView.viewCount') }}</span>
      <input
        type="range"
        min="2" max="24" step="1"
        class="w-full disabled:opacity-40"
        :value="viewCount"
        :disabled="!panoramaUrl"
        @input="(e) => viewCount = Number((e.target as HTMLInputElement).value)"
      />
      <span class="text-right text-xs font-mono text-base-foreground">{{ viewCount }}</span>
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
import type { StageState } from '@/stores/stageStore'
import {
  ASPECT_OPTIONS as aspectOptions,
  RESOLUTION_OPTIONS as resolutionOptions,
} from '@/utils/panoramaProjection'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

function getWidget(name: string): any | null {
  return props.node?.widgets?.find((w: any) => w.name === name) ?? null
}
function readWidgetStr(name: string, fallback: string): string {
  const w = getWidget(name)
  if (!w) return fallback
  const v = String(w.value ?? '')
  return v || fallback
}

const viewCount   = ref<number>(Number(getWidget('view_count')?.value ?? 4) || 4)
const aspectRatio = ref<string>(readWidgetStr('aspect_ratio', '16:9'))
const resolution  = ref<string>(readWidgetStr('resolution',   '1K'))

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
