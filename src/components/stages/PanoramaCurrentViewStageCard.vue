<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:flex ctv:items-center ctv:justify-center ctv:w-full">
      <div
        ref="viewerHostEl"
        class="ctv:relative ctv:max-w-full ctv:rounded-md ctv:overflow-hidden ctv:border ctv:border-border-subtle ctv:bg-black"
        :style="viewerStyle"
      >
        <div
          v-if="!panoramaUrl"
          class="ctv:absolute ctv:inset-0 ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5
                 ctv:text-white/50 ctv:pointer-events-none"
        >
          <i class="pi pi-globe ctv:text-[32px] ctv:opacity-60" />
          <div class="ctv:text-xs ctv:text-center ctv:px-3">{{ $t('panoramaView.connectPanorama') }}</div>
        </div>
      </div>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-2 ctv:flex-wrap">
      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('panoramaView.aspect') }}</span>
        <span class="ctv-pano-select-wrap">
          <select v-model="aspectRatio" class="ctv-pano-select">
            <option v-for="opt in aspectOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <i class="pi pi-chevron-down ctv-pano-caret" />
        </span>
      </div>
      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('panoramaView.resolution') }}</span>
        <span class="ctv-pano-select-wrap">
          <select v-model="resolution" class="ctv-pano-select">
            <option v-for="opt in resolutionOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <i class="pi pi-chevron-down ctv-pano-caret" />
        </span>
      </div>
      <span class="ctv:ml-auto ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">{{ captureSize.w }}×{{ captureSize.h }}</span>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5">
      <span v-if="!panoramaUrl" class="ctv:text-muted-foreground">{{ $t('panoramaView.connectPanorama') }}</span>
      <span v-else-if="capturing" class="ctv:text-muted-foreground">{{ $t('panoramaView.capturing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('panoramaView.captured') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('panoramaView.orbitToCapture') }}</span>
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
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { parseAspect } from '@/utils/panoramaProjection'
import {
  ASPECT_RATIOS as aspectOptions,
  RESOLUTIONS as resolutionOptions,
} from '@/utils/sizing'
import { readWidgetStr } from '@/utils/widget'

const VIEWER_HEIGHT_PX = 300

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const viewerHostEl = ref<HTMLDivElement | null>(null)
const aspectRatio = ref<string>(readWidgetStr(props.node, 'aspect_ratio', '16:9'))
const resolution  = ref<string>(readWidgetStr(props.node, 'resolution',   '1K'))

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
.ctv-pano-select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.ctv-pano-caret {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 8px;
  color: var(--muted-foreground, rgb(255 255 255 / 0.5));
  pointer-events: none;
}
.ctv-pano-select {
  appearance: none;
  background-color: var(--secondary-background, rgb(255 255 255 / 0.04));
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
