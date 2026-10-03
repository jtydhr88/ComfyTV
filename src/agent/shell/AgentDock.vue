<script setup lang="ts">
import '../native/agentPanel.css'

import { storeToRefs } from 'pinia'

import { watch } from 'vue'

import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import EaglePickerPopup from '@/components/stages/EaglePickerPopup.vue'
import { assetPicker, closeAssetPicker } from '@agent/comfytv/assets'
import { closeEaglePicker, eaglePicker, refreshEagleAvailability } from '@agent/comfytv/eagle'

import DockedAgentPanel from '../native/components/agent/DockedAgentPanel.vue'
import { useAgentPanelStore } from '../native/stores/agent/agentPanelStore'
import ProviderBar from './ProviderBar.vue'

const { enabled, isOpen, width } = storeToRefs(useAgentPanelStore())

watch(isOpen, (open) => {
  if (open) void refreshEagleAvailability()
}, { immediate: true })
</script>

<template>
  <div
    v-if="enabled && isOpen"
    class="agent-scope ctv:pointer-events-auto ctv:relative ctv:flex ctv:h-full ctv:shrink-0 ctv:flex-col ctv:overflow-hidden ctv:border-l ctv:border-interface-stroke ctv:bg-agent-surface ctv:font-inter"
    :style="{ width: `${width}px` }"
  >
    <ProviderBar />
    <div class="ctv:flex ctv:min-h-0 ctv:flex-1 ctv:[&>*]:w-full ctv:[&>*]:border-l-0">
      <DockedAgentPanel />
    </div>
    <div
      v-if="assetPicker.open && assetPicker.handlers"
      class="comfytv-root ctv:absolute ctv:inset-x-4 ctv:bottom-40 ctv:z-30 ctv:max-h-[60%] ctv:overflow-y-auto"
    >
      <AssetPickerPopup
        :added-ids="assetPicker.handlers.addedIds()"
        :media-types="['image', 'video', 'audio']"
        @select="assetPicker.handlers.select"
        @deselect="assetPicker.handlers.deselect"
        @close="closeAssetPicker()"
      />
    </div>
    <div
      v-if="eaglePicker.open && eaglePicker.handlers"
      class="comfytv-root ctv:absolute ctv:inset-x-4 ctv:bottom-40 ctv:z-30 ctv:max-h-[60%] ctv:overflow-y-auto"
    >
      <EaglePickerPopup
        :can-pick="eaglePicker.handlers.canPick"
        :added-ids="eaglePicker.handlers.addedIds()"
        :media-types="['image', 'video', 'audio']"
        @select="eaglePicker.handlers.select"
        @deselect="eaglePicker.handlers.deselect"
        @close="closeEaglePicker()"
      />
    </div>
  </div>
</template>
