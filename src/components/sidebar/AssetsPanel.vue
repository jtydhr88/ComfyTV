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

    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-1.5 ctv:px-2.5 ctv:border-b ctv:border-border-subtle">
      <div class="ctv:relative ctv:flex-1 ctv:min-w-0">
        <IconSearch
          class="ctv:absolute ctv:left-2 ctv:top-1/2 ctv:-translate-y-1/2 ctv:size-3.5
                 ctv:text-muted-foreground ctv:pointer-events-none"
        />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="$t('assets.search')"
          class="ctv:w-full ctv:h-7 ctv:box-border ctv:pl-7 ctv:pr-2 ctv:rounded-lg ctv:text-xs ctv:[font-family:inherit]
                 ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
                 ctv:placeholder:text-muted-foreground ctv:focus-visible:outline-none ctv:focus:border-border-default"
        />
      </div>
      <button
        :class="iconBtnClass"
        :title="$t('assets.view.settings')"
        @click="openSettingsMenu"
      >
        <IconSettings2 class="ctv:size-4" />
      </button>
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
            class="ctv:ml-0.5 ctv:inline-flex ctv:opacity-60 ctv:hover:opacity-100"
            :title="$t('assets.category.rename')"
            @click.stop="onRenameCategory(cat.id, cat.name)"
          ><IconPencil class="ctv:size-3" /></span>
          <span
            role="button"
            class="ctv:inline-flex ctv:opacity-60 ctv:hover:opacity-100 ctv:hover:text-destructive-background"
            :title="$t('assets.category.delete')"
            @click.stop="onDeleteCategory(cat.id)"
          ><IconX class="ctv:size-3" /></span>
        </template>
      </button>
      <button
        :class="chipClass(false)"
        :title="$t('assets.category.new')"
        @click="onCreateCategory"
      ><IconPlus class="ctv:size-3" /></button>
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
        class="ctv:inline-flex ctv:bg-transparent ctv:border-none ctv:cursor-pointer ctv:text-inherit ctv:opacity-70 ctv:hover:opacity-100"
        @click="uploadError = null"
      ><IconX class="ctv:size-3.5" /></button>
    </div>

    <div class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-1.5">
      <div v-if="visibleAssets.length === 0"
           class="ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
        {{ emptyText }}
      </div>

      <div
        v-else-if="viewMode === 'grid'"
        class="ctv:grid ctv:grid-cols-[repeat(auto-fill,minmax(min(160px,42vw),1fr))] ctv:gap-1"
      >
        <AssetGridCard
          v-for="asset in visibleAssets"
          :key="asset.id"
          :asset="asset"
          :meta="assetMeta(asset)"
          :category-names="asset.category_ids.map(catName)"
          :tooltip="assetTooltip(asset)"
          @dragstart="onAssetDragStart(asset, $event)"
          @contextmenu.prevent.stop="openAssetMenu(asset, $event, 'pointer')"
          @open-menu="openAssetMenu(asset, $event, 'element')"
        />
      </div>

      <div v-else class="ctv:flex ctv:flex-col ctv:gap-1">
        <AssetListItem
          v-for="asset in visibleAssets"
          :key="asset.id"
          :asset="asset"
          :meta="assetMeta(asset)"
          :category-names="asset.category_ids.map(catName)"
          :tooltip="assetTooltip(asset)"
          @dragstart="onAssetDragStart(asset, $event)"
          @contextmenu.prevent.stop="openAssetMenu(asset, $event, 'pointer')"
          @open-menu="openAssetMenu(asset, $event, 'element')"
        />
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

    <div
      v-if="settingsMenu"
      class="ctv:fixed ctv:inset-0 ctv:z-20"
      @click="settingsMenu = null"
      @contextmenu.prevent="settingsMenu = null"
    >
      <div
        class="ctv:absolute ctv:w-44 ctv:p-1 ctv:rounded-lg ctv:shadow-md
               ctv:bg-interface-menu-surface ctv:border ctv:border-interface-menu-stroke"
        :style="{ left: `${settingsMenu.x}px`, top: `${settingsMenu.y}px` }"
        @click.stop
      >
        <button :class="menuItemClass" @click="setViewMode('list')">
          <IconTableOfContents class="ctv:size-4 ctv:shrink-0" />
          <span class="ctv:flex-1 ctv:truncate">{{ $t('assets.view.list') }}</span>
          <IconCheck class="ctv:size-4 ctv:shrink-0" :class="viewMode !== 'list' && 'ctv:opacity-0'" />
        </button>
        <button :class="menuItemClass" @click="setViewMode('grid')">
          <IconLayoutGrid class="ctv:size-4 ctv:shrink-0" />
          <span class="ctv:flex-1 ctv:truncate">{{ $t('assets.view.grid') }}</span>
          <IconCheck class="ctv:size-4 ctv:shrink-0" :class="viewMode !== 'grid' && 'ctv:opacity-0'" />
        </button>
      </div>
    </div>

    <div
      v-if="assetMenu"
      class="ctv:fixed ctv:inset-0 ctv:z-20"
      @click="closeAssetMenu()"
      @contextmenu.prevent="closeAssetMenu()"
    >
      <div
        class="ctv:absolute ctv:w-48 ctv:p-1 ctv:rounded-lg ctv:shadow-md
               ctv:bg-interface-menu-surface ctv:border ctv:border-interface-menu-stroke"
        :style="assetMenuStyle"
        @click.stop
      >
        <button :class="menuItemClass" @click="menuLoadNode">
          <IconDownload class="ctv:size-4 ctv:shrink-0" />
          <span class="ctv:flex-1 ctv:truncate">{{ $t('assets.card.loadNode') }}</span>
        </button>
        <button :class="menuItemClass" @click="menuEditTags">
          <IconTag class="ctv:size-4 ctv:shrink-0" />
          <span class="ctv:flex-1 ctv:truncate">{{ $t('assets.card.tags') }}</span>
        </button>
        <button :class="menuItemClass" @click="menuRenameAsset">
          <IconPencil class="ctv:size-4 ctv:shrink-0" />
          <span class="ctv:flex-1 ctv:truncate">{{ $t('assets.card.rename') }}</span>
        </button>
        <div class="ctv:my-1 ctv:border-b ctv:border-border-subtle" />
        <button
          :class="`${menuItemClass} ctv:hover:text-destructive-background`"
          @click="menuDeleteAsset"
        >
          <IconTrash2 class="ctv:size-4 ctv:shrink-0" />
          <span class="ctv:flex-1 ctv:truncate">{{ $t('assets.card.delete') }}</span>
        </button>
      </div>
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
          <span class="ctv:w-3 ctv:inline-flex ctv:text-primary-background"><IconCheck v-if="editorHas(cat.id)" class="ctv:size-3" /></span>
          <span class="ctv:flex-1 ctv:truncate">{{ cat.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import IconCheck from '~icons/lucide/check'
import IconDownload from '~icons/lucide/download'
import IconLayoutGrid from '~icons/lucide/layout-grid'
import IconPencil from '~icons/lucide/pencil'
import IconPlus from '~icons/lucide/plus'
import IconSearch from '~icons/lucide/search'
import IconSettings2 from '~icons/lucide/settings-2'
import IconTableOfContents from '~icons/lucide/table-of-contents'
import IconTag from '~icons/lucide/tag'
import IconTrash2 from '~icons/lucide/trash-2'
import IconX from '~icons/lucide/x'

import AssetGridCard from '@/components/sidebar/assets/AssetGridCard.vue'
import AssetListItem from '@/components/sidebar/assets/AssetListItem.vue'
import { type AssetViewMode, useAssetsPanel } from '@/composables/sidebar/useAssetsPanel'

const props = defineProps<{
  active?: boolean
}>()

const { t } = useI18n()

const filePicker = ref<HTMLInputElement | null>(null)

const {
  store,
  activeFilter,
  mediaFilter,
  mediaCount,
  mediaFilters,
  viewMode,
  searchQuery,
  uploading,
  uploadDone,
  uploadTotal,
  uploadError,
  fileDragDepth,
  visibleAssets,
  tagEditor,
  tagEditorStyle,
  catName,
  closeTagEditor,
  editorHas,
  toggleTag,
  assetTooltip,
  assetMeta,
  assetMenu,
  assetMenuStyle,
  openAssetMenu,
  closeAssetMenu,
  menuLoadNode,
  menuEditTags,
  menuRenameAsset,
  menuDeleteAsset,
  onPickFiles,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onAssetDragStart,
  onChipDrop,
  onDragEnter,
  onDragLeave,
  onDrop,
} = useAssetsPanel(() => props.active)

const emptyText = computed(() => {
  if (searchQuery.value.trim()) return t('assets.noResults')
  return activeFilter.value === 'all' && mediaFilter.value === 'all'
    ? t('assets.empty')
    : t('assets.emptyCategory')
})

const SETTINGS_MENU_WIDTH = 176
const settingsMenu = ref<{ x: number; y: number } | null>(null)

function openSettingsMenu(e: MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  settingsMenu.value = {
    x: Math.max(8, Math.min(r.right - SETTINGS_MENU_WIDTH, window.innerWidth - SETTINGS_MENU_WIDTH - 8)),
    y: r.bottom + 4,
  }
}

function setViewMode(mode: AssetViewMode) {
  viewMode.value = mode
  settingsMenu.value = null
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

const addBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-1 ctv:cursor-pointer ctv:whitespace-nowrap ctv:appearance-none',
  'ctv:border-none ctv:transition-colors ctv:focus-visible:outline-none ctv:[font-family:inherit]',
  'ctv:disabled:pointer-events-none ctv:disabled:opacity-50',
  'ctv:h-6 ctv:rounded-sm ctv:px-2 ctv:py-1 ctv:text-xs ctv:font-medium',
  'ctv:text-secondary-foreground ctv:bg-secondary-background ctv:hover:bg-secondary-background-hover',
].join(' ')

const iconBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-7 ctv:shrink-0 ctv:cursor-pointer ctv:appearance-none',
  'ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-base-foreground',
  'ctv:hover:bg-secondary-background-hover ctv:transition-colors',
].join(' ')

const menuItemClass = [
  'ctv:flex ctv:items-center ctv:gap-2 ctv:w-full ctv:px-2 ctv:py-1.5 ctv:rounded ctv:cursor-pointer ctv:text-left ctv:text-xs',
  'ctv:[font-family:inherit] ctv:bg-transparent ctv:border-none ctv:text-base-foreground',
  'ctv:hover:bg-interface-menu-component-surface-hovered',
].join(' ')
</script>
