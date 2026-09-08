<template>
  <div class="v2-cin" @pointerdown.stop>
    <div v-if="!io.outputs.length && !io.inputs.length" class="v2-cin__hint">
      {{ hasWorkflow ? t('v2.custom.hint') : t('v2.custom.noWorkflow') }}
    </div>
    <div v-for="it in visibleInputs" :key="it.key ?? it.node + '/' + it.input" class="v2-cin__row" :data-wide="it.kind === 'text' ? '1' : ''">
      <span class="v2-cin__label" :title="`${it.node}.${it.input}`">
        <span class="v2-cin__dot" :data-kind="it.kind" :data-wired="isWired(it) ? '1' : ''" />
        {{ it.label }}<span v-if="it.required && it.kind !== 'param' && it.kind !== 'text'" class="v2-cin__req">*</span>
      </span>
      <div v-if="it.kind === 'text'" class="v2-cin__control">
        <ComfyTVText
          :model-value="isWired(it) ? wiredText(it) : strVal(it)"
          :multiline="true"
          :rows="2"
          :disabled="isWired(it)"
          :placeholder="isWired(it) ? t('v2.custom.linked') : undefined"
          @update:model-value="setVal(it, $event)"
        />
      </div>
      <div v-else-if="it.kind === 'param'" class="v2-cin__control">
        <ComfyTVToggle
          v-if="it.ptype === 'BOOLEAN'"
          :model-value="Boolean(val(it))"
          @update:model-value="setVal(it, $event)"
        />
        <ComfyTVSlider
          v-else-if="isSlider(it)"
          :model-value="numVal(it)"
          :min="propNum(it, 'min')!"
          :max="propNum(it, 'max')!"
          :step="propNum(it, 'step') ?? (it.ptype === 'INT' ? 1 : 0.01)"
          :precision="it.ptype === 'INT' ? 0 : undefined"
          @update:model-value="setVal(it, $event)"
        />
        <ComfyTVNumber
          v-else-if="it.ptype === 'INT' || it.ptype === 'FLOAT'"
          :model-value="numVal(it)"
          :min="propNum(it, 'min')"
          :max="propNum(it, 'max')"
          :step="propNum(it, 'step') ?? (it.ptype === 'INT' ? 1 : 0.01)"
          :precision="it.ptype === 'INT' ? 0 : undefined"
          @update:model-value="setVal(it, $event)"
        />
        <ComfyTVSelect
          v-else-if="it.ptype === 'COMBO'"
          :model-value="strVal(it)"
          :options="comboOptions(it)"
          :filterable="comboOptions(it).length > 12"
          @update:model-value="setVal(it, $event)"
        />
        <ComfyTVText
          v-else
          :model-value="strVal(it)"
          @update:model-value="setVal(it, $event)"
        />
      </div>
      <span v-else class="v2-cin__status" :data-wired="isWired(it) || isRefCovered(it) ? '1' : ''">
        {{ isWired(it) ? t('v2.custom.linked') : isRefCovered(it) ? t('v2.custom.viaRef') : t('v2.custom.unlinked') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import { type ImageRef, readImageRefs, refType, subscribeImageRefs } from '@/composables/stages/imageRefs'
import { type ParamItem, parseParamItems, serializeParamItems } from '@/composables/stages/useCustomParams'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { bindWidgetCallback, readWidgetStr, writeWidget } from '@/utils/widget'
import { type CustomIo, type CustomIoInput, slotName } from '@/v2/customIo'

const props = defineProps<{
  node: LGraphNode
  state: StageState
  io: CustomIo
  hasWorkflow: boolean
}>()

const { t } = useI18n()
const items = ref<ParamItem[]>([])

function readItems(): ParamItem[] {
  return parseParamItems(readWidgetStr(props.node, 'custom_params', '{}'))
}
const refs = ref<ImageRef[]>([])
let unsubRefs: (() => void) | null = null
onMounted(() => {
  items.value = readItems()
  bindWidgetCallback(props.node, 'custom_params', () => { items.value = readItems() })
  refs.value = readImageRefs(props.node)
  unsubRefs = subscribeImageRefs(props.node, () => { refs.value = readImageRefs(props.node) })
})
onBeforeUnmount(() => { unsubRefs?.() })

function isRefCovered(it: CustomIoInput): boolean {
  if (it.kind !== 'image' && it.kind !== 'video' && it.kind !== 'audio') return false
  return refs.value.some(r => refType(r) === it.kind && r.slot === (it.slot ?? 0))
}

const byKey = computed(() => new Map(items.value.map(it => [it.key, it.value])))
const visibleInputs = computed(() => props.io.inputs.filter(it => !(it.kind === 'text' && it.prompt)))

function val(it: CustomIoInput): unknown {
  const key = it.key ?? ''
  return byKey.value.has(key) ? byKey.value.get(key) : it.default
}
function strVal(it: CustomIoInput): string {
  const v = val(it)
  return v == null ? '' : String(v)
}
function numVal(it: CustomIoInput): number | null {
  const n = Number(val(it))
  return Number.isFinite(n) ? n : null
}
function propNum(it: CustomIoInput, k: string): number | undefined {
  const v = it.props?.[k]
  return typeof v === 'number' ? v : undefined
}
function isSlider(it: CustomIoInput): boolean {
  if (it.ptype !== 'INT' && it.ptype !== 'FLOAT') return false
  const min = propNum(it, 'min'), max = propNum(it, 'max')
  return min !== undefined && max !== undefined && max - min <= 1000
}
function comboOptions(it: CustomIoInput): string[] {
  const v = it.props?.values
  return Array.isArray(v) ? v.map(String) : []
}
function setVal(it: CustomIoInput, value: unknown) {
  const key = it.key ?? ''
  const next = items.value.filter(x => x.key !== key)
  next.push({ key, value })
  items.value = next
  writeWidget(props.node, 'custom_params', serializeParamItems(next))
}

function slotOf(it: CustomIoInput): string | null {
  return it.kind === 'param' ? null : slotName(it.kind, it.slot ?? 0)
}
function isWired(it: CustomIoInput): boolean {
  const slot = slotOf(it)
  if (!slot) return false
  const inp = props.state.inputs.find(i => i.slot === slot)
  return !!inp && inp.source !== 'empty'
}
function wiredText(it: CustomIoInput): string {
  const slot = slotOf(it)
  const inp = slot ? props.state.inputs.find(i => i.slot === slot) : null
  return inp?.content ?? ''
}
</script>

<style scoped>
.v2-cin {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.v2-cin__hint {
  padding: 4px 2px;
  color: var(--v2-text-muted);
  font: 500 11px/1.4 system-ui, sans-serif;
}
.v2-cin__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
}
.v2-cin__row[data-wide="1"] { flex-direction: column; align-items: stretch; gap: 3px; }
.v2-cin__label {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--v2-text-muted);
  font: 500 11px/1.2 system-ui, sans-serif;
}
.v2-cin__row[data-wide="1"] .v2-cin__label { width: auto; }
.v2-cin__req { color: #f87171; margin-left: 2px; }
.v2-cin__dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--v2-chip-border);
}
.v2-cin__dot[data-kind="image"] { background: #60a5fa; }
.v2-cin__dot[data-kind="video"] { background: #f472b6; }
.v2-cin__dot[data-kind="audio"] { background: #34d399; }
.v2-cin__dot[data-kind="model"] { background: #fbbf24; }
.v2-cin__dot[data-kind="text"] { background: #a78bfa; }
.v2-cin__dot[data-kind="param"] { background: var(--v2-text-faint); }
.v2-cin__dot:not([data-wired="1"]):not([data-kind="param"]) { opacity: .45; }
.v2-cin__control { flex: 1; min-width: 0; }
.v2-cin__control :deep(button:not(.ctv-toggle)) {
  height: 26px;
  padding: 0 8px;
  font-size: 11px;
  border-radius: 8px;
  border-width: 1px;
  background: transparent;
  border-color: var(--v2-chip-border);
}
.v2-cin__control :deep(button:not(.ctv-toggle):hover) { background: var(--v2-hover-bg); }
.v2-cin__status {
  flex: 1;
  color: var(--v2-text-faint);
  font: 500 10px/1 system-ui, sans-serif;
}
.v2-cin__status[data-wired="1"] { color: var(--v2-accent-text); }
</style>
