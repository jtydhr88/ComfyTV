<template>
  <div
    class="v2-al"
    :class="{ 'v2-al--drag': fileDrop.dragActive.value }"
    @dragenter="fileDrop.onDragEnter"
    @dragover="fileDrop.onDragOver"
    @dragleave="fileDrop.onDragLeave"
    @drop="fileDrop.onDrop"
  >
    <div class="v2-al__preview" @pointerdown.stop @click="mediaType !== 'model' && (open = !open)">
      <MediaPreviewV2
        :kind="mediaType"
        :url="previewUrl"
        :text="previewText"
        :hint="$t('v2.assetLoaderHint')"
        :on-capture-view="mediaType === 'model' && onAction ? onModelCaptured : undefined"
      />
    </div>
    <div class="v2-al__footer" @pointerdown.stop>
      <span v-if="selectedAsset?.file_missing" class="v2-al__name v2-al__name--missing">
        ⚠ {{ selectedAsset.name || '—' }}
      </span>
      <span v-else class="v2-al__name">{{ selectedAsset?.name ?? $t('v2.assetLoaderEmpty') }}</span>
      <span class="v2-al__spacer" />
      <button type="button" class="v2-al__btn" @click.stop="open = !open">
        {{ $t('v2.change') }}
      </button>
      <button type="button" class="v2-al__btn" :title="$t('v2.upload')" @click.stop="fileInput?.click()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 16V4M7.5 8.5L12 4l4.5 4.5M4 19.5h16" />
        </svg>
      </button>
      <input ref="fileInput" type="file" :accept="fileAccept" multiple class="v2-al__file" @change="onPickFiles" />
    </div>
  </div>
  <AssetPickerPopup
    v-if="open"
    :added-ids="addedIds"
    :media-types="[mediaType]"
    @select="onSelect"
    @close="open = false"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { Asset } from '@/api/schemas'
import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import { useAssetLoaderCard } from '@/composables/stages/useAssetLoaderCard'
import type { LGraphNode } from '@/lib/comfyApp'
import { assetPreviewUrl } from '@/utils/assetMedia'
import MediaPreviewV2 from '@/v2/MediaPreviewV2.vue'
import { TEXT_FILE_EXTENSIONS } from '@/utils/mediaFileTypes'
import { MODEL_FILE_EXTENSIONS } from '@/widgets/three/modelFormats'
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{
  node: LGraphNode
  state: StageState
  onAction?: (id: string, context?: any) => void
}>()

function onModelCaptured(url: string) {
  props.onAction?.('model-capture-view', { index: '', imageUrl: url, mediaType: 'image' })
}

const open = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const { mediaType, selectedAsset, selectAsset, importFiles, fileDrop } =
  useAssetLoaderCard(props.node, () => props.state)

const addedIds = computed(() => (selectedAsset.value ? [selectedAsset.value.id] : []))

const previewUrl = computed(() => {
  const a = selectedAsset.value
  if (!a || mediaType.value === 'text') return null
  return mediaType.value === 'image' ? assetPreviewUrl(a) : a.payload_url
})

const previewText = ref('')
watch(
  () => (mediaType.value === 'text' ? selectedAsset.value?.payload_url ?? '' : ''),
  (url) => {
    previewText.value = ''
    if (!url) return
    void fetch(url)
      .then(r => (r.ok ? r.text() : ''))
      .then(txt => { previewText.value = txt })
      .catch(() => {})
  },
  { immediate: true },
)

const fileAccept = computed(() =>
  mediaType.value === 'model' ? MODEL_FILE_EXTENSIONS.join(',')
  : mediaType.value === 'text' ? TEXT_FILE_EXTENSIONS.join(',')
  : `${mediaType.value}/*`)

function onSelect(asset: Asset) {
  selectAsset(asset)
  open.value = false
}

function onPickFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) void importFiles(files)
}
</script>

<style scoped>
.v2-al {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  border-radius: 12px;
}
.v2-al--drag {
  outline: 2px dashed color-mix(in srgb, var(--v2-accent) 75%, transparent);
  outline-offset: -2px;
}
.v2-al__preview {
  position: relative;
  flex: 1;
  min-height: 170px;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.v2-al__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.v2-al__hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--v2-text-faint);
  font: 500 12px/1.5 system-ui, sans-serif;
}
.v2-al__hint svg { width: 26px; height: 26px; opacity: 0.55; }
.v2-al__footer {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 14px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
  color: var(--v2-text-muted);
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-al__name {
  color: var(--v2-text-mid);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.v2-al__name--missing { color: #f87171; }
.v2-al__spacer { flex: 1; }
.v2-al__btn {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--v2-chip-bg);
  color: var(--v2-text-mid);
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-al__btn:hover { background: var(--v2-hover-bg); color: var(--v2-text-strong); }
.v2-al__btn svg { width: 12px; height: 12px; }
.v2-al__file { display: none; }
</style>
