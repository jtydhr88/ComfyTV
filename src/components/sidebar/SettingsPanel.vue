<template>
  <TooltipProvider>
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
        <span v-if="dirtyCount && !saving">({{ dirtyCount }})</span>
      </button>
    </div>

    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-1.5 ctv:pt-1.5">
      <IconSearch class="ctv:shrink-0 ctv:size-3.5 ctv:text-muted-foreground" />
      <ComfyTVText
        class="ctv:flex-1"
        :model-value="query"
        :placeholder="$t('settings.search')"
        @update:model-value="(v: string) => query = v"
      />
    </div>

    <div class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-1.5 ctv:flex ctv:flex-col ctv:gap-1.5">
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
        <SettingsSection
          v-for="s in sections"
          :key="s.id"
          :section="s"
          :title="$t(`settings.${s.id}.section`)"
          :collapsed="isCollapsed(s.id)"
          :master-on="s.master !== null && values[s.master.key] === true"
          @toggle="toggleCollapsed(s.id)"
          @master="(v) => s.master && setValue(s.master.key, v)"
        >
          <SettingItem
            v-for="row in s.rows"
            :key="row.key"
            :row="row"
            :value="values[row.key]"
            :depth="depthOf(row.key)"
            :suggestions="modelSuggestions(row.key)"
            @update="(v) => setValue(row.key, v)"
          />
          <div v-if="s.id === 'backup'" class="ctv:flex ctv:flex-col ctv:gap-1 ctv:px-2 ctv:py-1.5">
            <div>
              <button :class="chipBtnClass" :disabled="backingUp" @click="backupNow">
                {{ backingUp ? $t('settings.backup.running') : $t('settings.backup.now') }}
              </button>
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
          </div>
          <div v-if="s.id === 'agent' && skillsVisible && !query" class="ctv:px-2 ctv:py-1">
            <SkillsSection
              :active="props.active"
              :collapsed="isCollapsed('skills')"
              @toggle="toggleCollapsed('skills')"
            />
          </div>
        </SettingsSection>

        <div
          v-if="!sections.length"
          class="ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60"
        >
          {{ $t('settings.noMatch') }}
        </div>
      </template>

      <div class="ctv:mt-auto ctv:pt-2 ctv:px-1 ctv:text-2xs ctv:text-muted-foreground/70 ctv:leading-relaxed">
        {{ $t('settings.hint') }}
      </div>
    </div>
  </div>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import SettingItem from '@/components/sidebar/SettingItem.vue'
import SettingsSection from '@/components/sidebar/SettingsSection.vue'
import SkillsSection from '@/components/sidebar/SkillsSection.vue'
import ComfyTVText from '@/components/widgets/ComfyTVText.vue'
import { depthOf, useSettingsPanel } from '@/composables/sidebar/useSettingsPanel'

import IconSearch from '~icons/lucide/search'

const props = defineProps<{ active?: boolean }>()

const { t } = useI18n()

const {
  rows,
  values,
  query,
  sections,
  skillsVisible,
  loading,
  saving,
  backingUp,
  error,
  dirty,
  dirtyCount,
  backupResult,
  isCollapsed,
  toggleCollapsed,
  setValue,
  save,
  backupNow,
  modelSuggestions,
} = useSettingsPanel(
  () => props.active,
  (key) => `${t(`settings.fields.${key}.label`)} ${t(`settings.fields.${key}.desc`)}`,
)

const primaryBtnClass = 'ctv:shrink-0 ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit] '
  + 'ctv:rounded-lg ctv:border-none ctv:px-2 ctv:py-1 ctv:text-xs '
  + 'ctv:bg-interface-menu-component-surface-hovered ctv:text-base-foreground ctv:hover:brightness-110 '
  + 'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
const chipBtnClass = 'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit] '
  + 'ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-transparent ctv:px-2 ctv:py-1 ctv:text-xs '
  + 'ctv:text-base-foreground ctv:hover:bg-secondary-background-hover '
  + 'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
</script>
