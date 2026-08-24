<template>
  <div
    :class="[
      'ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full ctv:p-2 ctv:box-border ctv:text-xs ctv:text-base-foreground',
      fileDrop.dragActive.value
        && 'ctv:rounded ctv:outline ctv:outline-2 ctv:-outline-offset-2 ctv:outline-primary-background/70 ctv:bg-primary-background/5',
    ]"
    @dragenter="fileDrop.onDragEnter"
    @dragover="fileDrop.onDragOver"
    @dragleave="fileDrop.onDragLeave"
    @drop="fileDrop.onDrop"
    @keydown="onNavKeydown"
  >
    <div class="ctv:shrink-0 ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1">
      <button :class="chipClass(activeFilter === 'all')" @click="setFilter('all')">
        {{ $t('assets.category.all') }}
        <span :class="chipCountClass">{{ mediaCount('all') }}</span>
      </button>
      <button :class="chipClass(activeFilter === 'none')" @click="setFilter('none')">
        {{ $t('assets.category.none') }}
        <span :class="chipCountClass">{{ mediaCount('none') }}</span>
      </button>
      <button
        v-for="cat in store.categories"
        :key="cat.id"
        :class="chipClass(activeFilter === cat.id)"
        @click="setFilter(cat.id)"
      >
        {{ cat.name }}
        <span :class="chipCountClass">{{ mediaCount(cat.id) }}</span>
      </button>
      <button
        type="button"
        class="ctv:ml-auto ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-6 ctv:shrink-0 ctv:cursor-pointer ctv:[font-family:inherit]
               ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:leading-none
               ctv:bg-secondary-background ctv:text-muted-foreground
               ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground"
        :title="$t('assetLoader.upload')"
        @click="fileInput?.click()"
      ><IconUpload class="ctv:size-3.5" /></button>
      <input
        ref="fileInput"
        type="file"
        :accept="fileAccept"
        multiple
        class="ctv:hidden"
        @change="onPickFiles"
      />
    </div>

    <div class="ctv:flex-1 ctv:min-h-0 ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-black/20" @wheel.stop>
      <div v-if="visibleAssets.length === 0"
           class="ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
        {{ activeFilter === 'all' ? $t('assetLoader.empty') : $t('assets.emptyCategory') }}
      </div>

      <div v-else ref="gridEl">
        <VirtualGrid
          :items="gridItems"
          :grid-style="{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: '6px',
          }"
          :default-item-height="110"
          :default-item-width="86"
          class="ctv-scroll-thin ctv:max-h-80 ctv:p-1.5"
        >
          <template #item="{ item, index }">
            <button
              type="button"
              :data-asset-id="item.asset.id"
              :class="[
                'ctv:group ctv-hover-host ctv:relative ctv:w-full ctv:rounded-lg ctv:overflow-hidden ctv:cursor-pointer ctv:p-0 ctv:border ctv:bg-secondary-background ctv:transition-colors',
                item.asset.id === selectedId
                  ? 'ctv:border-primary-background ctv:ring-2 ctv:ring-primary-background/50'
                  : 'ctv:border-border-subtle ctv:hover:border-border-default',
              ]"
              :title="assetTooltip(item.asset)"
              @click="selectAsset(item.asset)"
            >
              <div
                v-if="mediaType === 'video'"
                class="ctv:relative ctv:w-full ctv:aspect-square ctv:bg-black"
              >
                <ThumbImg
                  :src="item.asset.payload_url"
                  :thumb-max="THUMB_CELL"
                  :alt="item.asset.name"
                  loading="lazy"
                  class="ctv:block ctv:size-full ctv:object-cover"
                  draggable="false"
                />
                <i class="pi pi-play-circle ctv:absolute ctv:bottom-1 ctv:right-1 ctv:text-sm ctv:text-white/80 ctv:pointer-events-none ctv:drop-shadow" />
              </div>
              <div
                v-else-if="mediaType === 'audio'"
                class="ctv:flex ctv:items-center ctv:justify-center ctv:w-full ctv:aspect-square ctv:text-2xl
                       ctv:bg-secondary-background-hover ctv:text-muted-foreground"
              ><i class="pi pi-volume-up" /></div>
              <div
                v-else-if="mediaType === 'model'"
                class="ctv:relative ctv:w-full ctv:aspect-square ctv:bg-secondary-background-hover"
              >
                <ModelThumb :src="item.asset.payload_url" :alt="item.asset.name">
                  <i class="pi pi-box ctv:text-2xl" />
                </ModelThumb>
              </div>
              <ThumbImg
                v-else
                :src="assetPreviewUrl(item.asset)"
                :thumb-max="THUMB_CELL"
                :alt="item.asset.name"
                loading="lazy"
                class="ctv:block ctv:w-full ctv:aspect-square ctv:object-cover"
                draggable="false"
              />
              <div class="ctv:truncate ctv:py-0.5 ctv:px-1 ctv:text-2xs ctv:text-left ctv:text-muted-foreground">
                <span
                  v-if="item.asset.file_missing"
                  class="ctv:text-destructive-background"
                  :title="$t('assets.card.fileMissingHint')"
                >⚠</span>
                {{ item.asset.name || '—' }}
              </div>
              <span
                v-if="item.asset.id === selectedId"
                class="ctv:absolute ctv:top-1 ctv:right-1 ctv:flex ctv:items-center ctv:justify-center ctv:size-4 ctv:rounded-full
                       ctv:bg-primary-background ctv:text-base-foreground ctv:text-3xs ctv:font-bold ctv:shadow"
              ><i class="pi pi-check" /></span>
              <ViewFullButton
                v-if="mediaType === 'image'"
                class="ctv:top-1 ctv:left-1"
                :items="gridLightboxItems"
                :index="index"
              />
            </button>
          </template>
        </VirtualGrid>
      </div>
    </div>

    <div
      v-if="mediaType !== 'model' && previewContent"
      :class="mediaType === 'audio'
        ? 'ctv:shrink-0'
        : 'ctv-al-fill ctv:flex-1 ctv:min-h-0'"
    >
      <ValuePreview
        :class="mediaType !== 'audio' && 'ctv:h-full'"
        :type="state.outputType"
        :content="previewContent"
      />
    </div>

    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:text-2xs ctv:text-muted-foreground">
      <span
        v-if="selectedAsset && selectedAsset.file_missing"
        class="ctv:flex-1 ctv:truncate ctv:text-destructive-background"
      >
        {{ $t('assetLoader.fileMissing', { name: selectedAsset.name || '—' }) }}
      </span>
      <span v-else-if="selectedAsset" class="ctv:flex-1 ctv:truncate ctv:text-success-background">
        {{ $t('assetLoader.selected', { name: selectedAsset.name || '—' }) }}
      </span>
      <span v-else class="ctv:flex-1 ctv:truncate">{{ $t('assetLoader.pickHint') }}</span>
    </div>

    <div :class="mediaType === 'model' ? 'ctv:flex-1 ctv:min-h-0 ctv:flex ctv:flex-col' : 'ctv:shrink-0'">
      <StageCard
        :state="state"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-context
        :hide-output="state.kind !== 'model'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import IconUpload from '~icons/lucide/upload'
