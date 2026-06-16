<template>
  <div
    class="ctv:w-full ctv:mt-1
           ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-2 ctv:rounded ctv:text-xs
           ctv:bg-interface-menu-surface ctv:text-base-foreground
           ctv:border ctv:border-border-default"
    @keydown.escape.stop="$emit('close')"
  >
    <div class="ctv:flex ctv:gap-1.5 ctv:items-center">
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
      <div class="ctv:w-24 ctv:shrink-0">
        <ComfyTVSelect
          :model-value="filterValue"
          :options="categoryOptions"
          @update:model-value="setFilter"
        />
      </div>
    </div>

    <div class="comfytv-asset-scroll ctv:h-[224px] ctv:shrink-0 ctv:overflow-y-scroll">
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
            'ctv:relative ctv:flex ctv:flex-col ctv:p-0 ctv:cursor-pointer ctv:overflow-hidden ctv:rounded',
            'ctv:bg-secondary-background ctv:border ctv:[font-family:inherit]',
            isAdded(asset.id)
              ? 'ctv:border-primary-background'
              : 'ctv:border-border-subtle ctv:hover:border-primary-background/60',
          ]"
          :title="asset.name"
          @click="$emit('select', asset)"
        >
          <img
            :src="asset.payload_url"
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
          >✓</span>
          <span class="ctv:w-full ctv:truncate ctv:py-0.5 ctv:px-1 ctv:text-left ctv:text-3xs ctv:text-muted-foreground">
            {{ asset.name || '—' }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { Asset } from '@/api/schemas'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import { useAssetPicker } from '@/composables/stages/useAssetPicker'

const props = defineProps<{
  addedIds?: number[]
}>()

defineEmits<{
  select: [asset: Asset]
  close: []
}>()

const searchEl = ref<HTMLInputElement | null>(null)

const {
  query,
  filterValue,
  categoryOptions,
  setFilter,
  filtered,
  isAdded,
  ensureHydrated,
} = useAssetPicker(() => props.addedIds ?? [])

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
