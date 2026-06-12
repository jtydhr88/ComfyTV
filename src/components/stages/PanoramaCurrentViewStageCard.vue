<template>
  <div class="flex flex-col gap-1.5 size-full">
    <div class="flex items-center justify-center w-full">
      <div
        ref="viewerHostEl"
        class="relative max-w-full rounded-md overflow-hidden border border-border-subtle bg-black"
        :style="viewerStyle"
      >
        <div
          v-if="!panoramaUrl"
          class="absolute inset-0 flex flex-col items-center justify-center gap-1.5
                 text-white/50 pointer-events-none"
        >
          <div class="text-[32px] opacity-60">🌐</div>
          <div class="text-xs text-center px-3">{{ $t('panoramaView.connectPanorama') }}</div>
        </div>
      </div>
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

    <div class="text-2xs text-center py-0.5">
      <span v-if="!panoramaUrl" class="text-muted-foreground">{{ $t('panoramaView.connectPanorama') }}</span>
      <span v-else-if="capturing" class="text-muted-foreground">{{ $t('panoramaView.capturing') }}</span>
      <span v-else-if="state.output" class="text-success-background">{{ $t('panoramaView.captured') }}</span>
      <span v-else class="text-muted-foreground">{{ $t('panoramaView.orbitToCapture') }}</span>
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
