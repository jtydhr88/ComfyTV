<template>
  <div class="fxc" @pointerdown.stop @pointermove.stop @pointerup.stop>
    <FxCardShell :node="node">
      <template #player>
    <div class="fxc__stage">
      <div v-show="mode === 'live'" class="fxc__live">
        <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl">
          <template #overlay>
            <canvas v-show="supported" ref="previewCanvas" class="fxc__canvas" />
          </template>
        </VideoPlayerLite>
        <div v-if="!sourceVideoUrl" class="fxc__hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="M10 9.5l5 2.5-5 2.5z" />
          </svg>
          <span>{{ t('v2.fxChainHint') }}</span>
        </div>
      </div>
      <div v-if="mode === 'output' && outputUrl" class="fxc__outwrap">
        <ProxiedVideo
          :src="outputUrl"
          class="fxc__out"
          controls
          playsinline
          preload="metadata"
        />
      </div>
      <div v-if="outputUrl" class="fxc__mode">
        <button type="button" :data-on="mode === 'live' ? '1' : ''" @click.stop="mode = 'live'">
          {{ t('v2.livePreview') }}
        </button>
        <button type="button" :data-on="mode === 'output' ? '1' : ''" @click.stop="mode = 'output'">
          {{ t('v2.outputLabel') }}
        </button>
      </div>
      <div v-if="mode === 'output' && outputUrl" class="fxc__corner">
        <button type="button" :title="t('stage.action.download')" @click.stop="onDownload">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3.5V15M7 10.5l5 5 5-5M4 19.5h16" />
          </svg>
        </button>
        <button type="button" :data-done="saved ? '1' : ''" :title="t('stage.action.loadAsset')" @click.stop="onSave">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6.5 3.5h11a1 1 0 011 1V21l-6.5-4-6.5 4V4.5a1 1 0 011-1z" />
          </svg>
        </button>
      </div>
    </div>
      </template>

    <div class="fxc__panel">
      <div class="fxc__chain">
        <template v-if="rows.length">
          <div
            v-for="row in rows"
            :key="row.ordinal"
            class="fxc__chip"
            :data-nopreview="row.preview ? '' : '1'"
            :title="row.preview ? row.kind : `${row.kind} · ${t('fxChain.noPreview')}`"
          >
            <span class="fxc__ord">{{ row.ordinal }}</span>
            <span class="fxc__name">{{ row.label }}</span>
            <span v-if="!row.preview" class="fxc__nodot" />
          </div>
        </template>
        <div v-else class="fxc__empty">{{ t('fxChain.empty') }}</div>
      </div>

      <div class="fxc__delivery">
        <button type="button" class="fxc__dtoggle" @click.stop="deliveryOpen = !deliveryOpen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               :style="{ transform: deliveryOpen ? 'rotate(90deg)' : '' }">
            <path d="M9 5l7 7-7 7" />
          </svg>
          <span>{{ t('fxChain.delivery') }}</span>
          <span class="fxc__dsummary">{{ deliverySummary }}</span>
        </button>
        <div v-if="deliveryOpen" class="fxc__drows">
          <div class="fxc__drow">
            <span class="fxc__dlabel">{{ t('fxChain.dSize') }}</span>
            <FxChips v-model="outSize" :options="SIZES" />
          </div>
          <div class="fxc__drow">
            <span class="fxc__dlabel">{{ t('fxChain.dFps') }}</span>
            <FxChips v-model="outFps" :options="FPS_OPTS" />
          </div>
          <div class="fxc__drow">
            <span class="fxc__dlabel">{{ t('fxChain.dCodec') }}</span>
            <FxChips v-model="outCodec" :options="CODECS" />
          </div>
          <div class="fxc__drow">
            <span class="fxc__dlabel">{{ t('fxChain.dQuality') }}</span>
            <FxChips v-model="outQuality" :options="QUALITIES" />
          </div>
          <div class="fxc__drow">
            <span class="fxc__dlabel">{{ t('fxChain.dColorspace') }}</span>
            <FxChips v-model="outColorspace" :options="CS_TARGETS" />
          </div>
        </div>
      </div>

      <div class="fxc__footer">
        <span class="fxc__flabel">{{ t('v2.renderChain') }}</span>
        <span class="fxc__fspacer" />
        <ServerSelectV2 :get-node="() => node" :state="state" />
        <button
          type="button"
          class="v2-run"
          :data-busy="state.running ? '1' : ''"
          @pointerdown.stop
          @click.stop="onRunClick"
        >
          <span class="v2-run__up">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" /></svg>
          </span>
          <span class="v2-run__stop">
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
          </span>
        </button>
      </div>
    </div>
    </FxCardShell>
  </div>
