<template>
  <section
    v-if="accepts"
    ref="rootEl"
    :class="[
      'ctv:relative ctv:flex ctv:flex-col ctv:gap-1',
      fileDrop.dragActive.value
        && 'ctv:rounded ctv:outline ctv:outline-2 ctv:-outline-offset-2 ctv:outline-primary-background/70 ctv:bg-primary-background/5',
    ]"
    @dragenter="fileDrop.onDragEnter"
    @dragover="fileDrop.onDragOver"
    @dragleave="fileDrop.onDragLeave"
    @drop="fileDrop.onDrop"
  >
    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <span class="ctv:text-[11px] ctv:font-semibold">{{ $t('imageRefs.title') }}</span>
      <span class="ctv:text-3xs ctv:text-muted-foreground ctv:font-mono">{{ pinned.length || '' }}</span>
      <button
        type="button"
        :class="['ctv:ml-auto', plusBtnClass]"
        :title="pickerOpen ? $t('stage.action.close') : $t('imageRefs.add')"
        @click.stop="pickerOpen = !pickerOpen"
      ><i :class="['pi', pickerOpen ? 'pi-times' : 'pi-plus']" /></button>
    </div>

    <AssetPickerPopup
      v-if="pickerOpen"
      :added-ids="addedIds"
      :media-types="acceptedMediaTypes"
      :batch-groups="batchGroups"
      :added-batch-keys="addedBatchKeys"
      @select="onAddAsset"
      @select-batch="onAddBatchImage"
      @refresh-batch="onRefreshBatch"
      @unpin-batch="onUnpinBatch"
      @close="pickerOpen = false"
    />

    <div v-if="pinned.length" class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
      <div
        v-for="it in pinned"
        :key="`${it.type}-${it.entry.key}`"
        class="imgref-tile ctv-hover-host ctv:relative ctv:w-[76px] ctv:h-[76px] ctv:rounded-sm ctv:overflow-hidden
               ctv:bg-black/30 ctv:border"
        :style="{ borderColor: it.color }"
        :title="it.label"
      >
        <template v-if="it.url">
          <video
            v-if="it.type === 'video'"
            :src="it.url"
            muted
            playsinline
            preload="metadata"
            class="ctv:block ctv:size-full ctv:object-cover ctv:bg-black ctv:pointer-events-none"
          />
          <div
            v-else-if="it.type === 'audio'"
            class="ctv:flex ctv:items-center ctv:justify-center ctv:size-full ctv:text-muted-foreground"
          ><i class="pi pi-volume-up ctv:text-lg" /></div>
          <ThumbImg
            v-else
            :src="it.url"
            :thumb-max="THUMB_TILE"
            class="ctv:block ctv:size-full ctv:object-cover"
            draggable="false"
          />
        </template>
        <div
          v-else
          class="ctv:flex ctv:items-center ctv:justify-center ctv:size-full ctv:p-1 ctv:text-center ctv:text-3xs ctv:italic ctv:text-muted-foreground/60"
        >
          {{ $t('promptAssets.missing', { id: it.entry.asset_id }) }}
        </div>
        <span
          class="ctv:absolute ctv:bottom-0 ctv:inset-x-0 ctv:py-0.5 ctv:px-1 ctv:text-3xs ctv:font-semibold
                 ctv:overflow-hidden ctv:whitespace-nowrap ctv:text-ellipsis ctv:pointer-events-none
                 ctv:bg-linear-to-b ctv:from-transparent ctv:to-black/75"
          :style="{ color: it.color }"
        >{{ $t(`mention.${it.type}Expand`, { n: it.position }) }}</span>
        <button
          type="button"
          :class="removeBtn"
          :title="$t('imageRefs.remove')"
          @click.stop="remove(it)"
        ><i class="pi pi-times" /></button>
        <ViewFullButton
          v-if="it.type === 'image' && it.url"
          class="ctv:top-0.5 ctv:left-0.5"
          :items="imageLightboxItems"
          :index="imageLightboxIndex(it)"
        />
      </div>
    </div>
    <div v-else class="ctv:text-2xs ctv:italic ctv:text-muted-foreground/60">
      {{ $t('imageRefs.empty') }}
    </div>

    <div
      v-if="warnings.length"
      class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-2xs
             ctv:bg-warning-background/10 ctv:border ctv:border-warning-background/40 ctv:text-warning-background"
    >
      <div v-for="(w, i) in warnings" :key="i"><i class="pi pi-exclamation-triangle" /> {{ w }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import ThumbImg from '@/components/widgets/ThumbImg.vue'
import ViewFullButton from '@/components/ViewFullButton.vue'
import type { MediaType } from '@/composables/stages/mediaOrder'
import { type StripItem, useMediaStrip } from '@/composables/stages/useMediaStrip'
import { THUMB_TILE } from '@/utils/thumbUrl'
import type { LGraphNode } from '@/lib/comfyApp'

const props = defineProps<{
  node?: LGraphNode
  forceTypes?: MediaType[]
}>()

const rootEl = ref<HTMLElement | null>(null)
const pickerOpen = ref(false)

const {
  items,
  accepts,
  acceptedMediaTypes,
  addedIds,
  addedBatchKeys,
  batchGroups,
  onRefreshBatch,
  onUnpinBatch,
  onAddAsset,
  onAddBatchImage,
  fileDrop,
  remove,
  warnings,
  init,
} = useMediaStrip(() => props.node, props.forceTypes ? { types: props.forceTypes } : undefined)

onMounted(init)

const pinned = computed(() => items.value.filter(it => it.entry.src !== 'link'))

const imageLightboxItems = computed(() => pinned.value
  .filter(it => it.type === 'image' && it.url)
  .map(it => ({ url: it.url!, label: `#${it.position}` })))

function imageLightboxIndex(it: StripItem): number {
  return Math.max(0, imageLightboxItems.value.findIndex(x => x.url === it.url))
}

const plusBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-5 ctv:cursor-pointer ctv:[font-family:inherit]',
  'ctv:rounded-sm ctv:border ctv:border-border-default ctv:text-xs ctv:leading-none',
  'ctv:bg-secondary-background ctv:text-muted-foreground',
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground',
].join(' ')

const removeBtn = [
  'imgref-remove ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:flex ctv:items-center ctv:justify-center',
  'ctv:size-4 ctv:rounded-sm ctv:cursor-pointer ctv:text-2xs ctv:leading-none ctv:[font-family:inherit]',
  'ctv:bg-black/60 ctv:text-white ctv:border ctv:border-white/30 ctv:hover:bg-destructive-background/80',
].join(' ')
</script>

<style scoped>
.imgref-remove {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.imgref-tile:hover .imgref-remove,
.imgref-tile:focus-within .imgref-remove {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none), (pointer: coarse) {
  .imgref-remove {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
