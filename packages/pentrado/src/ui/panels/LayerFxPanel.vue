<template>
  <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-2 ctv:pt-1 ctv:text-[10px] ctv:text-[#9b9b9b]">
    <span class="ctv:flex-1 ctv:font-semibold ctv:uppercase ctv:tracking-wide">fx</span>
    <select :class="presetSelectClass" class="ctv:w-32!" @change="onAddFx">
      <option value="" selected>{{ $t('pentrado.fxAdd') }}</option>
      <option v-for="op in LAYER_FX_OPS" :key="op" :value="op">{{ $t(`pentrado.fx_${op}`) }}</option>
    </select>
  </div>
  <div v-for="(f, fi) in activeFx" :key="f.id" class="ctv:px-2 ctv:pt-0.5">
    <div class="ctv:flex ctv:items-center ctv:gap-0.5">
      <button type="button" :class="miniBtnClass" @click="toggleFxRow(fi)">
        <IconEye v-if="f.enabled" class="ctv:size-3" />
        <span v-else class="ctv:size-3" />
      </button>
      <span class="ctv:flex-1 ctv:truncate ctv:text-[10px]" :class="f.enabled ? 'ctv:text-[#d6d6d6]' : 'ctv:text-[#9b9b9b]/60'">
        {{ $t(`pentrado.fx_${f.op}`) }}
      </span>
      <button type="button" :class="miniBtnClass" :disabled="fi === 0" @click="moveFxRow(fi, -1)">
        <IconChevronUp class="ctv:size-3" />
      </button>
      <button type="button" :class="miniBtnClass" :disabled="fi === activeFx.length - 1" @click="moveFxRow(fi, 1)">
        <IconChevronDownArrange class="ctv:size-3" />
      </button>
      <button type="button" :class="miniBtnClass" @click="removeFxRow(fi)">
        <IconX class="ctv:size-3" />
      </button>
    </div>
    <template v-for="def in LAYER_FX_DEFS[f.op]" :key="def.key">
      <div v-if="def.color" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:pt-0.5">
        <span :class="paramLabelClass">{{ $t(`pentrado.fxParam_${def.key}`) }}</span>
        <input
          type="color"
          :class="colorInputClass"
          :value="fxColorHex(f, def.key)"
          @input="(e) => onFxColor(fi, def.key, (e.target as HTMLInputElement).value)"
        />
      </div>
      <FxSlider
        v-else
        class="ctv:pt-0.5"
        :model-value="f.params[def.key] ?? def.default"
        :label="$t(`pentrado.fxParam_${def.key}`)"
        :min="def.min"
        :max="def.max"
        :step="def.step ?? (def.max - def.min) / 200"
        :decimals="def.max > 10 ? 0 : 2"
        :reset-to="def.default"
        @update:model-value="(v) => setFxParamRow(fi, def.key, v)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconChevronDownArrange from '~icons/lucide/chevron-down'
import IconChevronUp from '~icons/lucide/chevron-up'
import IconEye from '~icons/lucide/eye'
import IconX from '~icons/lucide/x'

import FxSlider from '../../primitives/PSlider.vue'
import type { LayerEditorController } from '../useLayerEditorStage'
import { createLayerFx, LAYER_FX_DEFS, LAYER_FX_OPS, type LayerFxData, type LayerFxOp, type SceneNode } from '../../engine'
import { colorInputClass, miniBtnClass, paramLabelClass, presetSelectClass } from './panelClasses'

const props = defineProps<{
  editor: LayerEditorController
  active: SceneNode
}>()

const editor = props.editor

const activeFx = computed<LayerFxData[]>(() => {
  void editor.layers.value
  return props.active.fx ?? []
})
function commitFx(next: LayerFxData[]): void {
  editor.setLayerFx(props.active.id, next)
}
function onAddFx(e: Event): void {
  const sel = e.target as HTMLSelectElement
  const op = sel.value as LayerFxOp | ''
  sel.value = ''
  if (!op) return
  commitFx([...activeFx.value, createLayerFx(op)])
}
function toggleFxRow(i: number): void {
  commitFx(activeFx.value.map((f, k) => (k === i ? { ...f, enabled: !f.enabled } : f)))
}
function removeFxRow(i: number): void {
  commitFx(activeFx.value.filter((_, k) => k !== i))
}
function moveFxRow(i: number, dir: 1 | -1): void {
  const next = [...activeFx.value]
  const j = i + dir
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j], next[i]]
  commitFx(next)
}
function setFxParamRow(i: number, key: string, v: number): void {
  commitFx(activeFx.value.map((f, k) => (k === i ? { ...f, params: { ...f.params, [key]: v } } : f)))
}
function fxColorHex(f: LayerFxData, key: string): string {
  const v = Math.max(0, Math.min(0xffffff, Math.round(f.params[key] ?? 0)))
  return `#${v.toString(16).padStart(6, '0')}`
}
function onFxColor(i: number, key: string, hex: string): void {
  setFxParamRow(i, key, parseInt(hex.replace('#', ''), 16))
}
</script>
