<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:pt-1.5">
    <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('configSidebar.outputs') }}</span>
    <div
      v-for="w in outputs"
      :key="`${w.node_id}/${w.widget_name}`"
      class="ctv:grid ctv:grid-cols-[60px_1fr] ctv:items-center ctv:gap-1.5"
    >
      <span class="ctv:text-2xs ctv:font-mono ctv:text-muted-foreground ctv:truncate" :title="w.widget_props?.output_type">
        → {{ w.widget_props?.output_name }}
      </span>
      <ComfyTVSelect
        :model-value="w.stage_binding ?? '__VALUE__'"
        :options="optionsFor(w)"
        @update:model-value="emit('change', w, $event as string)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import { outputBindingOptions, type ExposedWidget } from '@/composables/sidebar/workflowConfigCatalog'

const props = defineProps<{
  outputs: ExposedWidget[]
  options: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{ change: [w: ExposedWidget, value: string] }>()

const { t } = useI18n()

function optionsFor(w: ExposedWidget) {
  return [
    { value: '__VALUE__', label: t('configSidebar.useNodeOutput') },
    ...outputBindingOptions(props.options, String(w.widget_props?.output_type)),
  ]
}
</script>
