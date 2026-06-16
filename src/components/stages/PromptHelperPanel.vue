<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-2 ctv:mt-1 ctv:p-2 ctv:rounded ctv:text-xs
              ctv:bg-interface-menu-surface ctv:text-base-foreground
              ctv:border ctv:border-border-default">
    <div
      v-for="group in groups"
      :key="group.key"
      class="ctv:flex ctv:flex-col ctv:gap-1"
    >
      <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
        {{ $t(group.key) }}
      </span>
      <div class="ctv:flex ctv:flex-wrap ctv:gap-1">
        <button
          v-for="m in group.modules"
          :key="m.id"
          type="button"
          :class="m.kind === 'template' ? templateClass : chipClass(isActive(m))"
          :title="m.body"
          @click="$emit('apply', m)"
        >{{ m.labelKey ? $t(m.labelKey) : m.label }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PromptModule } from '@/composables/stages/promptModules/types'
import type { PanelGroup } from '@/composables/stages/usePromptModules'

defineProps<{
  groups: PanelGroup[]
  isActive: (m: PromptModule) => boolean
}>()

defineEmits<{
  apply: [module: PromptModule]
}>()

const CHIP_BASE = 'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit]'
  + ' ctv:rounded-full ctv:border ctv:py-0.5 ctv:px-2 ctv:text-2xs ctv:transition-colors'

function chipClass(active: boolean): string {
  return CHIP_BASE + (active
    ? ' ctv:bg-primary-background/25 ctv:border-primary-background/60 ctv:text-primary-background'
    : ' ctv:bg-secondary-background ctv:border-border-default ctv:text-muted-foreground'
      + ' ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground')
}

const templateClass = 'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit]'
  + ' ctv:rounded ctv:border ctv:py-0.5 ctv:px-2 ctv:text-2xs ctv:transition-colors'
  + ' ctv:bg-secondary-background ctv:border-border-default ctv:text-base-foreground'
  + ' ctv:hover:bg-primary-background/20 ctv:hover:border-primary-background/50'
  + ' ctv:hover:text-primary-background'
</script>
