<template>
  <AssetPickerPopup @select="onSelect" @close="$emit('close')" />
</template>

<script setup lang="ts">
import type { PentradoMediaInput } from '@jtydhr88/pentrado'

import type { Asset } from '@/api/schemas'
import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import { assetToMedia } from '@/lib/pentradoHost'

const emit = defineEmits<{
  pick: [media: PentradoMediaInput]
  close: []
}>()

function onSelect(asset: Asset): void {
  emit('pick', assetToMedia(asset))
}
</script>
