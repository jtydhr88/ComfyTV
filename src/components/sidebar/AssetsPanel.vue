<template>
  <div
    class="ctv:relative ctv:flex ctv:flex-col ctv:size-full ctv:box-border ctv:overflow-hidden ctv:text-xs ctv:text-base-foreground"
    @dragenter="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2.5
                ctv:bg-interface-panel-surface ctv:border-b ctv:border-border-subtle">
      <span class="ctv:flex-1 ctv:font-semibold ctv:text-sm">{{ $t('assets.title') }}</span>
      <button
        :class="addBtnClass"
        :disabled="uploading"
        :title="$t('assets.addTooltip')"
        @click="filePicker?.click()"
      >
        {{ uploading
          ? $t('assets.uploading', { done: uploadDone, total: uploadTotal })
          : `+ ${$t('assets.add')}` }}
      </button>
      <input
        ref="filePicker"
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        class="ctv:hidden"
        @change="onPickFiles"
      />
    </div>

    <div class="ctv:shrink-0 ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1 ctv:py-1.5 ctv:px-2.5 ctv:border-b ctv:border-border-subtle">
      <button
        :class="chipClass(activeFilter === 'all')"
        @click="activeFilter = 'all'"
      >
        {{ $t('assets.category.all') }}
        <span :class="chipCountClass">{{ store.countByCategory('all') }}</span>
      </button>
      <button
        :class="chipClass(activeFilter === 'none')"
        @click="activeFilter = 'none'"
      >
        {{ $t('assets.category.none') }}
        <span :class="chipCountClass">{{ store.countByCategory('none') }}</span>
      </button>
      <button
        v-for="cat in store.categories"
        :key="cat.id"
        :class="chipClass(activeFilter === cat.id)"
        @dragover.prevent
        @drop.prevent.stop="onChipDrop(cat.id, $event)"
        @click="activeFilter = cat.id"
      >
        {{ cat.name }}
        <span :class="chipCountClass">{{ store.countByCategory(cat.id) }}</span>
        <template v-if="activeFilter === cat.id">
          <span
            role="button"
            class="ctv:ml-0.5 ctv:opacity-60 ctv:hover:opacity-100"
            :title="$t('assets.category.rename')"
            @click.stop="onRenameCategory(cat.id, cat.name)"
          ><i class="pi pi-pencil" /></span>
          <span
            role="button"
            class="ctv:opacity-60 ctv:hover:opacity-100 ctv:hover:text-destructive-background"
            :title="$t('assets.category.delete')"
            @click.stop="onDeleteCategory(cat.id)"
          ><i class="pi pi-times" /></span>
        </template>
      </button>
      <button
        :class="chipClass(false)"
        :title="$t('assets.category.new')"
        @click="onCreateCategory"
      ><i class="pi pi-plus" /></button>
    </div>

    <div class="ctv:shrink-0 ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1 ctv:py-1.5 ctv:px-2.5 ctv:border-b ctv:border-border-subtle">
      <button
        v-for="m in mediaFilters"
        :key="m"
        :class="chipClass(mediaFilter === m)"
        @click="mediaFilter = m"
      >
        {{ $t(`assets.media.${m}`) }}
        <span :class="chipCountClass">{{ mediaCount(m) }}</span>
      </button>
    </div>

    <div v-if="uploadError"
         class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:my-1.5 ctv:mx-2.5 ctv:py-1.5 ctv:px-2 ctv:text-xs ctv:rounded
                ctv:bg-destructive-background/15 ctv:border ctv:border-destructive-background/50 ctv:text-destructive-background">
      <span class="ctv:flex-1">{{ uploadError }}</span>
      <button
        class="ctv:bg-transparent ctv:border-none ctv:cursor-pointer ctv:text-inherit ctv:opacity-70 ctv:hover:opacity-100"
        @click="uploadError = null"
      ><i class="pi pi-times" /></button>
    </div>

    <div class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-2.5">
      <div v-if="visibleAssets.length === 0"
           class="ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
        {{ activeFilter === 'all' && mediaFilter === 'all' ? $t('assets.empty') : $t('assets.emptyCategory') }}
      </div>

      <div v-else class="ctv:grid ctv:grid-cols-[repeat(auto-fill,minmax(88px,1fr))] ctv:gap-1.5">
        <div
          v-for="asset in visibleAssets"
          :key="asset.id"
          class="ctv-asset-card ctv:group ctv:relative ctv:rounded-lg ctv:overflow-hidden ctv:cursor-grab
                 ctv:bg-secondary-background ctv:border ctv:border-border-subtle
                 ctv:hover:border-border-default"
          draggable="true"
          @dragstart="onAssetDragStart(asset, $event)"
        >
          <video
            v-if="asset.media_type === 'video'"
            :src="asset.payload_url"
            :title="assetTooltip(asset)"
            muted
            playsinline
            preload="metadata"
            class="ctv:block ctv:w-full ctv:aspect-square ctv:object-cover ctv:bg-black"
            @mouseenter="hoverPlay"
            @mouseleave="hoverPause"
          />
          <div
            v-else-if="asset.media_type === 'audio'"
            :title="assetTooltip(asset)"
            class="ctv:flex ctv:items-center ctv:justify-center ctv:w-full ctv:aspect-square ctv:text-2xl
                   ctv:bg-secondary-background-hover ctv:text-muted-foreground"
          ><i class="pi pi-volume-up" /></div>
          <img
            v-else
            :src="asset.payload_url"
            :alt="asset.name"
            :title="assetTooltip(asset)"
            loading="lazy"
            class="ctv:block ctv:w-full ctv:aspect-square ctv:object-cover"
          />
          <span
            v-if="asset.media_type === 'video' || asset.media_type === 'audio'"
            class="ctv:absolute ctv:bottom-7 ctv:left-1 ctv:py-0 ctv:px-1 ctv:rounded ctv:text-3xs ctv:font-semibold
                   ctv:bg-black/65 ctv:text-white/90 ctv:pointer-events-none"
          ><i :class="['pi', asset.media_type === 'video' ? 'pi-play' : 'pi-volume-up']" /></span>
          <div class="ctv:truncate ctv:py-0.5 ctv:px-1 ctv:text-2xs ctv:text-muted-foreground">
            {{ asset.name || '—' }}
          </div>
          <div v-if="asset.category_ids.length"
               class="ctv:flex ctv:flex-wrap ctv:gap-0.5 ctv:px-1 ctv:pb-1">
            <span
              v-for="cid in asset.category_ids"
              :key="cid"
              class="ctv:max-w-full ctv:truncate ctv:py-0 ctv:px-1 ctv:rounded ctv:text-3xs ctv:bg-base-foreground/10 ctv:text-muted-foreground"
            >{{ catName(cid) }}</span>
          </div>
          <div class="ctv-asset-actions ctv:absolute ctv:top-1 ctv:right-1 ctv:flex ctv:gap-0.5">
            <button
              :class="cardBtnClass"
              :title="$t('assets.card.loadNode')"
              @click="onLoadAssetNode(asset)"
            ><i class="pi pi-download" /></button>
            <button
              :class="cardBtnClass"
              :title="$t('assets.card.tags')"
              @click="openTagEditor(asset, $event)"
            ><i class="pi pi-tag" /></button>
            <button
              :class="cardBtnClass"
              :title="$t('assets.card.rename')"
              @click="onRenameAsset(asset)"
            ><i class="pi pi-pencil" /></button>
            <button
              :class="`${cardBtnClass} ctv:hover:text-destructive-background`"
              :title="$t('assets.card.delete')"
              @click="onDeleteAsset(asset)"
            ><i class="pi pi-times" /></button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="fileDragDepth > 0"
      class="ctv:absolute ctv:inset-0 ctv:z-10 ctv:flex ctv:items-center ctv:justify-center ctv:pointer-events-none
             ctv:bg-primary-background/15 ctv:border-2 ctv:border-dashed ctv:border-primary-background ctv:rounded-lg"
    >
      <span class="ctv:py-1 ctv:px-2.5 ctv:rounded ctv:text-xs ctv:font-semibold
                   ctv:bg-interface-panel-surface ctv:text-base-foreground">
        {{ $t('assets.dropHint') }}
      </span>
    </div>

    <div v-if="tagEditor" class="ctv:fixed ctv:inset-0 ctv:z-20" @click="closeTagEditor()">
      <div
        class="ctv:absolute ctv:w-44 ctv:max-h-64 ctv:overflow-y-auto ctv:p-1 ctv:rounded ctv:shadow-md
               ctv:bg-interface-menu-surface ctv:border ctv:border-border-default"
        :style="tagEditorStyle"
        @click.stop
      >
        <div v-if="store.categories.length === 0"
             class="ctv:py-2 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60 ctv:text-2xs">
          {{ $t('assets.tagPopover.empty') }}
        </div>
        <button
          v-for="cat in store.categories"
          :key="cat.id"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:px-1.5 ctv:py-1 ctv:rounded-sm ctv:cursor-pointer ctv:text-left ctv:text-2xs
                 ctv:[font-family:inherit] ctv:bg-transparent ctv:border-none ctv:text-base-foreground
                 ctv:hover:bg-secondary-background-hover"
          @click="toggleTag(cat.id)"
        >
          <span class="ctv:w-3 ctv:inline-block ctv:text-primary-background"><i v-if="editorHas(cat.id)" class="pi pi-check" /></span>
          <span class="ctv:flex-1 ctv:truncate">{{ cat.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { useAssetsPanel } from '@/composables/sidebar/useAssetsPanel'

const props = defineProps<{
  active?: boolean
}>()

const filePicker = ref<HTMLInputElement | null>(null)

function hoverPlay(e: MouseEvent) {
  void (e.currentTarget as HTMLVideoElement).play().catch(() => {})
}
function hoverPause(e: MouseEvent) {
  const v = e.currentTarget as HTMLVideoElement
  v.pause()
  v.currentTime = 0
}

const {
  store,
  activeFilter,
  mediaFilter,
  mediaCount,
  mediaFilters,
  uploading,
  uploadDone,
  uploadTotal,
  uploadError,
  fileDragDepth,
  visibleAssets,
  tagEditor,
  tagEditorStyle,
  catName,
  openTagEditor,
  closeTagEditor,
  editorHas,
  toggleTag,
  assetTooltip,
  onPickFiles,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onRenameAsset,
  onDeleteAsset,
  onLoadAssetNode,
  onAssetDragStart,
  onChipDrop,
  onDragEnter,
  onDragLeave,
  onDrop,
} = useAssetsPanel(() => props.active)

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

const addBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-1 ctv:cursor-pointer ctv:whitespace-nowrap ctv:appearance-none',
  'ctv:border-none ctv:transition-colors ctv:focus-visible:outline-none ctv:[font-family:inherit]',
  'ctv:disabled:pointer-events-none ctv:disabled:opacity-50',
  'ctv:h-6 ctv:rounded-sm ctv:px-2 ctv:py-1 ctv:text-xs ctv:font-medium',
  'ctv:text-secondary-foreground ctv:bg-secondary-background ctv:hover:bg-secondary-background-hover',
].join(' ')

const cardBtnClass = [
  'ctv:flex ctv:items-center ctv:justify-center ctv:size-5 ctv:cursor-pointer ctv:[font-family:inherit]',
  'ctv:rounded-sm ctv:border ctv:border-border-default ctv:text-2xs',
  'ctv:bg-interface-panel-surface/90 ctv:text-base-foreground ctv:hover:bg-secondary-background-hover',
].join(' ')
</script>

<style scoped>
.ctv-asset-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.ctv-asset-card:hover .ctv-asset-actions,
.ctv-asset-card:focus-within .ctv-asset-actions {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none), (pointer: coarse) {
  .ctv-asset-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
