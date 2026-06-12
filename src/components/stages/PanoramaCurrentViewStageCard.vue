<template>
  <div class="pano-view-stage">
    <div class="viewer-wrap">
      <div
        ref="viewerHostEl"
        class="viewer-shell"
        :style="viewerStyle"
      >
        <div v-if="!panoramaUrl" class="empty-state">
          <div class="empty-icon">🌐</div>
          <div class="empty-text">{{ $t('panoramaView.connectPanorama') }}</div>
        </div>
      </div>
    </div>

    <div class="controls">
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

    <div class="status">
      <span v-if="!panoramaUrl" class="muted">{{ $t('panoramaView.connectPanorama') }}</span>
      <span v-else-if="capturing" class="muted">{{ $t('panoramaView.capturing') }}</span>
      <span v-else-if="state.output" class="ok">{{ $t('panoramaView.captured') }}</span>
      <span v-else class="muted">{{ $t('panoramaView.orbitToCapture') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
      hide-output
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import StageCard from '@/components/stages/StageCard.vue'
import { useCurrentViewCapture } from '@/composables/stages/useCurrentViewCapture'
import type { StageState } from '@/stores/stageStore'
import {
  ASPECT_OPTIONS as aspectOptions,
  parseAspect,
  RESOLUTION_OPTIONS as resolutionOptions,
} from '@/utils/panoramaProjection'

const VIEWER_HEIGHT_PX = 300

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

function readWidgetStr(name: string, fallback: string): string {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  if (!w) return fallback
  const v = String(w.value ?? '')
  return v || fallback
}

const viewerHostEl = ref<HTMLDivElement | null>(null)
const aspectRatio = ref<string>(readWidgetStr('aspect_ratio', '16:9'))
const resolution  = ref<string>(readWidgetStr('resolution',   '1K'))

const { panoramaUrl, capturing, captureSize } = useCurrentViewCapture(
  props.node, props.state, viewerHostEl, aspectRatio, resolution,
)

const viewerStyle = computed(() => {
  const { w, h } = parseAspect(aspectRatio.value)
  return {
    height: `${VIEWER_HEIGHT_PX}px`,
    aspectRatio: `${w} / ${h}`,
  }
})
</script>

<style scoped>
.pano-view-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}

.viewer-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}
.viewer-shell {
  position: relative;
  max-width: 100%;
  background: #0a0a0f;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  gap: 6px;
  pointer-events: none;
}
.empty-icon { font-size: 32px; opacity: 0.6; }
.empty-text { font-size: 12px; text-align: center; padding: 0 12px; }

.controls {
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
.select:hover {
  border-color: rgba(255, 255, 255, 0.3);
}
.select:focus {
  border-color: rgba(78, 168, 255, 0.6);
}
.select option {
  background: #1a1a2e;
  color: #e0e0e0;
}
.dims {
  margin-left: auto;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.status {
  font-size: 10px;
  text-align: center;
  padding: 2px 0;
}
.status .muted { color: rgba(255, 255, 255, 0.5); }
.status .ok    { color: #b5e3a5; }
</style>
