<template>
  <button
    v-if="state.output"
    type="button"
    class="v2-toolbar__btn"
    :title="t(actionTooltipKey('model', 'product-shot'))"
    @pointerdown.stop
    @click.stop="onAction('product-shot')"
  >
    <StageIcon name="pi pi-camera" class="v2-lact__icon" />
    <span>{{ t(actionLabelKey('model', 'product-shot')) }}</span>
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import StageIcon from '@/components/widgets/StageIcon.vue'
import { actionLabelKey, actionTooltipKey } from '@/composables/stages/actionLabels'
import type { StageState } from '@/stores/stageStore'

const { t } = useI18n()

defineProps<{
  state: StageState
  onAction: (id: string, context?: unknown) => void
}>()
</script>

<style scoped>
.v2-lact__icon {
  font-size: 12px;
  width: 14px;
  display: inline-flex;
  justify-content: center;
}
</style>
