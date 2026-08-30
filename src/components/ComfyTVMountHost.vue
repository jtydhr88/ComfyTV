<template>
  <Teleport
    v-for="m in mounts"
    :key="m.key"
    :to="m.container"
  >
    <component :is="m.component" v-bind="m.props" />
  </Teleport>
  <ComfyTVDialog />
  <LightboxHost />
  <PresenceOverlay />
</template>

<script setup lang="ts">
import LightboxHost from '@/components/LightboxHost.vue'
import ComfyTVDialog from '@/components/dialog/ComfyTVDialog.vue'
import PresenceOverlay from '@/collab/PresenceOverlay.vue'
import { mounts } from '@/composables/stages/widgetMounts'
</script>
