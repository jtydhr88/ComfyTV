<template>
  <div class="pano-multi-stage">
    <div class="info">
      <span v-if="!panoramaUrl" class="muted">{{ $t('panoramaView.connectPanorama') }}</span>
      <span v-else-if="capturing" class="muted">{{ $t('panoramaView.capturingCount', { i: captureProgress, n: viewCount }) }}</span>
      <span v-else-if="state.output" class="ok">{{ $t('panoramaView.capturedN', { n: viewCount }) }}</span>
      <span v-else class="muted">{{ $t('panoramaView.adjustCountToCapture') }}</span>
    </div>

    <div class="ratio-row">
      <div class="ctl">
        <span class="label">{{ $t('panoramaView.aspect') }}</span>
        <select v-model="aspectRatio" class="select">
          <option v-for="opt in aspectOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
      <div class="ctl">
        <span class="label">{{ $t('panoramaView.resolution') }}</span>
        <select v-model="resolution" class="select">
          <option v-for="opt in resolutionOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
      <span class="dims">{{ captureSize.w }}×{{ captureSize.h }}</span>
    </div>

    <div class="controls">
      <span class="label">{{ $t('panoramaView.viewCount') }}</span>
      <input
        type="range"
        min="2" max="24" step="1"
        :value="viewCount"
        :disabled="!panoramaUrl"
        @input="(e) => viewCount = Number((e.target as HTMLInputElement).value)"
      />
      <span class="value">{{ viewCount }}</span>
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
.pano-multi-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}
.info {
  font-size: 11px;
  text-align: center;
  padding: 4px 0;
}
.info .muted { color: rgba(255, 255, 255, 0.55); }
.info .ok    { color: #b5e3a5; }

.ratio-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ctl {
  display: flex;
  align-items: center;
  gap: 4px;
}
.label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: rgba(255, 255, 255, 0.04);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='6' viewBox='0 0 8 6'><path d='M0 0l4 6 4-6z' fill='%23bbb'/></svg>");
  background-repeat: no-repeat;
  background-position: right 6px center;
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  padding: 3px 18px 3px 6px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  cursor: pointer;
  outline: none;
  min-width: 70px;
}
.select:hover  { border-color: rgba(255, 255, 255, 0.3); }
.select:focus  { border-color: rgba(78, 168, 255, 0.6); }
.select option { background: #1a1a2e; color: #e0e0e0; }
.dims {
  margin-left: auto;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.controls {
  display: grid;
  grid-template-columns: 80px 1fr 36px;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
.controls .label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  text-transform: none;
  letter-spacing: 0;
}
.value {
  text-align: right;
  color: rgba(255, 255, 255, 0.9);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
}
input[type='range'] { width: 100%; }
input[type='range']:disabled { opacity: 0.4; }
</style>
