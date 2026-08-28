<template>
  <div
    :class="[
      'ctv:w-full ctv:mt-1 ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-2 ctv:rounded ctv:text-xs',
      'ctv:bg-interface-menu-surface ctv:text-base-foreground ctv:border ctv:border-border-default',
      fileDrop.dragActive.value
        && 'ctv:outline ctv:outline-2 ctv:-outline-offset-2 ctv:outline-primary-background/70 ctv:bg-primary-background/5',
    ]"
    @keydown.escape.stop="$emit('close')"
    @dragenter="fileDrop.onDragEnter"
    @dragover="fileDrop.onDragOver"
    @dragleave="fileDrop.onDragLeave"
    @drop="fileDrop.onDrop"
  >
    <div v-if="hasBatch" class="ctv:flex ctv:gap-1 ctv:items-center">
      <button
        type="button"
        :class="tabClass(tab === 'batch')"
        @click="tab = 'batch'"
      >{{ $t('promptAssets.tabBatch') }}
        <span class="ctv:py-0 ctv:px-1 ctv:rounded-lg ctv:text-3xs ctv:bg-base-foreground/10">{{ batchCount }}</span>
      </button>
      <button
        type="button"
        :class="tabClass(tab === 'library')"
        @click="tab = 'library'"
      >{{ $t('promptAssets.tabLibrary') }}</button>
      <span class="ctv:flex-1"></span>
      <button
        type="button"
        :class="closeBtnClass"
        :title="$t('promptAssets.close')"
        @click="$emit('close')"
      ><i class="pi pi-times" /></button>
    </div>

    <div
      v-if="hasBatch && tab === 'batch'"
      class="comfytv-asset-scroll ctv:h-[224px] ctv:shrink-0 ctv:overflow-y-scroll ctv:flex ctv:flex-col ctv:gap-1.5"
    >
      <div v-for="group in batchGroups" :key="group.id" class="ctv:flex ctv:flex-col ctv:gap-1">
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-0.5">
          <i class="pi pi-thumbtack ctv:text-3xs ctv:text-muted-foreground" />
          <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground ctv:truncate">{{ group.label }}</span>
          <span class="ctv:text-3xs ctv:font-mono ctv:text-muted-foreground/60">{{ group.urls.length }}</span>
          <span class="ctv:flex-1"></span>
          <button
            v-if="group.canRefresh"
            type="button"
            :class="groupBtnClass"
            :title="$t('imageRefs.refreshBatch')"
            @click="$emit('refresh-batch', group.id)"
          ><i class="pi pi-refresh" /></button>
          <button
            type="button"
            :class="groupBtnClass"
            :title="$t('imageRefs.unpinBatch')"
            @click="$emit('unpin-batch', group.id)"
          ><i class="pi pi-times" /></button>
        </div>
        <div class="ctv:grid ctv:grid-cols-[repeat(auto-fill,minmax(64px,1fr))] ctv:gap-1">
          <button
            v-for="(url, i) in group.urls"
            :key="i"
            type="button"
            :class="[
              'ctv-hover-host ctv:relative ctv:flex ctv:flex-col ctv:p-0 ctv:cursor-pointer ctv:overflow-hidden ctv:rounded',
              'ctv:bg-secondary-background ctv:border ctv:[font-family:inherit]',
              isBatchAdded(group.id, i)
                ? 'ctv:border-primary-background'
                : 'ctv:border-border-subtle ctv:hover:border-primary-background/60',
            ]"
            :title="$t('imageRefs.batchItem', { n: i + 1 })"
            @click="$emit('select-batch', group.id, i)"
          >
            <ThumbImg
              :src="url"
              :thumb-max="THUMB_TILE"
              loading="lazy"
              :class="['ctv:block ctv:w-full ctv:aspect-square ctv:object-cover',
                       isBatchAdded(group.id, i) ? 'ctv:opacity-55' : '']"
            />
            <span
              v-if="isBatchAdded(group.id, i)"
              class="ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:flex ctv:items-center ctv:justify-center
                     ctv:size-4 ctv:rounded-full ctv:text-3xs ctv:leading-none
                     ctv:bg-primary-background ctv:text-white"
            ><i class="pi pi-check" /></span>
            <span class="ctv:w-full ctv:truncate ctv:py-0.5 ctv:px-1 ctv:text-left ctv:text-3xs ctv:text-muted-foreground">
              #{{ i + 1 }}
            </span>
            <ViewFullButton
              class="ctv:top-0.5 ctv:left-0.5"
              :items="batchLightboxItems(group)"
              :index="i"
            />
          </button>
        </div>
      </div>
    </div>

    <div v-show="!hasBatch || tab === 'library'" class="ctv:flex ctv:gap-1.5 ctv:items-center">
      <input
        ref="searchEl"
        v-model="query"
        type="text"
        :placeholder="$t('promptAssets.search')"
        class="ctv:flex-1 ctv:min-w-0 ctv:py-1 ctv:px-1.5 ctv:rounded-sm ctv:outline-none ctv:box-border
               ctv:text-xs ctv:leading-snug ctv:[font-family:inherit]
               ctv:bg-secondary-background ctv:text-base-foreground
               ctv:border ctv:border-border-default ctv:focus:border-primary-background"
      />
      <div v-if="showTypeFilter" class="ctv:w-20 ctv:shrink-0">
        <ComfyTVSelect
          :model-value="typeFilter"
          :options="typeOptions"
          @update:model-value="setTypeFilter"
        />
      </div>
      <div class="ctv:w-24 ctv:shrink-0">
        <ComfyTVSelect
          :model-value="filterValue"
          :options="categoryOptions"
          @update:model-value="setFilter"
        />
      </div>
      <button
        type="button"
        class="ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-6 ctv:shrink-0 ctv:cursor-pointer ctv:[font-family:inherit]
               ctv:rounded-sm ctv:border ctv:border-border-default ctv:leading-none
               ctv:bg-secondary-background ctv:text-muted-foreground
               ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground
               ctv:disabled:opacity-50 ctv:disabled:cursor-default"
        :disabled="uploading"
        :title="$t('promptAssets.upload')"
        @click="fileInput?.click()"
      ><IconUpload class="ctv:size-3.5" /></button>
      <button
        v-if="!hasBatch"
        type="button"
        :class="closeBtnClass"
        :title="$t('promptAssets.close')"
        @click="$emit('close')"
      ><i class="pi pi-times" /></button>
      <input
        ref="fileInput"
        type="file"
        :accept="uploadAccept"
        multiple
        class="ctv:hidden"
        @change="onPickFiles"
      />
    </div>

    <div v-show="!hasBatch || tab === 'library'"
         class="comfytv-asset-scroll ctv:h-[224px] ctv:shrink-0 ctv:overflow-y-scroll">
      <div v-if="filtered.length === 0"
           class="ctv:py-4 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
        {{ $t('promptAssets.empty') }}
      </div>
      <div v-else class="ctv:grid ctv:grid-cols-[repeat(auto-fill,minmax(64px,1fr))] ctv:gap-1">
        <button
          v-for="asset in filtered"
          :key="asset.id"
          type="button"
          :class="[
            'ctv-hover-host ctv:relative ctv:flex ctv:flex-col ctv:p-0 ctv:cursor-pointer ctv:overflow-hidden ctv:rounded',
            'ctv:bg-secondary-background ctv:border ctv:[font-family:inherit]',
            isAdded(asset.id)
              ? 'ctv:border-primary-background'
              : 'ctv:border-border-subtle ctv:hover:border-primary-background/60',
          ]"
          :title="asset.name"
          @click="$emit('select', asset)"
        >
          <div
            v-if="asset.media_type === 'video'"
            :class="['ctv:relative ctv:w-full ctv:aspect-square ctv:bg-black ctv:pointer-events-none',
                     isAdded(asset.id) ? 'ctv:opacity-55' : '']"
          >
            <ThumbImg
              :src="asset.payload_url"
              :thumb-max="THUMB_TILE"
              :alt="asset.name"
              loading="lazy"
              class="ctv:block ctv:size-full ctv:object-cover"
              draggable="false"
            />
            <i class="pi pi-play-circle ctv:absolute ctv:bottom-0.5 ctv:right-0.5 ctv:text-xs ctv:text-white/80 ctv:drop-shadow" />
          </div>
          <div
            v-else-if="asset.media_type === 'audio'"
            :class="['ctv:flex ctv:items-center ctv:justify-center ctv:w-full ctv:aspect-square ctv:text-muted-foreground',
                     isAdded(asset.id) ? 'ctv:opacity-55' : '']"
          ><i class="pi pi-volume-up ctv:text-lg" /></div>
          <div
            v-else-if="asset.media_type === 'text'"
            :class="['ctv:flex ctv:items-center ctv:justify-center ctv:w-full ctv:aspect-square ctv:text-muted-foreground',
                     isAdded(asset.id) ? 'ctv:opacity-55' : '']"
          ><i class="pi pi-file ctv:text-lg" /></div>
          <ThumbImg
            v-else
            :src="assetPreviewUrl(asset)"
            :thumb-max="THUMB_TILE"
            :alt="asset.name"
            loading="lazy"
            :class="['ctv:block ctv:w-full ctv:aspect-square ctv:object-cover',
                     isAdded(asset.id) ? 'ctv:opacity-55' : '']"
          />
          <span
            v-if="isAdded(asset.id)"
            class="ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:flex ctv:items-center ctv:justify-center
                   ctv:size-4 ctv:rounded-full ctv:text-3xs ctv:leading-none
                   ctv:bg-primary-background ctv:text-white"
          ><i class="pi pi-check" /></span>
          <span class="ctv:w-full ctv:truncate ctv:py-0.5 ctv:px-1 ctv:text-left ctv:text-3xs ctv:text-muted-foreground">
            {{ asset.name || '—' }}
          </span>
          <ViewFullButton
            v-if="asset.media_type === 'image'"
            class="ctv:top-0.5 ctv:left-0.5"
            :items="libraryLightboxItems"
            :index="libraryLightboxIndex(asset)"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconUpload from '~icons/lucide/upload'
