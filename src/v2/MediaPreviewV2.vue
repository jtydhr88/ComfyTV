<template>
  <div class="v2-mp" :data-kind="kind">
    <template v-if="kind === 'video'">
      <ProxiedVideo
        v-if="resolvedUrl"
        :src="url!"
        class="v2-mp__video"
        controls
        muted
        playsinline
        preload="metadata"
        @pointerdown.stop
      />
    </template>
    <template v-else-if="kind === 'audio'">
      <div v-if="resolvedUrl" class="v2-mp__audiowrap" @pointerdown.stop>
        <svg class="v2-mp__audioicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 8v8" />
        </svg>
        <audio :src="resolvedUrl" controls preload="metadata" class="v2-mp__audio" />
      </div>
    </template>
    <template v-else-if="kind === 'text'">
      <div v-if="text" class="v2-mp__text" @pointerdown.stop @wheel.stop>{{ text }}</div>
    </template>
    <template v-else-if="kind === 'model'">
      <div v-if="url" class="v2-mp__model" @pointerdown.stop @wheel.stop>
        <ModelPreview ref="modelPreviewEl" :src="url" @view-changed="onModelViewChanged" />
      </div>
    </template>
    <template v-else>
      <img v-if="resolvedUrl" class="v2-mp__img" :src="resolvedUrl" draggable="false" />
      <span v-if="batchCount > 1" class="v2-mp__count">{{ batchCount }}</span>
    </template>
    <div v-if="!hasContent" class="v2-mp__hint">
      <slot name="hint-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <path d="M9 9.5l7 3.5-7 3.5z" />
        </svg>
      </slot>
      <span>{{ hint }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import ModelPreview from '@/components/stages/ModelPreview.vue'
import ProxiedVideo from '@/components/widgets/ProxiedVideo.vue'
import { useModelViewCapture } from '@/composables/stages/useModelViewCapture'
import { app } from '@/lib/comfyApp'

const props = defineProps<{
  kind: 'image' | 'video' | 'audio' | 'text' | 'model'
  url?: string | null
  text?: string | null
  hint: string
  onCaptureView?: (url: string) => void
}>()

const MODEL_CAPTURE_SIZE = 1024
const MODEL_CAPTURE_DELAY_MS = 250

const modelPreviewEl = ref<InstanceType<typeof ModelPreview> | null>(null)

const { scheduleCapture } = useModelViewCapture({
  getCanvas: () => modelPreviewEl.value?.captureCanvas(MODEL_CAPTURE_SIZE, MODEL_CAPTURE_SIZE),
  filenamePrefix: 'comfytv-model-view',
  logTag: 'MediaPreviewV2',
  delayMs: MODEL_CAPTURE_DELAY_MS,
  onCaptured: (url) => props.onCaptureView?.(url),
})

function onModelViewChanged() {
  if (props.onCaptureView) scheduleCapture()
}

const batchImages = computed<string[]>(() => {
  if (props.kind !== 'image') return []
  const u = String(props.url ?? '')
  if (!u.trimStart().startsWith('{')) return []
  try {
    const parsed = JSON.parse(u)
    const items = Array.isArray(parsed?.images) ? parsed.images : []
    return items.map((x: any) => String(x?.image_url ?? '')).filter(Boolean)
  } catch {
    return []
  }
})

const batchCount = computed(() => batchImages.value.length)

const resolvedUrl = computed(() => {
  const u = batchImages.value[0] ?? String(props.url ?? '')
  if (!u || u.trimStart().startsWith('{')) return ''
  return (app as any).api.apiURL(u.replace(/^\/api/, ''))
})

const hasContent = computed(() =>
  props.kind === 'text' ? !!String(props.text ?? '').trim()
  : props.kind === 'model' ? !!props.url
  : !!resolvedUrl.value)
</script>

<style scoped>
.v2-mp {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--v2-media-bg);
  border: 1px solid var(--v2-media-border);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}
.v2-mp[data-kind="image"] {
  background: var(--v2-checker);
  background-size: 18px 18px;
}
.v2-mp__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.v2-mp__video,
.v2-mp :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.v2-mp__audiowrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
  padding: 0 16px;
  box-sizing: border-box;
}
.v2-mp__audioicon {
  width: 40px;
  height: 40px;
  color: var(--v2-text-muted);
}
.v2-mp__audio {
  width: 100%;
  max-width: 340px;
  height: 34px;
}
.v2-mp__model {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  color: var(--v2-text-faint);
  cursor: grab;
}
.v2-mp__model:active { cursor: grabbing; }
.v2-mp__model :deep(> *) {
  flex: 1;
  min-height: 0;
  width: 100%;
}
.v2-mp__text {
  position: absolute;
  inset: 0;
  padding: 12px 14px;
  overflow-y: auto;
  color: var(--v2-text-mid);
  font: 400 12px/1.7 system-ui, sans-serif;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
  cursor: text;
  user-select: text;
}
.v2-mp__hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--v2-text-faint);
  font: 500 12px/1.5 system-ui, sans-serif;
}
.v2-mp__hint svg { width: 26px; height: 26px; opacity: 0.55; }
.v2-mp__count {
  position: absolute;
  right: 8px;
  top: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(23, 23, 27, 0.75);
  color: #cdbdfc;
  font: 600 10px/1 system-ui, sans-serif;
}
</style>