import { computed, nextTick, ref } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import ModelThumb from '@/components/widgets/ModelThumb.vue'
import StageCard from '@/components/stages/StageCard.vue'
import ThumbImg from '@/components/widgets/ThumbImg.vue'
import VirtualGrid from '@/components/widgets/VirtualGrid.vue'
import ValuePreview from '@/components/stages/ValuePreview.vue'
import ViewFullButton from '@/components/ViewFullButton.vue'
import { assetTooltipOf as assetTooltip, useAssetLoaderCard } from '@/composables/stages/useAssetLoaderCard'
import { assetPreviewUrl } from '@/utils/assetMedia'
import { THUMB_CELL } from '@/utils/thumbUrl'
import type { StageState } from '@/stores/stageStore'
import { MODEL_FILE_EXTENSIONS } from '@/widgets/three/modelFormats'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const {
  store,
  mediaType,
  activeFilter,
  selectedId,
  visibleAssets,
  mediaCount,
  selectedAsset,
  setFilter,
  selectAsset,
  selectRelative,
  importFiles,
  fileDrop,
} = useAssetLoaderCard(props.node, () => props.state)

const gridEl = ref<HTMLElement | null>(null)

function onNavKeydown(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const t = e.target as HTMLElement | null
  const tag = t?.tagName.toLowerCase()
  if (tag === 'video' || tag === 'audio' || tag === 'input' || tag === 'textarea'
    || tag === 'select' || t?.isContentEditable) return
  if (selectedId.value == null) return
  e.preventDefault()
  e.stopPropagation()
  const moved = selectRelative(e.key === 'ArrowRight' ? 1 : -1)
  if (!moved) return
  void nextTick(() => {
    gridEl.value?.querySelector(`[data-asset-id="${moved.id}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

const gridItems = computed(() =>
  visibleAssets.value.map((a) => ({ key: a.id, asset: a })))

const gridLightboxItems = computed(() =>
  visibleAssets.value.map((a) => ({ url: a.payload_url, label: a.name })))

const fileInput = ref<HTMLInputElement | null>(null)

const previewContent = computed(() => {
  if (mediaType.value === 'image' && selectedAsset.value)
    return assetPreviewUrl(selectedAsset.value)
  return props.state.output
})

const fileAccept = computed(() =>
  mediaType.value === 'model' ? MODEL_FILE_EXTENSIONS.join(',') : `${mediaType.value}/*`)

function onPickFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) void importFiles(files)
}

function chipClass(active: boolean) {
  return [
    'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]',
    'ctv:rounded-lg ctv:border ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:transition-colors',
    active
      ? 'ctv:bg-secondary-background-selected ctv:border-primary-background/60 ctv:text-base-foreground'
      : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground',
  ].join(' ')
}

const chipCountClass = 'ctv:py-0 ctv:px-1 ctv:rounded-lg ctv:text-3xs ctv:bg-base-foreground/10'
</script>

<style scoped>
.ctv-al-fill :deep(.vp-img-host) {
  flex: 1 1 0%;
  min-height: 0;
}
.ctv-al-fill :deep(.vp-img-host > video) {
  height: 100%;
  max-height: none;
  object-fit: contain;
}
</style>