import { computed, onMounted, ref } from 'vue'

import type { Asset } from '@/api/schemas'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import ThumbImg from '@/components/widgets/ThumbImg.vue'
import ViewFullButton from '@/components/ViewFullButton.vue'
import { importAssetFiles } from '@/composables/sidebar/assetImport'
import { toastLoaderUploadFailed, useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'
import { assetPreviewUrl } from '@/utils/assetMedia'
import { TEXT_FILE_EXTENSIONS } from '@/utils/mediaFileTypes'
import { THUMB_TILE } from '@/utils/thumbUrl'
import { useAssetPicker } from '@/composables/stages/useAssetPicker'

const props = defineProps<{
  addedIds?: number[]
  mediaTypes?: string[]
  batchGroups?: Array<{ id: string; label: string; urls: string[]; canRefresh: boolean }>
  addedBatchKeys?: string[]
}>()

const emit = defineEmits<{
  select: [asset: Asset]
  'select-batch': [groupId: string, index: number]
  'refresh-batch': [id: string]
  'unpin-batch': [id: string]
  close: []
}>()

const batchGroups = computed(() => props.batchGroups ?? [])
const hasBatch = computed(() => batchGroups.value.length > 0)
const batchCount = computed(() =>
  batchGroups.value.reduce((n, g) => n + g.urls.length, 0))
const tab = ref<'batch' | 'library'>('batch')

function isBatchAdded(groupId: string, index: number): boolean {
  return (props.addedBatchKeys ?? []).includes(`${groupId}:${index}`)
}

function batchLightboxItems(group: { label: string; urls: string[] }) {
  return group.urls.map((url, i) => ({ url, label: `${group.label} #${i + 1}` }))
}

const libraryImageAssets = computed(() =>
  filtered.value.filter((a) => a.media_type === 'image'))
const libraryLightboxItems = computed(() =>
  libraryImageAssets.value.map((a) => ({ url: a.payload_url, label: a.name })))

function libraryLightboxIndex(asset: Asset): number {
  return Math.max(0, libraryImageAssets.value.findIndex((a) => a.id === asset.id))
}

const groupBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-4.5 ctv:cursor-pointer ctv:[font-family:inherit]',
  'ctv:rounded-sm ctv:border ctv:border-transparent ctv:text-3xs ctv:leading-none',
  'ctv:bg-transparent ctv:text-muted-foreground',
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground',
].join(' ')

const closeBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-6 ctv:shrink-0 ctv:cursor-pointer ctv:[font-family:inherit]',
  'ctv:rounded-sm ctv:border ctv:border-transparent ctv:text-xs ctv:leading-none',
  'ctv:bg-transparent ctv:text-muted-foreground',
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground',
].join(' ')

function tabClass(active: boolean): string {
  return [
    'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]',
    'ctv:rounded-lg ctv:border ctv:border-transparent ctv:py-0.5 ctv:px-2 ctv:text-2xs ctv:transition-colors',
    active
      ? 'ctv:bg-interface-menu-component-surface-selected ctv:text-base-foreground ctv:font-semibold'
      : 'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:text-base-foreground',
  ].join(' ')
}

const searchEl = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

const uploadAccept = computed(() =>
  (props.mediaTypes ?? ['image'])
    .map(t => (t === 'text' ? TEXT_FILE_EXTENSIONS.join(',') : `${t}/*`))
    .join(','),
)

const {
  query,
  filter,
  filterValue,
  categoryOptions,
  setFilter,
  typeFilter,
  typeOptions,
  showTypeFilter,
  setTypeFilter,
  filtered,
  isAdded,
  ensureHydrated,
} = useAssetPicker(() => props.addedIds ?? [], props.mediaTypes ?? ['image'])

async function uploadFiles(files: File[]): Promise<void> {
  uploading.value = true
  try {
    const created = await importAssetFiles(files, {
      categoryIds: typeof filter.value === 'number' ? [filter.value] : [],
    })
    for (const asset of created) emit('select', asset)
  } catch (e) {
    console.error('[ComfyTV/asset-picker] upload failed', e)
    toastLoaderUploadFailed(e)
  } finally {
    uploading.value = false
  }
}

function onPickFiles(e: Event): void {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) void uploadFiles(files)
}

const fileDrop = useLoaderFileDrop({
  kind: () => 'image',
  onAsset: (asset) => emit('select', asset),
  onFiles: uploadFiles,
})

onMounted(() => {
  ensureHydrated()
  searchEl.value?.focus()
})
</script>

<style>
.comfytv-asset-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}
.comfytv-asset-scroll::-webkit-scrollbar {
  width: 10px;
}
.comfytv-asset-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.comfytv-asset-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.35);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.comfytv-asset-scroll:hover::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.55);
}
</style>
