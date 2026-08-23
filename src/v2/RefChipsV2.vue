<template>
  <div ref="rootEl" class="v2-refs" @pointerdown.stop>
    <div
      v-for="(r, i) in visibleRefs"
      :key="refKey(r)"
      class="v2-refchip"
      :title="ir.tileTooltip(r)"
    >
      <ThumbImg
        v-if="urlOf(r)"
        :src="urlOf(r)!"
        :thumb-max="64"
        loading="lazy"
        class="v2-refchip__img"
      />
      <span class="v2-refchip__dot" :style="{ background: slotColor(r.slot) }" />
      <button type="button" class="v2-refchip__x" @click.stop="ir.removeRef(i)">×</button>
    </div>
    <div v-if="hiddenCount > 0" class="v2-refchip v2-refchip--more">+{{ hiddenCount }}</div>
    <button type="button" class="v2-refchip v2-refchip--add" @click.stop="open = !open">＋</button>
  </div>
  <div v-if="ir.slotWarnings.value.length" class="v2-refs-warns" @pointerdown.stop>
    <div v-for="(w, i) in ir.slotWarnings.value" :key="i" class="v2-refs-warns__row">{{ w }}</div>
  </div>
  <AssetPickerPopup
    v-if="open"
    :added-ids="addedIds"
    :media-types="ir.acceptedMediaTypes.value"
    :batch-groups="ir.batchGroups.value"
    :added-batch-keys="addedBatchKeys"
    @select="onSelect"
    @select-batch="onSelectBatch"
    @refresh-batch="ir.onRefreshBatch"
    @unpin-batch="ir.onUnpinBatch"
    @close="open = false"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type { Asset } from '@/api/schemas'
import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import ThumbImg from '@/components/widgets/ThumbImg.vue'
import { type ImageRef, isBatchRef, refKey } from '@/composables/stages/imageRefs'
import { slotColor } from '@/composables/stages/imageSlotMentions'
import { useImageReferences } from '@/composables/stages/useImageReferences'
import type { LGraphNode } from '@/lib/comfyApp'

const MAX_VISIBLE = 6

const props = defineProps<{
  getNode: () => LGraphNode | undefined
  types?: Array<'image' | 'video' | 'audio'>
}>()

const rootEl = ref<HTMLElement | null>(null)
const open = ref(false)

const ir = useImageReferences(
  props.getNode,
  rootEl,
  props.types ? { forceTypes: props.types } : undefined,
)

const visibleRefs = computed(() => ir.refs.value.slice(0, MAX_VISIBLE))
const hiddenCount = computed(() => Math.max(0, ir.refs.value.length - MAX_VISIBLE))
const addedIds = computed(() =>
  ir.refs.value.map(r => r.asset_id).filter((id): id is number => id != null))
const addedBatchKeys = computed(() =>
  ir.refs.value.filter(isBatchRef).map(r => `${r.batch_id}:${r.batch_index}`))

function urlOf(r: ImageRef): string | null {
  if (isBatchRef(r)) return ir.batchUrlOf(r)
  return ir.assetOf(r)?.payload_url ?? null
}

function onSelect(asset: Asset) {
  ir.onAddAsset(asset)
}

function onSelectBatch(groupId: string, index: number) {
  ir.onAddBatchImage(groupId, index)
}

onMounted(() => ir.init())
</script>

<style scoped>
.v2-refs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.v2-refchip {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  overflow: hidden;
  background: var(--v2-chip-bg);
  border: 1px solid var(--v2-chip-border);
  flex: none;
}
.v2-refchip__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.v2-refchip__dot {
  position: absolute;
  left: 3px;
  bottom: 3px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.55);
}
.v2-refchip__x {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(12, 12, 16, 0.78);
  color: #e6e6ea;
  font: 500 10px/1 system-ui, sans-serif;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
}
.v2-refchip:hover .v2-refchip__x { display: flex; }
@media (hover: none) {
  .v2-refchip__x { display: flex; }
}
.v2-refchip--more {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--v2-text-mid);
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-refchip--add {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--v2-text-mid);
  font: 400 16px/1 system-ui, sans-serif;
  cursor: pointer;
  background: transparent;
  border: 1px dashed var(--v2-scrollbar);
}
.v2-refchip--add:hover {
  border-color: var(--v2-text-muted);
  color: var(--v2-text-strong);
}
</style>
