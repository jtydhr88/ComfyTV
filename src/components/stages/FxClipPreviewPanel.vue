<template>
  <div class="clip-preview-bar">
    <button
      type="button"
      class="clip-preview-btn"
      :disabled="!enabled || preview.state.loading"
      @click="preview.request()"
    >
      <span v-if="preview.state.loading" class="clip-preview-spin" />
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.6" />
      </svg>
      {{ $t('fxPreview.run') }}
    </button>
    <span v-if="preview.state.error" class="clip-preview-note is-error">
      {{ $t('fxPreview.failed') }}
    </span>
    <span v-else-if="preview.state.stale" class="clip-preview-note is-stale">
      {{ $t('fxPreview.stale') }}
    </span>
    <span v-else-if="preview.state.url" class="clip-preview-note">
      {{ $t('fxPreview.window', { s: windowLabel }) }}
    </span>
  </div>

  <div v-if="preview.state.url" class="clip-preview-player">
    <VideoPlayerLite :source-video-url="preview.state.url" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import type { useFxClipPreview } from '@/composables/stages/useFxClipPreview'

const props = defineProps<{
  preview: ReturnType<typeof useFxClipPreview>
  enabled: boolean
}>()

const windowLabel = computed(() =>
  (props.preview.state.t1 - props.preview.state.t0).toFixed(1))
</script>

<style scoped>
.clip-preview-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.clip-preview-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.04);
  color: #d9d9de;
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
  appearance: none;
  user-select: none;
  flex: none;
}
.clip-preview-btn:hover:not(:disabled) {
  border-color: rgba(167, 139, 250, 0.55);
  background: rgba(167, 139, 250, 0.12);
}
.clip-preview-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.clip-preview-btn svg {
  width: 13px;
  height: 13px;
  opacity: 0.9;
}
.clip-preview-spin {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(167, 139, 250, 0.25);
  border-top-color: #a78bfa;
  animation: clip-preview-rot 0.7s linear infinite;
  flex: none;
}
@keyframes clip-preview-rot {
  to {
    transform: rotate(360deg);
  }
}
.clip-preview-note {
  font-size: 10px;
  color: #8b8b93;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.clip-preview-note.is-error {
  color: var(--destructive-background, #ef4444);
}
.clip-preview-note.is-stale {
  color: var(--warning-background, #f59e0b);
}
.clip-preview-player {
  height: 160px;
  display: flex;
  flex-direction: column;
  margin-top: 8px;
}
</style>
