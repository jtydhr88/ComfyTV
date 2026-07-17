<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-3 ctv:min-h-[320px]">
    <p class="ctv:m-0 ctv:text-xs ctv:leading-relaxed ctv:text-muted-foreground">
      {{ $t('workflowLink.intro') }}
    </p>

    <input
      v-model="filter"
      type="text"
      :placeholder="$t('workflowLink.searchPlaceholder')"
      class="ctv:h-8 ctv:px-2.5 ctv:rounded-sm ctv:text-xs
             ctv:bg-secondary-background ctv:text-base-foreground
             ctv:border ctv:border-border-default ctv:focus-visible:outline-none"
    >

    <div class="ctv:flex-1 ctv:min-h-0 ctv:max-h-[46vh] ctv:overflow-y-auto ctv:-mx-1 ctv:px-1">
      <p v-if="loading" class="ctv:text-xs ctv:text-muted-foreground ctv:py-6 ctv:text-center">
        {{ $t('workflowLink.loading') }}
      </p>
      <p v-else-if="error" class="ctv:text-xs ctv:text-destructive-foreground ctv:py-6 ctv:text-center">
        {{ error }}
      </p>
      <p v-else-if="!rows.length" class="ctv:text-xs ctv:text-muted-foreground ctv:py-6 ctv:text-center">
        {{ $t('workflowLink.empty') }}
      </p>

      <ul v-else class="ctv:list-none ctv:m-0 ctv:p-0 ctv:flex ctv:flex-col ctv:gap-px">
        <li v-for="row in rows" :key="row.node.key">
          <div
            v-if="row.node.type === 'folder'"
            class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:h-7 ctv:pr-2 ctv:rounded-sm
                   ctv:cursor-pointer ctv:select-none ctv:text-xs ctv:text-base-foreground
                   ctv:hover:bg-secondary-background"
            :style="{ paddingLeft: `${8 + row.depth * 16}px` }"
            @click="toggleFolder(row.node, $event)"
          >
            <IconChevronRight
              class="ctv:w-3.5 ctv:h-3.5 ctv:shrink-0 ctv:text-muted-foreground ctv:transition-transform"
              :class="isExpanded(row.node) ? 'ctv:rotate-90' : ''"
            />
            <IconFolderOpen
              v-if="isExpanded(row.node)"
              class="ctv:w-3.5 ctv:h-3.5 ctv:shrink-0 ctv:text-muted-foreground"
            />
            <IconFolder v-else class="ctv:w-3.5 ctv:h-3.5 ctv:shrink-0 ctv:text-muted-foreground" />
            <span class="ctv:truncate">{{ row.node.label }}</span>
            <span
              class="ctv:text-[10px] ctv:leading-none ctv:px-1.5 ctv:py-0.5 ctv:rounded-full
                     ctv:bg-secondary-background ctv:text-muted-foreground"
            >
              {{ row.node.leafCount }}
            </span>
          </div>

          <div
            v-else
            class="ctv:group ctv:flex ctv:items-center ctv:gap-1.5 ctv:h-7 ctv:pr-1.5 ctv:rounded-sm
                   ctv:text-xs ctv:hover:bg-secondary-background"
            :style="{ paddingLeft: `${8 + row.depth * 16 + 18}px` }"
            :title="row.node.wf.path"
          >
            <IconFileJson class="ctv:w-3.5 ctv:h-3.5 ctv:shrink-0 ctv:text-muted-foreground" />
            <span class="ctv:flex-1 ctv:min-w-0 ctv:truncate ctv:text-base-foreground">
              {{ row.node.wf.name }}
            </span>
            <span
              v-if="row.node.wf.is_linked"
              class="ctv:text-[10px] ctv:px-1.5 ctv:py-0.5 ctv:rounded ctv:bg-primary-background/20 ctv:text-primary-foreground"
            >
              {{ $t('workflowLink.linkedBadge') }}
            </span>
            <span
              class="ctv:flex ctv:gap-1 ctv:opacity-0 ctv:group-hover:opacity-100 ctv:transition-opacity"
              :class="busyPath === row.node.wf.path ? 'ctv:opacity-100' : ''"
            >
              <button
                v-if="row.node.wf.is_linked"
                type="button"
                :class="btnGhost"
                :disabled="busyPath === row.node.wf.path"
                @click="onUnlink(row.node.wf)"
              >
                {{ busyPath === row.node.wf.path ? $t('workflowLink.unlinking') : $t('workflowLink.unlink') }}
              </button>
              <button
                v-else
                type="button"
                :class="btnPrimary"
                :disabled="busyPath === row.node.wf.path"
                @click="onLink(row.node.wf)"
              >
                {{ busyPath === row.node.wf.path ? $t('workflowLink.linking') : $t('workflowLink.link') }}
              </button>
            </span>
          </div>
        </li>
      </ul>
    </div>

    <div class="ctv:flex ctv:justify-end ctv:gap-2 ctv:border-t ctv:border-border-subtle ctv:pt-2.5">
      <button type="button" :class="btnGhost" @click="onClose">
        {{ $t('dialog.close') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconFileJson from '~icons/lucide/file-json'
import IconFolder from '~icons/lucide/folder'
import IconFolderOpen from '~icons/lucide/folder-open'

import { useWorkflowTree } from '@/composables/dialog/useWorkflowTree'

const props = defineProps<{
  kind: string
  onLinked: (result: { label: string }) => void
  onClose: () => void
}>()

const {
  loading,
  error,
  filter,
  busyPath,
  rows,
  isExpanded,
  toggleFolder,
  load,
  onLink,
  onUnlink,
} = useWorkflowTree(props)

onMounted(load)

const btnGhost = 'ctv:appearance-none ctv:border-none ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:focus-visible:outline-none ctv:h-6 ctv:px-2.5 ctv:rounded-sm ctv:text-[11px] ' +
  'ctv:bg-secondary-background ctv:text-muted-foreground ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
const btnPrimary = 'ctv:appearance-none ctv:border-none ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:focus-visible:outline-none ctv:h-6 ctv:px-2.5 ctv:rounded-sm ctv:text-[11px] ctv:font-medium ' +
  'ctv:bg-primary-background ctv:text-primary-foreground ctv:hover:opacity-90 ' +
  'ctv:disabled:opacity-50 ctv:disabled:cursor-not-allowed'
</script>
