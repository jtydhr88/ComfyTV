<template>
  <div v-if="present.length" class="v2-ctl" @pointerdown.stop>
    <label v-for="c in present" :key="c.name" class="v2-ctl__row" :data-wide="c.wide || c.control === 'textarea' ? '1' : ''">
      <span class="v2-ctl__label">{{ t(c.labelKey) }}</span>
      <ComfyTVSlider
        v-if="c.control === 'slider'"
        :model-value="numVal(c.name)"
        :min="optNum(c.name, 'min') ?? 0"
        :max="optNum(c.name, 'max') ?? 100"
        :step="stepOf(c.name)"
        :precision="precisionOf(c.name)"
        @update:model-value="(v) => write(c.name, v)"
      />
      <ComfyTVToggle
        v-else-if="c.control === 'toggle'"
        :model-value="Boolean(values[c.name])"
        @update:model-value="(v) => write(c.name, v)"
      />
      <ComfyTVNumber
        v-else-if="c.control === 'number'"
        :model-value="numVal(c.name)"
        :min="optNum(c.name, 'min')"
        :max="optNum(c.name, 'max')"
        :step="stepOf(c.name)"
        :precision="precisionOf(c.name)"
        @update:model-value="(v) => write(c.name, v)"
      />
      <ComfyTVSelect
        v-else-if="c.control === 'select'"
        :model-value="strVal(c.name)"
        :options="optionsOf(c.name)"
        :filterable="optionsOf(c.name).length > 12"
        @update:model-value="(v) => write(c.name, String(v))"
      />
      <ComfyTVText
        v-else
        :model-value="strVal(c.name)"
        :multiline="c.control === 'textarea'"
        :rows="2"
        :placeholder="optStr(c.name, 'placeholder')"
        @update:model-value="(v) => write(c.name, v)"
      />
    </label>
  </div>
</template>

<script lang="ts">
export interface ControlSpec {
  name: string
  control: 'slider' | 'toggle' | 'textarea' | 'text' | 'number' | 'select'
  labelKey: string
  wide?: boolean
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { useWidgetValues } from '@/v2/useWidgetValues'

const { t } = useI18n()

const props = defineProps<{
  getNode: () => LGraphNode | undefined
  controls: ControlSpec[]
}>()

const { values, widgetOf, write: writeRaw } = useWidgetValues(
  props.getNode,
  props.controls.map(c => c.name),
)

const present = computed(() => props.controls.filter(c => !!widgetOf(c.name)))

function numVal(name: string): number | null {
  const n = Number(values[name])
  return Number.isFinite(n) ? n : null
}
function strVal(name: string): string {
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
function optStr(name: string, key: string): string | undefined {
  const v = widgetOf(name)?.options?.[key]
  return typeof v === 'string' ? v : undefined
}
function stepOf(name: string): number {
  return optNum(name, 'step2') ?? optNum(name, 'step') ?? 1
}
function precisionOf(name: string): number {
  const p = optNum(name, 'precision')
  if (p !== undefined) return p
  return stepOf(name) < 1 ? 2 : 0
}

function write(name: string, v: unknown) {
  writeRaw(name, v)
}
</script>

<style scoped>
.v2-ctl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}
.v2-ctl__row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.v2-ctl__row[data-wide='1'] { grid-column: 1 / -1; }
.v2-ctl__label {
  color: var(--v2-text-muted);
  font: 500 10px/1 system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.v2-ctl :deep(button:not(.ctv-toggle)) {
  height: 26px;
  padding: 0 8px;
  font-size: 11px;
  border-radius: 8px;
  border-width: 1px;
  background: transparent;
  border-color: var(--v2-chip-border);
}
.v2-ctl :deep(button:not(.ctv-toggle):hover) { background: var(--v2-hover-bg); }
.v2-ctl :deep(textarea),
.v2-ctl :deep(input[type='text']) {
  border: 1px solid var(--v2-chip-border);
  border-radius: 8px;
  background: transparent;
  color: var(--v2-text-strong);
  font: 500 11px/1.5 system-ui, sans-serif;
}
</style>
