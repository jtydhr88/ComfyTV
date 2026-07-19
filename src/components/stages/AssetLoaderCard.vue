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
    </div>

    <div class="ctv-scroll-thin ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:rounded-md ctv:border ctv:border-border-subtle ctv:bg-black/20 ctv:p-1.5" @wheel.stop>
      <div v-if="visibleAssets.length === 0"
           class="ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
        {{ activeFilter === 'all' ? $t('assetLoader.empty') : $t('assets.emptyCategory') }}
      </div>

      <div v-else class="ctv:grid ctv:grid-cols-[repeat(auto-fill,minmax(80px,1fr))] ctv:gap-1.5">
        <button
          v-for="asset in visibleAssets"
          :key="asset.id"
          type="button"
          :class="[
            'ctv:group ctv:relative ctv:rounded-lg ctv:overflow-hidden ctv:cursor-pointer ctv:p-0 ctv:border ctv:bg-secondary-background ctv:transition-colors',
            asset.id === selectedId
              ? 'ctv:border-primary-background ctv:ring-2 ctv:ring-primary-background/50'
              : 'ctv:border-border-subtle ctv:hover:border-border-default',
          ]"
          :title="assetTooltip(asset)"
          @click="selectAsset(asset)"
        >
          <video
            v-if="mediaType === 'video'"
            :src="asset.payload_url"
            muted
            playsinline
            preload="metadata"
            class="ctv:block ctv:w-full ctv:aspect-square ctv:object-cover ctv:bg-black"
            @mouseenter="hoverPlay"
            @mouseleave="hoverPause"
          />
          <div
            v-else-if="mediaType === 'audio'"
            class="ctv:flex ctv:items-center ctv:justify-center ctv:w-full ctv:aspect-square ctv:text-2xl
                   ctv:bg-secondary-background-hover ctv:text-muted-foreground"
          ><i class="pi pi-volume-up" /></div>
          <div
            v-else-if="mediaType === 'model'"
            class="ctv:relative ctv:w-full ctv:aspect-square ctv:bg-secondary-background-hover"
          >
            <ModelThumb :src="asset.payload_url" :alt="asset.name">
              <i class="pi pi-box ctv:text-2xl" />
            </ModelThumb>
          </div>
          <img
            v-else
            :src="asset.payload_url"
            :alt="asset.name"
            loading="lazy"
            class="ctv:block ctv:w-full ctv:aspect-square ctv:object-cover"
            draggable="false"
          />
          <div class="ctv:truncate ctv:py-0.5 ctv:px-1 ctv:text-2xs ctv:text-left ctv:text-muted-foreground">
            {{ asset.name || '—' }}
          </div>
          <span
            v-if="asset.id === selectedId"
            class="ctv:absolute ctv:top-1 ctv:right-1 ctv:flex ctv:items-center ctv:justify-center ctv:size-4 ctv:rounded-full
                   ctv:bg-primary-background ctv:text-base-foreground ctv:text-3xs ctv:font-bold ctv:shadow"
          ><i class="pi pi-check" /></span>
        </button>
      </div>
    </div>

    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:text-2xs ctv:text-muted-foreground">
      <span v-if="selectedAsset" class="ctv:flex-1 ctv:truncate ctv:text-success-background">
        {{ $t('assetLoader.selected', { name: selectedAsset.name || '—' }) }}
      </span>
      <span v-else class="ctv:flex-1 ctv:truncate">{{ $t('assetLoader.pickHint') }}</span>
    </div>

    <div class="ctv:shrink-0">
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
import type { LGraphNode } from '@/lib/comfyApp'
import ModelThumb from '@/components/widgets/ModelThumb.vue'
import StageCard from '@/components/stages/StageCard.vue'
import { assetTooltipOf as assetTooltip, useAssetLoaderCard } from '@/composables/stages/useAssetLoaderCard'
import type { StageState } from '@/stores/stageStore'

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
  fileDrop,
} = useAssetLoaderCard(props.node, () => props.state)

function hoverPlay(e: MouseEvent) {
  void (e.currentTarget as HTMLVideoElement).play().catch(() => {})
}
function hoverPause(e: MouseEvent) {
  const v = e.currentTarget as HTMLVideoElement
  v.pause()
  v.currentTime = 0
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
