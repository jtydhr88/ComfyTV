<template>
  <div v-if="rows.length" class="v2-params" @pointerdown.stop>
    <button type="button" class="v2-params__toggle" @click.stop="open = !open">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           :style="{ transform: open ? 'rotate(90deg)' : '' }">
        <path d="M9 5l7 7-7 7" />
      </svg>
      <span>{{ t('v2.params') }}</span>
      <span class="v2-params__count">{{ rows.length }}</span>
    </button>
    <div v-if="open" class="v2-params__grid">
      <label v-for="row in rows" :key="row.name" class="v2-params__row" :data-wide="row.type === 'textarea' ? '1' : ''">
        <span class="v2-params__label">{{ row.name }}</span>
        <div v-if="row.type === 'combo'" class="v2-params__select">
          <ComfyTVSelect
            :model-value="String(values[row.name] ?? '')"
            :options="row.options!"
            :filterable="row.options!.length > 12"
            @update:model-value="(v) => write(row, v)"
          />
        </div>
        <input
          v-else-if="row.type === 'number'"
          type="number"
          class="v2-params__input"
          :value="values[row.name]"
          :min="row.min"
          :max="row.max"
          :step="row.step"
          @change="(e) => write(row, (e.target as HTMLInputElement).value)"
        />
        <button
          v-else-if="row.type === 'boolean'"
          type="button"
          class="v2-params__bool"
          :data-on="values[row.name] ? '1' : ''"
          @click.stop="write(row, !values[row.name])"
        ><span /></button>
        <textarea
          v-else-if="row.type === 'textarea'"
          class="v2-params__input v2-params__textarea"
          :value="String(values[row.name] ?? '')"
          rows="2"
          @change="(e) => write(row, (e.target as HTMLTextAreaElement).value)"
          @wheel.stop
        />
        <input
          v-else
          type="text"
          class="v2-params__input"
          :value="String(values[row.name] ?? '')"
          @change="(e) => write(row, (e.target as HTMLInputElement).value)"
        />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { useWidgetValues } from '@/v2/useWidgetValues'

const { t } = useI18n()

const props = defineProps<{
  getNode: () => LGraphNode | undefined
  exclude?: string[]
}>()

const ALWAYS_SKIP = new Set([
  'force_run_token', 'project_id', 'parent_output_id', 'workflow',
  'main_prompt', 'custom_params', 'selected_index', 'pool',
  'v2_shell', 'comfytv_stage', '$$node-text-preview',
  'captured_image', 'meta_json',
])

interface Row {
  name: string
  type: 'combo' | 'number' | 'boolean' | 'text' | 'textarea'
  options?: string[]
  min?: number
  max?: number
  step?: number
}

function widgetsOf(): any[] {
  return (props.getNode()?.widgets ?? []) as any[]
}

const rows = computed<Row[]>(() => {
  const skip = new Set([...ALWAYS_SKIP, ...(props.exclude ?? [])])
  const out: Row[] = []
  for (const w of widgetsOf()) {
    const name = String(w?.name ?? '')
    if (!name || skip.has(name) || name.startsWith('$$')) continue
    const type = String(w?.type ?? '')
    if (type === 'button' || type === 'v2' || type === 'stage' || type === 'project') continue
    if (type === 'combo') {
      const vals = Array.isArray(w?.options?.values) ? w.options.values.map(String) : []
      out.push({ name, type: 'combo', options: vals })
    } else if (type === 'number' || type === 'slider' || type === 'int' || type === 'float') {
      out.push({
        name, type: 'number',
        min: w?.options?.min, max: w?.options?.max, step: w?.options?.step2 ?? w?.options?.step,
      })
    } else if (type === 'toggle' || type === 'boolean') {
      out.push({ name, type: 'boolean' })
    } else if (type === 'customtext') {
      out.push({ name, type: 'textarea' })
    } else if (type === 'text' || type === 'string') {
      out.push({ name, type: 'text' })
    }
  }
  return out
})

const open = ref(false)
const { values, write: writeRaw } = useWidgetValues(
  props.getNode,
  rows.value.map(r => r.name),
)

function write(row: Row, v: unknown) {
  let val: unknown = v
  if (row.type === 'number') val = Number(v)
  if (row.type === 'boolean') val = !!v
  writeRaw(row.name, val)
}
</script>

<style scoped>
.v2-params {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.v2-params__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  border: none;
  padding: 4px 8px;
  border-radius: 8px;
  background: transparent;
  color: var(--v2-text-muted);
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-params__toggle:hover { background: var(--v2-hover-bg); color: var(--v2-text-mid); }
.v2-params__toggle svg { width: 11px; height: 11px; transition: transform 0.15s ease; }
.v2-params__count {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--v2-hover-bg);
  font-size: 10px;
}
.v2-params__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
}
.v2-params__row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.v2-params__row[data-wide='1'] { grid-column: 1 / -1; }
.v2-params__label {
  color: var(--v2-text-faint);
  font: 500 10px/1 system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.v2-params__input {
  border: 1px solid var(--v2-chip-border);
  border-radius: 8px;
  background: transparent;
  color: var(--v2-text-strong);
  font: 500 11px/1.4 system-ui, sans-serif;
  padding: 5px 8px;
  outline: none;
  min-width: 0;
}
.v2-params__input:focus { border-color: var(--v2-accent-border); }
.v2-params__textarea { resize: vertical; min-height: 40px; }
.v2-params__select :deep(button) {
  height: 26px;
  padding: 0 8px;
  font-size: 11px;
  border-radius: 8px;
  border-width: 1px;
  background: transparent;
  border-color: var(--v2-chip-border);
}
.v2-params__bool {
  width: 34px;
  height: 20px;
  border: none;
  border-radius: 999px;
  background: var(--v2-hover-bg);
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease;
}
.v2-params__bool span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--v2-text-mid);
  transition: transform 0.15s ease, background 0.15s ease;
}
.v2-params__bool[data-on='1'] { background: color-mix(in srgb, var(--v2-accent) 55%, transparent); }
.v2-params__bool[data-on='1'] span { transform: translateX(14px); background: #fff; }
</style>