</template>

<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FxCardShell from '@/components/stages/FxCardShell.vue'
import ProxiedVideo from '@/components/widgets/ProxiedVideo.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import ServerSelectV2 from '@/v2/ServerSelectV2.vue'
import { ChainBlitRenderer } from '@/composables/stages/fxChainPreviewRegistry'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useChainedFxPreview } from '@/composables/stages/useChainedFxPreview'
import { useFxChain } from '@/composables/stages/useFxChain'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{
  node: LGraphNode
  state: StageState
  onAction: (id: string, context?: unknown) => void
  onRunRequest: () => void
  onCancelRequest: () => void
}>()

function onRunClick() {
  if (props.state.running) props.onCancelRequest()
  else props.onRunRequest()
}

const { t } = useI18n()

const { rows } = useFxChain(props.node, () => props.state)

const src = () => ({ value: 'source', label: t('fxChain.sourceOpt') })
const CS_TARGETS = ['bt709', 'bt601-6-625', 'bt2020', 'smpte170m']
  .map(v => ({ value: v, label: v }))
const SIZES = computed(() => [src(),
  ...['2160', '1440', '1080', '720', '540', '480']
    .map(v => ({ value: v, label: `${v}p` }))])
const FPS_OPTS = computed(() => [src(),
  ...['24', '25', '30', '50', '60'].map(v => ({ value: v, label: v }))])
const CODECS = [
  { value: 'h264', label: 'H.264' },
  { value: 'hevc', label: 'HEVC' },
  { value: 'prores', label: 'ProRes' },
]
const QUALITIES = computed(() => [
  { value: 'draft', label: t('fxChain.qDraft') },
  { value: 'standard', label: t('fxChain.qStandard') },
  { value: 'high', label: t('fxChain.qHigh') },
])
const outColorspace = useStrWidget(props.node, 'out_colorspace', 'bt709')
const outSize = useStrWidget(props.node, 'out_size', 'source')
const outFps = useStrWidget(props.node, 'out_fps', 'source')
const outCodec = useStrWidget(props.node, 'out_codec', 'h264')
const outQuality = useStrWidget(props.node, 'out_quality', 'standard')

