<template>
  <div class="v2-fsel" @pointerdown.stop>
    <div class="v2-fsel__item v2-fsel__item--grow">
      <ComfyTVSelect :model-value="values.workflow" :options="optionsOf('workflow')" @update:model-value="v => write('workflow', v)" />
    </div>
    <button
      type="button"
      class="v2-fsel__link"
      :title="t('v2.linkWorkflow')"
      @pointerdown.stop
      @click.stop="onLinkWorkflow"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
        <path d="M10.5 13.5a4 4 0 005.7 0l3.3-3.3a4 4 0 10-5.7-5.7l-1.6 1.6" />
        <path d="M13.5 10.5a4 4 0 00-5.7 0l-3.3 3.3a4 4 0 105.7 5.7l1.6-1.6" />
      </svg>
    </button>
    <div class="v2-fsel__item">
      <ComfyTVSelect :model-value="values.aspect_ratio" :options="optionsOf('aspect_ratio')" :filterable="false" @update:model-value="v => write('aspect_ratio', v)" />
    </div>
    <div class="v2-fsel__item">
      <ComfyTVSelect :model-value="values.resolution" :options="optionsOf('resolution')" :filterable="false" @update:model-value="v => write('resolution', v)" />
    </div>
    <div class="v2-fsel__item">
      <ComfyTVSelect :model-value="values.batch_size" :options="batchOptions" :filterable="false" @update:model-value="v => write('batch_size', v)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import { openLinkWorkflow } from '@/composables/stages/openLinkWorkflow'
import type { LGraphNode } from '@/lib/comfyApp'

const props = defineProps<{
  getNode: () => LGraphNode | undefined
}>()

const NAMES = ['workflow', 'aspect_ratio', 'resolution', 'batch_size'] as const
type Name = (typeof NAMES)[number]

function widgetOf(name: Name) {
  return props.getNode()?.widgets?.find((w: any) => w.name === name) as any
}

const values = reactive<Record<Name, string>>({
  workflow: '', aspect_ratio: '', resolution: '', batch_size: '1',
})

function pull() {
  for (const name of NAMES) {
    const v = widgetOf(name)?.value
    const s = v == null ? '' : String(v)
    if (values[name] !== s) values[name] = s
  }
}
pull()

useIntervalFn(pull, 500)

function optionsOf(name: Name): string[] {
  const vals = widgetOf(name)?.options?.values
  return Array.isArray(vals) ? vals.map(String) : []
}

const { t } = useI18n()

const batchOptions = Array.from({ length: 8 }, (_, i) => ({
  value: String(i + 1),
  label: t('v2.batchCount', { n: i + 1 }),
}))

function write(name: Name, v: string | number) {
  const w = widgetOf(name)
  if (!w) return
  w.value = name === 'batch_size' ? Number(v) : v
  values[name] = String(v)
}

function onLinkWorkflow() {
  openLinkWorkflow('image', {
    onLinked: ({ label }) => {
      const w = widgetOf('workflow')
      const vals = w?.options?.values
      if (Array.isArray(vals) && !vals.includes(label)) vals.push(label)
      write('workflow', label)
    },
  })
}
</script>

<style scoped>
.v2-fsel {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.v2-fsel__item { flex: none; min-width: 0; }
.v2-fsel__item--grow { flex: 1 1 auto; min-width: 0; max-width: 150px; }
.v2-fsel :deep(button) {
  height: 26px;
  padding: 0 8px;
  font-size: 11px;
  border-radius: 8px;
  border-width: 1px;
  background: transparent;
  border-color: rgba(255, 255, 255, 0.1);
}
.v2-fsel :deep(button:hover) {
  background: rgba(255, 255, 255, 0.06);
}
.v2-fsel__link {
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: transparent;
  color: #b9b9c0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.v2-fsel__link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ececf1;
}
.v2-fsel__link svg { width: 13px; height: 13px; }
</style>
