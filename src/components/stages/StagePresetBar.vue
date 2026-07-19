<template>
  <div v-if="hasConfig" class="ctv-preset-bar ctv:flex ctv:items-center ctv:gap-1.5">
    <ComfyTVSelect
      class="ctv:flex-1 ctv:min-w-0"
      :model-value="selectionValue"
      :options="presetOptions"
      @update:model-value="onPick"
    />
    <button
      :class="[iconBtn, 'ctv-preset-save']"
      :title="$t('stagePresets.save')"
      @click="onSave"
    ><i class="pi pi-save" /></button>
    <button
      :class="[iconBtn, 'ctv-preset-reset']"
      :title="$t('stagePresets.reset')"
      @click="onReset"
    ><i class="pi pi-replay" /></button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { ApiError } from '@/api'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { useStagePresets } from '@/composables/stages/useStagePresets'
import { t } from '@/i18n'
import { app, type LGraphNode } from '@/lib/comfyApp'

const props = defineProps<{ node?: LGraphNode }>()

const CUSTOM_VALUE = '__custom__'

const {
  hasConfig,
  presets,
  selectedId,
  selectedPreset,
  resetToDefaults,
  markCustom,
  applyPresetById,
  savePresetAs,
} = useStagePresets(() => props.node)

const presetOptions = computed(() => [
  { value: CUSTOM_VALUE, label: t('stagePresets.custom') },
  ...presets.value.map((p) => ({
    value: String(p.id),
    label: p.builtin ? `★ ${p.name}` : p.name,
  })),
])

const selectionValue = computed(() =>
  selectedId.value != null ? String(selectedId.value) : CUSTOM_VALUE)

function onPick(v: string | number): void {
  if (v === CUSTOM_VALUE) {
    markCustom()
    return
  }
  const hit = presets.value.find((p) => String(p.id) === String(v))
  if (hit) applyPresetById(hit.id)
}

function toast(severity: string, summary: string, detail = ''): void {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity, summary, detail, life: 5000 })
}

async function onSave(): Promise<void> {
  const name = await askText({
    title: t('stagePresets.saveTitle'),
    label: t('stagePresets.nameLabel'),
    initialValue: selectedPreset.value?.name ?? '',
  })
  if (!name?.trim()) return
  try {
    await savePresetAs(name.trim())
  } catch (e) {
    const reserved = e instanceof ApiError && e.status === 400
      && e.message.includes('reserved')
    toast('error', t('stagePresets.saveFailed'),
      reserved ? t('stagePresets.nameReserved') : String((e as Error)?.message ?? e))
  }
}

function onReset(): void {
  resetToDefaults()
}

const BTN_BASE = 'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer'
  + ' ctv:touch-manipulation ctv:whitespace-nowrap ctv:appearance-none ctv:border-none ctv:transition-colors'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'
  + ' ctv:size-6 ctv:shrink-0 ctv:p-0 ctv:rounded-sm ctv:text-xs'

const iconBtn = BTN_BASE
  + ' ctv:bg-secondary-background ctv:text-secondary-foreground ctv:hover:bg-secondary-background-hover'
</script>
