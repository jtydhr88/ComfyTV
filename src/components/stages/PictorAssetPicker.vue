<template>
  <AssetPickerPopup @select="onSelect" @close="$emit('close')" />
</template>

<script setup lang="ts">
import type { PictorMediaInput } from '@jtydhr88/pictor'

import type { Asset } from '@/api/schemas'
import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import { assetToMedia } from '@/lib/pictorHost'

const emit = defineEmits<{
  pick: [media: PictorMediaInput]
  close: []
}>()

function onSelect(asset: Asset): void {
  emit('pick', assetToMedia(asset))
}
</script>
