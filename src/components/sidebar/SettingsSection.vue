<template>
  <section class="ctv:shrink-0 ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:overflow-hidden">
    <div class="ctv:flex ctv:items-center ctv:gap-2 ctv:px-2 ctv:py-1.5">
      <button :class="headBtnClass" :aria-expanded="!collapsed" @click="emit('toggle')">
        <i :class="['pi', collapsed ? 'pi-chevron-right' : 'pi-chevron-down', 'ctv:w-2.5 ctv:text-2xs']" />
        <span class="ctv:truncate">{{ title }}</span>
        <span v-if="section.experimental" :class="chipClass">{{ $t('settings.experimental') }}</span>
        <span v-if="section.dirty" class="ctv:shrink-0 ctv:size-1.5 ctv:rounded-full ctv:bg-amber-400" />
      </button>
      <span
        v-if="section.probe"
        class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:normal-case ctv:tracking-normal ctv:text-muted-foreground"
      >
        <span :class="['ctv:size-1.5 ctv:rounded-full', probeDotClass[section.probe]]" />
        {{ $t(`settings.status.${section.probe}`) }}
      </span>
      <template v-if="section.master">
        <span class="ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground">
          {{ masterOn ? $t('settings.on') : $t('settings.off') }}
        </span>
        <ComfyTVToggle :model-value="masterOn" @update:model-value="(v: boolean) => emit('master', v)" />
      </template>
    </div>
    <div
      v-show="!collapsed && (section.master === null || masterOn)"
      class="ctv:border-t ctv:border-border-subtle ctv:flex ctv:flex-col ctv:divide-y ctv:divide-border-subtle"
    >
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import ComfyTVToggle from '@/components/widgets/ComfyTVToggle.vue'
import type { ProbeState, SettingSection } from '@/composables/sidebar/useSettingsPanel'

defineProps<{
  section: SettingSection
  title: string
  collapsed: boolean
  masterOn: boolean
}>()

const emit = defineEmits<{ toggle: []; master: [value: boolean] }>()

const probeDotClass: Record<ProbeState, string> = {
  checking: 'ctv:bg-muted-foreground/40',
  online: 'ctv:bg-emerald-400',
  offline: 'ctv:bg-destructive-background',
}

const headBtnClass = 'ctv:flex-1 ctv:min-w-0 ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-0 ctv:px-0 ctv:cursor-pointer '
  + 'ctv:[font-family:inherit] ctv:bg-transparent ctv:border-none ctv:text-inherit ctv:text-left '
  + 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:font-semibold ctv:text-muted-foreground '
  + 'ctv:hover:text-base-foreground'
const chipClass = 'ctv:shrink-0 ctv:rounded ctv:px-1 ctv:py-px ctv:text-3xs ctv:tracking-wide '
  + 'ctv:bg-amber-400/15 ctv:text-amber-400'
</script>
