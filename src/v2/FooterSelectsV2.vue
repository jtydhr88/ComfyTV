<template>
  <div class="v2-fsel" @pointerdown.stop>
    <div v-if="has('workflow')" class="v2-fsel__item v2-fsel__item--grow">
      <ComfyTVSelect :model-value="sv('workflow')" :options="optionsOf('workflow')" @update:model-value="v => writeVal('workflow', v)" />
    </div>
    <button
      v-if="has('workflow') && linkKind"
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
    <div v-if="has('aspect_ratio')" class="v2-fsel__item">
      <ComfyTVSelect :model-value="sv('aspect_ratio')" :options="optionsOf('aspect_ratio')" :filterable="false" @update:model-value="v => writeVal('aspect_ratio', v)" />
    </div>
    <div v-if="has('resolution')" class="v2-fsel__item">
      <ComfyTVSelect :model-value="sv('resolution')" :options="optionsOf('resolution')" :filterable="false" @update:model-value="v => writeVal('resolution', v)" />
    </div>
    <div v-if="has('batch_size')" class="v2-fsel__item">
      <ComfyTVSelect :model-value="sv('batch_size') || '1'" :options="batchOptions" :filterable="false" @update:model-value="v => writeVal('batch_size', v)" />
    </div>
    <template v-for="x in extra ?? []" :key="x.name">
      <div v-if="has(x.name) && (x.type ?? 'combo') === 'combo'" class="v2-fsel__item">
        <ComfyTVSelect :model-value="sv(x.name)" :options="optionsOf(x.name)" :filterable="false" @update:model-value="v => writeVal(x.name, v)" />
      </div>
      <input
        v-else-if="has(x.name)"
        type="number"
        class="v2-fsel__num"
        :value="sv(x.name)"
        :min="optNum(x.name, 'min')"
        :max="optNum(x.name, 'max')"
        :step="optNum(x.name, 'step2') ?? optNum(x.name, 'step') ?? 1"
        :title="x.titleKey ? t(x.titleKey) : x.name"
        @change="(e) => writeVal(x.name, (e.target as HTMLInputElement).value)"
      />
    </template>
  </div>
</template>

<script lang="ts">
export interface FooterExtra {
  name: string
  type?: 'combo' | 'number'
  titleKey?: string
}
</script>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import { openLinkWorkflow } from '@/composables/stages/openLinkWorkflow'
import type { LGraphNode } from '@/lib/comfyApp'
import { useWidgetValues } from '@/v2/useWidgetValues'

const AUTO_NAMES = ['workflow', 'aspect_ratio', 'resolution', 'batch_size']

const props = defineProps<{
  getNode: () => LGraphNode | undefined
  linkKind?: string | null
  extra?: FooterExtra[]
}>()

const { values, widgetOf, write } = useWidgetValues(
  props.getNode,
  [...AUTO_NAMES, ...(props.extra ?? []).map(x => x.name)],
)

function sv(name: string): string {
  const v = values[name]
  return v == null ? '' : String(v)
}

function optionsOf(name: string): string[] {
  const vals = widgetOf(name)?.options?.values
  return Array.isArray(vals) ? vals.map(String) : []
}

function optNum(name: string, key: string): number | undefined {
  const v = widgetOf(name)?.options?.[key]
  return typeof v === 'number' ? v : undefined
}

function has(name: string): boolean {
  return !!widgetOf(name)
}

const { t } = useI18n()

const batchOptions = Array.from({ length: 8 }, (_, i) => ({
  value: String(i + 1),
  label: t('v2.batchCount', { n: i + 1 }),
}))

function isNumberWidget(name: string): boolean {
  const type = String(widgetOf(name)?.type ?? '')
  return type === 'number' || type === 'slider' || type === 'int' || type === 'float'
}

function writeVal(name: string, v: string | number) {
  write(name, name === 'batch_size' || isNumberWidget(name) ? Number(v) : v)
}

function onLinkWorkflow() {
  openLinkWorkflow(props.linkKind ?? 'image', {
    onLinked: ({ label }) => {
      const w = widgetOf('workflow')
      const vals = w?.options?.values
      if (Array.isArray(vals) && !vals.includes(label)) vals.push(label)
      writeVal('workflow', label)
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
  flex-wrap: wrap;
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
.v2-fsel__num {
  flex: none;
  width: 52px;
  height: 26px;
  padding: 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: transparent;
  color: #ececf1;
  font: 500 11px/1 system-ui, sans-serif;
  outline: none;
}
.v2-fsel__num:focus { border-color: rgba(167, 139, 250, 0.6); }
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