const deliveryOpen = ref(false)
const deliverySummary = computed(() => {
  const size = outSize.value === 'source' ? t('fxChain.sourceOpt') : `${outSize.value}p`
  const fps = outFps.value === 'source' ? '' : ` · ${outFps.value}fps`
  return `${size}${fps} · ${String(outCodec.value).toUpperCase()}`
})

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const videoEl = computed<HTMLVideoElement | null>(() => playerRef.value?.videoEl ?? null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

const { supported } = useChainedFxPreview({
  videoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  node: props.node,
  params: () => ({}),
  createRenderer: () => new ChainBlitRenderer(),
})

const outputUrl = computed(() => String(props.state.output ?? '') || null)
const mode = ref<'live' | 'output'>('live')
watch(outputUrl, (url, prev) => {
  if (url && url !== prev) mode.value = 'output'
})

function onDownload() {
  const url = outputUrl.value
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = decodeURIComponent(url.split('filename=')[1]?.split('&')[0] || 'output.mp4')
  a.click()
}

const saved = ref(false)
const savedFlash = useTimeoutFn(() => { saved.value = false }, 1200, { immediate: false })
function onSave() {
  const url = outputUrl.value
  if (!url) return
  const label = decodeURIComponent(url.split('filename=')[1]?.split('&')[0] || 'video')
  props.onAction('load-asset', { imageUrl: url, label, mediaType: 'video' })
  saved.value = true
  savedFlash.stop()
  savedFlash.start()
}
</script>

<style scoped>
.fxc {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}
.fxc__stage {
  position: relative;
  flex: 1;
  min-height: 180px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--v2-media-bg);
  border: 1px solid var(--v2-media-border);
}
.fxc__live,
.fxc__outwrap {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}
.fxc__live :deep(video),
.fxc__outwrap :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.fxc__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.fxc__out { width: 100%; height: 100%; }
.fxc__hint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--v2-text-faint);
  font: 500 12px/1.5 system-ui, sans-serif;
  pointer-events: none;
}
.fxc__hint svg { width: 26px; height: 26px; opacity: 0.55; }
.fxc__mode {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  display: flex;
  padding: 2px;
  border-radius: 999px;
  background: rgba(20, 20, 24, 0.72);
  backdrop-filter: blur(4px);
}
.fxc__mode button {
  border: none;
  padding: 4px 10px;
  border-radius: 999px;
  background: transparent;
  color: #9a9aa2;
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.fxc__mode button[data-on='1'] {
  background: rgba(255, 255, 255, 0.14);
  color: #ececf1;
}
.fxc__corner {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.fxc__stage:hover .fxc__corner { opacity: 1; }
@media (hover: none) {
  .fxc__corner { opacity: 1; }
}
.fxc__corner button {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: rgba(20, 20, 24, 0.66);
  backdrop-filter: blur(4px);
  color: #ececf1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.fxc__corner button:hover { background: rgba(20, 20, 24, 0.9); }
.fxc__corner button svg { width: 13px; height: 13px; }
.fxc__corner button[data-done='1'] {
  background: var(--v2-accent);
  color: var(--v2-run-fg);
}
.fxc__chain {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.fxc__chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 6px;
  border-radius: 999px;
  background: var(--v2-chip-bg);
  border: 1px solid var(--v2-chip-border);
  font: 500 11px/1 system-ui, sans-serif;
  color: var(--v2-text-mid);
  max-width: 170px;
}
.fxc__ord {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--v2-accent-soft);
  color: var(--v2-accent);
  font: 600 10px/1 system-ui, sans-serif;
  flex: none;
}
.fxc__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.fxc__nodot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--v2-text-faint);
  flex: none;
}
.fxc__chip[data-nopreview='1'] { color: var(--v2-text-muted); }
.fxc__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  border-radius: 12px;
  border: 1px dashed var(--v2-chip-border);
  color: var(--v2-text-faint);
  font: 500 11px/1.5 system-ui, sans-serif;
  text-align: center;
}
.fxc__panel {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
  box-shadow: var(--v2-slab-shadow);
}
.fxc__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--v2-text-mid);
  font: 500 12px/1 system-ui, sans-serif;
}
.fxc__flabel { flex: none; }
.fxc__fspacer { flex: 1; }
.fxc__delivery {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fxc__dtoggle {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  border: none;
  padding: 4px 8px;
  border-radius: 8px;
  background: transparent;
  color: var(--v2-text-muted);
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.fxc__dtoggle:hover { background: var(--v2-hover-bg); color: var(--v2-text-mid); }
.fxc__dtoggle svg { width: 11px; height: 11px; transition: transform 0.15s ease; }
.fxc__dsummary {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--v2-hover-bg);
  font-size: 10px;
  color: var(--v2-text-mid);
}
.fxc__drows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0 0;
}
.fxc__drow {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fxc__dlabel {
  flex: none;
  width: 62px;
  color: var(--v2-text-faint);
  font: 500 10px/1 system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.fxc__drow :deep(button) {
  font-size: 10px;
  border-radius: 999px;
}
</style>
