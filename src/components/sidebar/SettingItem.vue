<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1 ctv:pr-2 ctv:py-1"
    :style="{ paddingLeft: `${8 + depth * 12}px` }"
  >
    <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:min-h-6">
      <span
        v-if="depth"
        class="ctv:shrink-0 ctv:w-1.5 ctv:self-stretch ctv:border-l ctv:border-border-subtle"
      />
      <span class="ctv:min-w-0 ctv:truncate" :title="label">{{ label }}</span>
      <span v-if="row.experimental" :class="chipClass">{{ $t('settings.experimental') }}</span>
      <TooltipRoot :delay-duration="150">
        <TooltipTrigger as-child>
          <button type="button" :class="iconBtnClass">
            <IconInfo class="ctv:size-3" />
          </button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            side="bottom"
            align="start"
            :side-offset="4"
            :collision-padding="8"
            class="ctv:z-[10000] ctv:max-w-80 ctv:rounded ctv:border ctv:border-border-default
                   ctv:bg-interface-menu-surface ctv:px-2 ctv:py-1.5 ctv:text-2xs ctv:leading-relaxed
                   ctv:text-base-foreground ctv:shadow-lg ctv:whitespace-pre-wrap ctv:break-words"
          >
            {{ $t(`settings.fields.${row.key}.desc`) }}
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
      <button
        v-if="value !== row.default"
        :class="iconBtnClass"
        :title="$t('settings.reset')"
        @click="emit('update', row.default)"
      >
        <IconRotateCcw class="ctv:size-3" />
      </button>
      <div
        class="ctv:ml-auto ctv:shrink-0 ctv:flex ctv:items-center ctv:justify-end"
        :class="row.type === 'string' ? 'ctv:w-[52%]' : ''"
      >
        <ComfyTVToggle
          v-if="row.type === 'boolean'"
          :model-value="value === true"
          @update:model-value="(v: boolean) => emit('update', v)"
        />
        <ComfyTVNumber
          v-else-if="row.type === 'int'"
          class="ctv:w-20"
          :model-value="Number(value ?? row.default)"
          :min="1"
          :precision="0"
          @update:model-value="(v: number | null) => emit('update', v ?? row.default)"
        />
        <ComfyTVSelect
          v-else-if="row.type === 'choice'"
          class="ctv:w-36"
          :model-value="String(value ?? row.default)"
          :options="choiceOptions"
          @update:model-value="(v: string | number) => emit('update', String(v))"
        />
        <ComfyTVText
          v-else
          class="ctv:w-full"
          :model-value="String(value ?? '')"
          :placeholder="placeholder"
          @update:model-value="(v: string) => emit('update', v)"
        />
      </div>
    </div>
    <div v-if="suggestions.length" class="ctv:flex ctv:flex-wrap ctv:gap-1">
      <button
        v-for="m in suggestions"
        :key="m"
        :class="[suggestionBtnClass, value === m ? 'ctv:border-node-component-border' : '']"
        @click="emit('update', m)"
      >{{ m }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SettingRow, SettingValue } from '@/api'
import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'

import IconInfo from '~icons/lucide/info'
import IconRotateCcw from '~icons/lucide/rotate-ccw'

const props = withDefaults(defineProps<{
  row: SettingRow
  value: SettingValue | undefined
  depth?: number
  suggestions?: string[]
}>(), { depth: 0, suggestions: () => [] })

const emit = defineEmits<{ update: [value: SettingValue] }>()

const { t, te } = useI18n()

const label = computed(() => t(`settings.fields.${props.row.key}.label`))
const choiceOptions = computed(() =>
  (props.row.options ?? []).map((v) => ({ value: v, label: t(`settings.fields.${props.row.key}.options.${v}`) })))
const placeholder = computed(() => {
  const k = `settings.fields.${props.row.key}.placeholder`
  return te(k) ? t(k) : ''
})

const chipClass = 'ctv:shrink-0 ctv:rounded ctv:px-1 ctv:py-px ctv:text-3xs ctv:uppercase ctv:tracking-wide '
  + 'ctv:bg-amber-400/15 ctv:text-amber-400'
const iconBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:shrink-0 '
  + 'ctv:rounded ctv:border-none ctv:bg-transparent ctv:p-0.5 ctv:text-muted-foreground/70 '
  + 'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
const suggestionBtnClass = 'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit] '
  + 'ctv:rounded-full ctv:border ctv:border-solid ctv:border-border-subtle ctv:bg-transparent '
  + 'ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:font-mono ctv:text-muted-foreground '
  + 'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
</script>
