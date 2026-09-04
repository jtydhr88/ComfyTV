<template>
  <div class="ctv:border-t ctv:border-[#161616] ctv:bg-[#2f2f2f] ctv:px-2 ctv:py-1">
    <div class="ctv:flex ctv:items-center ctv:justify-between ctv:pb-0.5">
      <span class="ctv:text-[10px] ctv:uppercase ctv:tracking-wide ctv:text-[#d6d6d6]">
        {{ $t(`pentrado.filter_${session.op}`) }}
      </span>
      <div class="ctv:flex ctv:items-center ctv:gap-0.5">
        <button type="button" :class="miniBtnClass" :title="$t('pentrado.filterApply')" @click="editor.applyFilter()">
          <IconCheck class="ctv:size-3.5" />
        </button>
        <button type="button" :class="miniBtnClass" :title="$t('pentrado.filterCancel')" @click="editor.cancelFilter()">
          <IconX class="ctv:size-3.5" />
        </button>
      </div>
    </div>
    <FxSlider
      v-for="def in FILTER_PARAM_DEFS[session.op]"
      :key="def.key"
      class="ctv:pt-0.5"
      :model-value="session.params[def.key] ?? def.default"
      :label="$t(`pentrado.filterParam_${def.key}`)"
      :min="def.min"
      :max="def.max"
      :step="def.step ?? (def.max - def.min) / 200"
      :decimals="def.max > 10 ? 0 : 2"
      :reset-to="def.default"
      @update:model-value="(v) => editor.updateFilterParam(def.key, v)"
    />
  </div>
</template>

<script setup lang="ts">
import IconCheck from '~icons/lucide/check'
import IconX from '~icons/lucide/x'

import FxSlider from '../../primitives/PSlider.vue'
import type { LayerEditorController } from '../useLayerEditorStage'
import { FILTER_PARAM_DEFS, type FilterOp } from '../../filters'
import { miniBtnClass } from './panelClasses'

defineProps<{
  editor: LayerEditorController
  session: { op: FilterOp; params: Record<string, number> }
}>()
</script>
