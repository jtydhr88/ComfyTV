<template>
  <div class="ctv:flex ctv:flex-col ctv:size-full ctv:overflow-hidden ctv:text-xs ctv:text-base-foreground">
    <div class="ctv:shrink-0 ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2.5
                ctv:bg-interface-panel-surface ctv:border-b ctv:border-border-subtle">
      <span class="ctv:flex-1 ctv:font-semibold ctv:text-sm">{{ $t('resources.panel.title') }}</span>
    </div>

    <div class="ctv:flex-1 ctv:min-h-0 ctv:overflow-y-auto ctv:p-2.5 ctv:flex ctv:flex-col ctv:gap-2.5">
      <section v-for="group in groups" :key="group.kind">
        <div class="ctv:flex ctv:items-center ctv:gap-1">
          <button
            :class="sectionToggle"
            :aria-expanded="!isCollapsed(group.kind)"
            @click="toggleGroup(group.kind)"
          >
            <i :class="['pi', isCollapsed(group.kind) ? 'pi-chevron-right' : 'pi-chevron-down', 'ctv:w-2.5 ctv:text-2xs ctv:text-muted-foreground']" />
            <span class="ctv:flex-1 ctv:text-left ctv:truncate">{{ group.label }}</span>
            <span class="ctv:text-2xs ctv:tabular-nums ctv:text-muted-foreground">{{ group.resources.length }}</span>
          </button>
          <button
            :class="iconBtnClass"
            :title="$t('resources.upload')"
            @click="fileInputs.get(group.kind)?.click()"
          >
            <IconUpload class="ctv:size-3.5" />
          </button>
          <input
            :ref="(el) => setFileInput(group.kind, el)"
            type="file"
            :accept="group.accept"
            class="ctv:hidden"
            @change="(e) => onUpload(group.kind, e)"
          />
        </div>
        <div v-show="!isCollapsed(group.kind)" class="ctv:mt-1.5 ctv:flex ctv:flex-col ctv:gap-1">
          <div
            v-if="group.resources.length === 0"
            class="ctv:py-2 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60"
          >
            {{ $t('resources.panel.empty') }}
          </div>
          <div
            v-for="r in group.resources"
            :key="r.id"
            class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-1.5 ctv:px-2 ctv:rounded-lg
                   ctv:bg-secondary-background ctv:border ctv:border-border-subtle"
          >
            <span class="ctv:flex-1 ctv:min-w-0 ctv:truncate ctv:font-semibold" :title="r.filename">{{ r.name }}</span>
            <span
              v-if="r.missing"
              class="ctv:shrink-0 ctv:rounded ctv:px-1 ctv:py-0.5 ctv:text-2xs ctv:font-semibold
                     ctv:bg-destructive-background/20 ctv:text-destructive-background"
            >
              {{ $t('resources.missing') }}
            </span>
            <span v-else class="ctv:shrink-0 ctv:text-2xs ctv:tabular-nums ctv:text-muted-foreground">
              {{ formatResourceSize(r.size) }}
            </span>
            <button
              :class="iconBtnClass"
              :title="$t('resources.rename')"
              @click="onRename(r)"
            >
              <IconPencil class="ctv:size-3.5" />
            </button>
            <button
              :class="[iconBtnClass, 'ctv:hover:text-destructive-background']"
              :title="$t('resources.remove')"
              @click="onRemove(r)"
            >
              <IconTrash2 class="ctv:size-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

import type { ResourceKind } from '@/api'
import { formatResourceSize, useResourcesPanel } from '@/composables/sidebar/useResourcesPanel'

import IconPencil from '~icons/lucide/pencil'
import IconTrash2 from '~icons/lucide/trash-2'
import IconUpload from '~icons/lucide/upload'

const props = defineProps<{ active?: boolean }>()

const { groups, isCollapsed, toggleGroup, onRename, onRemove, onUpload } =
  useResourcesPanel(() => props.active)

const fileInputs = new Map<ResourceKind, HTMLInputElement>()

function setFileInput(kind: ResourceKind, el: Element | ComponentPublicInstance | null): void {
  if (el instanceof HTMLInputElement) fileInputs.set(kind, el)
  else fileInputs.delete(kind)
}

const sectionToggle = 'ctv:flex ctv:items-center ctv:gap-1.5 ctv:flex-1 ctv:min-w-0 ctv:py-1 ctv:px-0 ctv:cursor-pointer ctv:[font-family:inherit]'
  + ' ctv:bg-transparent ctv:border-none ctv:text-inherit ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:font-semibold ctv:text-muted-foreground'
  + ' ctv:hover:text-base-foreground'
const iconBtnClass = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:shrink-0 '
  + 'ctv:rounded-md ctv:border-none ctv:bg-transparent ctv:p-1 ctv:text-muted-foreground '
  + 'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground '
  + 'ctv:disabled:opacity-50 ctv:disabled:pointer-events-none'
</script>
