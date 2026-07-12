<template>
  <section
    v-if="accepts"
    ref="rootEl"
    class="ctv:relative ctv:flex ctv:flex-col ctv:gap-1"
  >
    <div class="ctv:flex ctv:items-center ctv:gap-2">
      <span class="ctv:text-[11px] ctv:font-semibold">{{ $t('imageRefs.title') }}</span>
      <span class="ctv:text-3xs ctv:text-muted-foreground ctv:font-mono">{{ refs.length || '' }}</span>
      <button
        type="button"
        :class="['ctv:ml-auto', plusBtnClass]"
        :title="pickerOpen ? $t('stage.action.close') : $t('imageRefs.add')"
        @click.stop="pickerOpen = !pickerOpen"
      ><i :class="['pi', pickerOpen ? 'pi-times' : 'pi-plus']" /></button>
    </div>

    <AssetPickerPopup
      v-if="pickerOpen"
      :added-ids="refs.map(r => r.asset_id)"
      @select="onAddAsset"
      @close="pickerOpen = false"
    />

    <div v-if="refs.length" class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
      <div
        v-for="(ref, i) in refs"
        :key="ref.asset_id"
        class="ctv:group ctv:relative ctv:w-[76px] ctv:h-[76px] ctv:rounded-sm ctv:overflow-hidden ctv:cursor-pointer
               ctv:bg-black/30 ctv:border"
        :style="{ borderColor: slotColor(ref.slot) }"
        :title="tileTooltip(ref)"
        @click="openSlotPicker(i, $event)"
      >
        <img
          v-if="assetOf(ref)"
          :src="assetOf(ref)!.payload_url"
          :alt="assetOf(ref)!.name"
          class="ctv:block ctv:size-full ctv:object-cover"
          draggable="false"
        />
        <div
          v-else
          class="ctv:flex ctv:items-center ctv:justify-center ctv:size-full ctv:p-1 ctv:text-center ctv:text-3xs ctv:italic ctv:text-muted-foreground/60"
        >
          {{ $t('promptAssets.missing', { id: ref.asset_id }) }}
        </div>
        <span
          class="ctv:absolute ctv:bottom-0 ctv:inset-x-0 ctv:py-0.5 ctv:px-1 ctv:text-3xs ctv:font-semibold
                 ctv:overflow-hidden ctv:whitespace-nowrap ctv:text-ellipsis ctv:pointer-events-none
                 ctv:bg-linear-to-b ctv:from-transparent ctv:to-black/75"
          :style="{ color: slotColor(ref.slot) }"
        >{{ `#${ref.slot}` }}</span>
        <button
          type="button"
          :class="removeBtn"
          :title="$t('imageRefs.remove')"
          @click.stop="removeRef(i)"
        ><i class="pi pi-times" /></button>
      </div>
    </div>
    <div v-else class="ctv:text-2xs ctv:italic ctv:text-muted-foreground/60">
      {{ $t('imageRefs.empty') }}
    </div>

    <div
      v-if="slotWarnings.length"
      class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-2xs
             ctv:bg-warning-background/10 ctv:border ctv:border-warning-background/40 ctv:text-warning-background"
    >
      <div v-for="(w, i) in slotWarnings" :key="i"><i class="pi pi-exclamation-triangle" /> {{ w }}</div>
    </div>

    <MentionSlotPopover
      v-if="slotPicker"
      :x="slotPicker.x"
      :y="slotPicker.y"
      :loading="slotPicker.loading"
      :error="slotPicker.error"
      :options="slotPicker.options"
      :current-slot="slotPicker.currentSlot"
      :wired-slots="slotPicker.wiredSlots"
      :claimed-slots="slotPicker.claimedSlots"
      @pick="onSlotPick"
      @close="closeSlotPicker"
    />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import MentionSlotPopover from '@/components/stages/MentionSlotPopover.vue'
import { slotColor } from '@/composables/stages/imageSlotMentions'
import { useImageReferences } from '@/composables/stages/useImageReferences'
import type { LGraphNode } from '@/lib/comfyApp'

const props = defineProps<{ node?: LGraphNode }>()

const rootEl = ref<HTMLElement | null>(null)

const {
  refs,
  accepts,
  pickerOpen,
  slotPicker,
  slotWarnings,
  assetOf,
  tileTooltip,
  onAddAsset,
  removeRef,
  openSlotPicker,
  onSlotPick,
  closeSlotPicker,
  init,
} = useImageReferences(() => props.node, rootEl)

onMounted(init)

const plusBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-5 ctv:cursor-pointer ctv:[font-family:inherit]',
  'ctv:rounded-sm ctv:border ctv:border-border-default ctv:text-xs ctv:leading-none',
  'ctv:bg-secondary-background ctv:text-muted-foreground',
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground',
].join(' ')

const removeBtn = [
  'ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:hidden ctv:group-hover:flex ctv:items-center ctv:justify-center',
  'ctv:size-4 ctv:rounded-sm ctv:cursor-pointer ctv:text-2xs ctv:leading-none ctv:[font-family:inherit]',
  'ctv:bg-black/60 ctv:text-white ctv:border ctv:border-white/30 ctv:hover:bg-destructive-background/80',
].join(' ')
</script>
