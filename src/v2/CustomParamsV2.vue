<template>
  <div v-if="hasWidget && (attached.length || available.length)" class="v2-cparams" @pointerdown.stop>
    <div class="v2-cparams__head">
      <span class="v2-cparams__title">{{ t('v2.customParams.title') }}</span>
      <div class="v2-cparams__addwrap">
        <button
          type="button"
          class="v2-cparams__add"
          :disabled="!available.length"
          :title="t('v2.customParams.addHint')"
          @click.stop="menuOpen = !menuOpen"
        >+ {{ t('v2.customParams.add') }}</button>
        <div v-if="menuOpen" class="v2-cparams__menu" @click.stop @wheel.stop>
          <button
            v-for="d in available"
            :key="d.key"
            type="button"
            class="v2-cparams__menuitem"
            @click="attach(d)"
          >
            <span class="v2-cparams__menulabel">{{ d.label }}</span>
            <span class="v2-cparams__menutype">{{ d.type }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-for="item in attached" :key="item.key" class="v2-cparams__row">
      <span class="v2-cparams__label" :title="defLabel(item.key)">{{ defLabel(item.key) }}</span>
      <div class="v2-cparams__control">
        <ComfyTVToggle
          v-if="defType(item.key) === 'boolean'"
          :model-value="Boolean(item.value)"
          @update:model-value="setVal(item.key, $event)"
        />
        <ComfyTVSlider
          v-else-if="useSlider(item.key)"
          :model-value="numVal(item.value)"
          :min="cfgNum(item.key, 'min')!"
          :max="cfgNum(item.key, 'max')!"
          :step="cfgNum(item.key, 'step') ?? (defType(item.key) === 'int' ? 1 : 0.1)"
          :precision="defType(item.key) === 'int' ? 0 : undefined"
          @update:model-value="setVal(item.key, $event)"
        />
        <ComfyTVNumber
          v-else-if="defType(item.key) === 'int' || defType(item.key) === 'float'"
          :model-value="numVal(item.value)"
          :min="cfgNum(item.key, 'min')"
          :max="cfgNum(item.key, 'max')"
          :step="cfgNum(item.key, 'step') ?? (defType(item.key) === 'int' ? 1 : 0.1)"
          :precision="defType(item.key) === 'int' ? 0 : undefined"
          @update:model-value="setVal(item.key, $event)"
        />
        <ComfyTVSelect
          v-else-if="defType(item.key) === 'combo'"
          :model-value="item.value as string"
          :options="comboOptions(item.key)"
          @update:model-value="setVal(item.key, $event)"
        />
        <ComfyTVText
          v-else
          :model-value="item.value == null ? '' : String(item.value)"
          :multiline="Boolean(cfg(item.key)?.multiline)"
          :placeholder="cfgStr(item.key, 'placeholder')"
          @update:model-value="setVal(item.key, $event)"
        />
      </div>
      <button
        type="button"
        class="v2-cparams__remove"
        :title="t('v2.customParams.remove')"
        @click="detach(item.key)"
      >−</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import { useCustomParams } from '@/composables/stages/useCustomParams'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const { t } = useI18n()

const props = defineProps<{
  node: LGraphNode
  state: StageState
}>()

const {
  menuOpen,
  hasWidget,
  attached,
  available,
  defLabel,
  defType,
  cfg,
  cfgNum,
  cfgStr,
  numVal,
  useSlider,
  comboOptions,
  attach,
  detach,
  setVal,
} = useCustomParams(props.node, () => props.state)
</script>

<style scoped>
.v2-cparams {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.v2-cparams__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.v2-cparams__title {
  color: #8f8f98;
  font: 500 10px/1 system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.v2-cparams__addwrap {
  position: relative;
  margin-left: auto;
}
.v2-cparams__add {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  height: 22px;
  padding: 0 8px;
  background: transparent;
  color: #b9b9c0;
  font: 500 10px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-cparams__add:hover { background: rgba(255, 255, 255, 0.06); color: #ececf1; }
.v2-cparams__add:disabled { opacity: 0.4; pointer-events: none; }
.v2-cparams__menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 30;
  width: 190px;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
  border-radius: 10px;
  background: #232327;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}
.v2-cparams__menuitem {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 7px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #ececf1;
  font: 500 11px/1.2 system-ui, sans-serif;
  cursor: pointer;
  text-align: left;
}
.v2-cparams__menuitem:hover { background: rgba(255, 255, 255, 0.07); }
.v2-cparams__menulabel {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.v2-cparams__menutype {
  color: #6b6b74;
  font-size: 9px;
}
.v2-cparams__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.v2-cparams__label {
  flex: none;
  width: 88px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #8f8f98;
  font: 500 11px/1.2 system-ui, sans-serif;
}
.v2-cparams__control { flex: 1; min-width: 0; }
.v2-cparams__control :deep(button) {
  height: 26px;
  padding: 0 8px;
  font-size: 11px;
  border-radius: 8px;
  border-width: 1px;
  background: transparent;
  border-color: rgba(255, 255, 255, 0.1);
}
.v2-cparams__control :deep(button:hover) { background: rgba(255, 255, 255, 0.06); }
.v2-cparams__remove {
  flex: none;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #f87171;
  font: 500 13px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-cparams__remove:hover { background: rgba(248, 113, 113, 0.12); }
</style>
