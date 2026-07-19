<template>
  <div class="ctv:flex ctv:flex-col ctv:size-full ctv:overflow-hidden ctv:text-xs ctv:text-base-foreground">
    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2.5
                ctv:bg-interface-panel-surface ctv:border-b ctv:border-border-subtle">
      <span class="ctv:flex-1 ctv:font-semibold ctv:text-sm">{{ $t('stagePresets.panel.title') }}</span>
    </div>

    <div class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-2.5 ctv:flex ctv:flex-col ctv:gap-2.5">
      <div
        v-if="groups.length === 0"
        class="ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60"
      >
        {{ $t('stagePresets.panel.empty') }}
      </div>

      <section v-for="group in groups" :key="group.kind">
        <button
          :class="sectionToggle"
          :aria-expanded="!isCollapsed(group.kind)"
          @click="toggleGroup(group.kind)"
        >
          <i :class="['pi', isCollapsed(group.kind) ? 'pi-chevron-right' : 'pi-chevron-down', 'ctv:w-2.5 ctv:text-2xs ctv:text-muted-foreground']" />
          <span class="ctv:flex-1 ctv:text-left ctv:truncate">{{ group.label }}</span>
          <span class="ctv:text-2xs ctv:tabular-nums ctv:text-muted-foreground">{{ group.presets.length }}</span>
        </button>
        <div v-show="!isCollapsed(group.kind)" class="ctv:mt-1.5 ctv:flex ctv:flex-col ctv:gap-1">
          <div
            v-for="p in group.presets"
            :key="p.id"
            class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-1.5 ctv:px-2 ctv:rounded-lg
                   ctv:bg-secondary-background ctv:border ctv:border-border-subtle"
          >
            <span class="ctv:flex-1 ctv:min-w-0 ctv:truncate ctv:font-semibold">{{ p.name }}</span>
            <span
              v-if="p.builtin"
              class="ctv:inline-flex ctv:items-center ctv:justify-center ctv:shrink-0 ctv:p-1 ctv:text-muted-foreground"
              :title="$t('stagePresets.builtin')"
            >
              <IconLock class="ctv:size-3.5" />
            </span>
            <template v-else>
              <button
                :class="iconBtnClass"
                :title="$t('stagePresets.panel.rename')"
                @click="onRename(p)"
              >
                <IconPencil class="ctv:size-3.5" />
              </button>
              <button
                :class="[iconBtnClass, 'ctv:hover:text-destructive-background']"
                :title="$t('stagePresets.delete')"
                @click="onDelete(p)"
              >
                <IconTrash2 class="ctv:size-3.5" />
              </button>
            </template>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePresetsPanel } from '@/composables/sidebar/usePresetsPanel'

import IconLock from '~icons/lucide/lock'
import IconPencil from '~icons/lucide/pencil'
import IconTrash2 from '~icons/lucide/trash-2'

const props = defineProps<{ active?: boolean }>()

const { groups, isCollapsed, toggleGroup, onRename, onDelete } = usePresetsPanel(() => props.active)

const sectionToggle = 'ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:py-1 ctv:px-0 ctv:cursor-pointer ctv:[font-family:inherit]'
  + ' ctv:bg-transparent ctv:border-none ctv:text-inherit ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:font-semibold ctv:text-muted-foreground'
  + ' ctv:hover:text-base-foreground'
const iconBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:shrink-0 '
  + 'ctv:rounded-md ctv:border-none ctv:bg-transparent ctv:p-1 ctv:text-muted-foreground '
  + 'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground '
  + 'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
</script>
