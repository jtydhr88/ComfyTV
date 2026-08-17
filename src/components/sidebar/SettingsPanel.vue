<template>
  <div class="ctv:relative ctv:flex ctv:flex-col ctv:size-full ctv:box-border ctv:overflow-hidden ctv:text-xs ctv:text-base-foreground">
    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2.5
                ctv:bg-interface-panel-surface ctv:border-b ctv:border-border-subtle">
      <span class="ctv:flex-1 ctv:font-semibold ctv:text-sm">{{ $t('settings.title') }}</span>
      <button
        :class="primaryBtnClass"
        :disabled="!dirty || saving"
        @click="save"
      >
        {{ saving ? $t('settings.saving') : $t('settings.save') }}
      </button>
    </div>

    <div class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-1.5 ctv:flex ctv:flex-col ctv:gap-1.5">
      <div class="ctv:text-muted-foreground ctv:px-1 ctv:leading-relaxed">
        {{ $t('settings.hint') }}
      </div>

      <div v-if="error" class="ctv:py-1 ctv:px-1.5 ctv:rounded ctv:bg-destructive-background/15 ctv:text-destructive-background">
        {{ error }}
      </div>

      <div
        v-if="loading && rows.length === 0"
        class="ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60"
      >
        {{ $t('settings.loading') }}
      </div>

      <template v-else>
        <div class="ctv:mt-1 ctv:px-1 ctv:font-semibold ctv:text-muted-foreground ctv:uppercase ctv:text-2xs ctv:tracking-wide">
          {{ $t('settings.backup.section') }}
        </div>

        <div
          v-for="row in backupRows"
          :key="row.key"
          class="ctv:flex ctv:flex-col ctv:gap-1 ctv:py-1.5 ctv:px-2 ctv:rounded-lg
                 ctv:bg-secondary-background ctv:border ctv:border-border-subtle"
        >
          <div class="ctv:flex ctv:items-center ctv:gap-2">
            <div class="ctv:flex-1 ctv:min-w-0">
              <div class="ctv:font-semibold">{{ $t(`settings.fields.${row.key}.label`) }}</div>
              <div class="ctv:text-muted-foreground ctv:leading-relaxed">
                {{ $t(`settings.fields.${row.key}.desc`) }}
              </div>
            </div>
            <ComfyTVToggle
              v-if="row.type === 'boolean'"
              :model-value="values[row.key] === true"
              @update:model-value="(v: boolean) => setValue(row.key, v)"
            />
          </div>
          <ComfyTVNumber
            v-if="row.type === 'int'"
            class="ctv:w-28"
            :model-value="Number(values[row.key] ?? row.default)"
            :min="1"
            :precision="0"
            @update:model-value="(v: number | null) => setValue(row.key, v ?? row.default)"
          />
          <ComfyTVText
            v-if="row.type === 'string'"
            :model-value="String(values[row.key] ?? '')"
            :placeholder="placeholderFor(row.key)"
            @update:model-value="(v: string) => setValue(row.key, v)"
          />
        </div>

        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-1 ctv:pt-1">
          <button :class="chipBtnClass" :disabled="backingUp" @click="backupNow">
            {{ backingUp ? $t('settings.backup.running') : $t('settings.backup.now') }}
          </button>
        </div>

        <div class="ctv:mt-2 ctv:px-1 ctv:font-semibold ctv:text-muted-foreground ctv:uppercase ctv:text-2xs ctv:tracking-wide">
          {{ $t('settings.agent.section') }}
        </div>

        <div
          v-for="row in agentRows"
          :key="row.key"
          class="ctv:flex ctv:flex-col ctv:gap-1 ctv:py-1.5 ctv:px-2 ctv:rounded-lg
                 ctv:bg-secondary-background ctv:border ctv:border-border-subtle"
        >
          <div class="ctv:flex ctv:items-center ctv:gap-2">
            <div class="ctv:flex-1 ctv:min-w-0">
              <div class="ctv:font-semibold">{{ $t(`settings.fields.${row.key}.label`) }}</div>
              <div class="ctv:text-muted-foreground ctv:leading-relaxed">
                {{ $t(`settings.fields.${row.key}.desc`) }}
              </div>
            </div>
            <ComfyTVToggle
              v-if="row.type === 'boolean'"
              :model-value="values[row.key] === true"
              :disabled="row.key === 'enable-bot' && botToggleLocked"
              @update:model-value="(v: boolean) => setValue(row.key, v)"
            />
          </div>
          <ComfyTVText
            v-if="row.type === 'string'"
            :model-value="String(values[row.key] ?? '')"
            :placeholder="placeholderFor(row.key)"
            @update:model-value="(v: string) => setValue(row.key, v)"
          />
          <div
            v-if="modelSuggestions(row.key).length"
            class="ctv:flex ctv:flex-wrap ctv:gap-1"
          >
            <button
              v-for="m in modelSuggestions(row.key)"
              :key="m"
              :class="[suggestionBtnClass,
                       values[row.key] === m ? 'ctv:border-node-component-border' : '']"
              @click="setValue(row.key, m)"
            >{{ m }}</button>
          </div>
        </div>
        <div
          v-if="backupResult"
          class="ctv:py-1 ctv:px-1.5 ctv:rounded ctv:break-all"
          :class="backupResult.ok
            ? 'ctv:bg-emerald-500/10 ctv:text-emerald-400'
            : 'ctv:bg-destructive-background/15 ctv:text-destructive-background'"
        >
          <template v-if="backupResult.ok">
            ✓ {{ $t('settings.backup.ok', { path: backupResult.path ?? '' }) }}
          </template>
          <template v-else>
            ✗ {{ $t('settings.backup.failed', { error: backupResult.error ?? '' }) }}
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ComfyTVNumber from '@/components/widgets/ComfyTVNumber.vue'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import { useSettingsPanel } from '@/composables/sidebar/useSettingsPanel'

const props = defineProps<{ active?: boolean }>()

const { t, te } = useI18n()

const {
  rows,
  backupRows,
  agentRows,
  botToggleLocked,
  values,
  loading,
  saving,
  backingUp,
  error,
  dirty,
  backupResult,
  setValue,
  save,
  backupNow,
  modelSuggestions,
} = useSettingsPanel(() => props.active)

function placeholderFor(key: string): string {
  const k = `settings.fields.${key}.placeholder`
  return te(k) ? t(k) : ''
}

const primaryBtnClass = 'ctv:shrink-0 ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit] '
  + 'ctv:rounded-lg ctv:border-none ctv:px-2 ctv:py-1 ctv:text-xs '
  + 'ctv:bg-interface-menu-component-surface-hovered ctv:text-base-foreground ctv:hover:brightness-110 '
  + 'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
const chipBtnClass = 'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit] '
  + 'ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-transparent ctv:px-2 ctv:py-1 ctv:text-xs '
  + 'ctv:text-base-foreground ctv:hover:bg-secondary-background-hover '
  + 'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
const suggestionBtnClass = 'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit] '
  + 'ctv:rounded-full ctv:border ctv:border-solid ctv:border-border-subtle ctv:bg-transparent '
  + 'ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:font-mono ctv:text-muted-foreground '
  + 'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
</script>
