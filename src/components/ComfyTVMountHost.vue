<template>
  <Teleport
    v-for="m in mounts"
    :key="m.key"
    :to="m.container"
  >
    <component :is="m.component" v-bind="m.props" />
  </Teleport>
  <ExecutionStatusBar />
  <ComfyTVDialog />
  <LightboxHost />
</template>

<script setup lang="ts">
import ExecutionStatusBar from '@/components/ExecutionStatusBar.vue'
import LightboxHost from '@/components/LightboxHost.vue'
import ComfyTVDialog from '@/components/dialog/ComfyTVDialog.vue'
import { mounts } from '@/composables/stages/widgetMounts'
</script>
