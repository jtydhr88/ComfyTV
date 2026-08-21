<template>
  <div
    class="v2-al"
    :class="{ 'v2-al--drag': fileDrop.dragActive.value }"
    @dragenter="fileDrop.onDragEnter"
    @dragover="fileDrop.onDragOver"
    @dragleave="fileDrop.onDragLeave"
    @drop="fileDrop.onDrop"
  >
    <div class="v2-al__preview" @pointerdown.stop @click="open = !open">
      <img
        v-if="selectedAsset"
        class="v2-al__img"
        :src="assetPreviewUrl(selectedAsset)"
        :alt="selectedAsset.name"
        draggable="false"
      />
      <div v-else class="v2-al__hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M20 12.5v5A2.5 2.5 0 0117.5 20h-11A2.5 2.5 0 014 17.5v-11A2.5 2.5 0 016.5 4h5" />
          <path d="M15.5 4H20v4.5M20 4l-8.5 8.5" />
        </svg>
        <span>{{ $t('v2.assetLoaderHint') }}</span>
      </div>
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
      <input ref="fileInput" type="file" accept="image/*" multiple class="v2-al__file" @change="onPickFiles" />
    </div>
  </div>
  <AssetPickerPopup
    v-if="open"
    :added-ids="addedIds"
    :media-types="['image']"
    @select="onSelect"
    @close="open = false"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Asset } from '@/api/schemas'
import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import { useAssetLoaderCard } from '@/composables/stages/useAssetLoaderCard'
import type { LGraphNode } from '@/lib/comfyApp'
import { assetPreviewUrl } from '@/utils/assetMedia'
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{
  node: LGraphNode
  state: StageState
}>()

const open = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const { selectedAsset, selectAsset, importFiles, fileDrop } =
  useAssetLoaderCard(props.node, () => props.state)

const addedIds = computed(() => (selectedAsset.value ? [selectedAsset.value.id] : []))

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
  outline: 2px dashed rgba(167, 139, 250, 0.75);
  outline-offset: -2px;
}
.v2-al__preview {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);
  border: 1px solid rgba(255, 255, 255, 0.07);
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
  color: #6b6b74;
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
  background: #232327;
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: #8f8f98;
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-al__name {
  color: #b9b9c0;
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
  background: rgba(255, 255, 255, 0.06);
  color: #b9b9c0;
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-al__btn:hover { background: rgba(255, 255, 255, 0.12); color: #ececf1; }
.v2-al__btn svg { width: 12px; height: 12px; }
.v2-al__file { display: none; }
</style>
