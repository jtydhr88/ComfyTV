<template>
  <div class="ctv:min-w-64 ctv:max-w-md ctv:max-h-60 ctv:overflow-y-auto ctv:rounded ctv:text-xs
              ctv:bg-interface-menu-surface ctv:text-base-foreground
              ctv:border ctv:border-border-default ctv:shadow-md">
    <template v-if="!creating">
      <div v-if="imageItems.length"
           class="ctv:py-1 ctv:px-2 ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
        {{ $t('mention.imageSlots') }}
      </div>
      <div
        v-for="(item, i) in imageItems"
        :key="itemKey(item)"
        :class="[
          'ctv:flex ctv:items-center ctv:gap-2 ctv:py-1 ctv:px-2 ctv:cursor-pointer',
          'ctv:hover:bg-interface-menu-component-surface-hovered',
          i === activeIndex ? 'ctv:bg-interface-menu-component-surface-selected' : '',
        ]"
        :title="itemTitle(item)"
        @mousedown.prevent
        @click="selectItem(i)"
      >
        <span
          class="ctv:shrink-0 ctv:size-6 ctv:rounded-sm ctv:overflow-hidden ctv:bg-black/30 ctv:border"
          :style="{ borderColor: item.color }"
        >
          <img v-if="item.url" :src="item.url" class="ctv:block ctv:size-full ctv:object-cover" draggable="false" />
        </span>
        <span class="ctv:font-mono ctv:shrink-0" :style="{ color: item.color }">@{{ $t('mention.imageChip', { n: item.slot }) }}</span>
        <span class="ctv:ml-auto ctv:text-muted-foreground ctv:whitespace-nowrap">→ {{ $t('mention.imageExpand', { n: item.ordinal }) }}</span>
      </div>
      <div
        v-for="(item, j) in snippetItems"
        :key="itemKey(item)"
        :class="[
          'ctv:flex ctv:items-center ctv:gap-2 ctv:py-1 ctv:px-2 ctv:cursor-pointer',
          'ctv:hover:bg-interface-menu-component-surface-hovered',
          j === 0 && imageItems.length ? 'ctv:border-t ctv:border-border-subtle' : '',
          imageItems.length + j === activeIndex ? 'ctv:bg-interface-menu-component-surface-selected' : '',
        ]"
        :title="itemTitle(item)"
        @mousedown.prevent
        @click="selectItem(imageItems.length + j)"
      >
        <span class="ctv:font-mono ctv:text-base-foreground ctv:shrink-0">@{{ item.module.label }}</span>
        <span class="ctv:text-muted-foreground ctv:overflow-hidden ctv:text-ellipsis ctv:whitespace-nowrap">{{ item.module.body }}</span>
      </div>
      <div
        v-if="canCreate"
        :class="[
          'ctv:flex ctv:items-baseline ctv:gap-2 ctv:py-1 ctv:px-2 ctv:cursor-pointer ctv:border-t ctv:border-border-subtle',
          'ctv:hover:bg-interface-menu-component-surface-hovered',
          activeIndex === items.length ? 'ctv:bg-interface-menu-component-surface-selected' : '',
        ]"
        @mousedown.prevent
        @click="startCreate"
      >
        <span class="ctv:font-mono ctv:text-base-foreground ctv:shrink-0">{{ $t('mention.create') }}</span>
        <span class="ctv:text-muted-foreground ctv:overflow-hidden ctv:text-ellipsis ctv:whitespace-nowrap">
          {{ $t('mention.newFragment') }} <code>@{{ query }}</code>
        </span>
      </div>
      <div v-if="items.length === 0 && !canCreate"
           class="ctv:py-1.5 ctv:px-2 ctv:italic ctv:text-xs ctv:text-muted-foreground">
        {{ query ? $t('mention.invalidLabel') : $t('mention.noEntries') }}
      </div>
    </template>

    <div v-else class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-2" @mousedown.stop>
      <div class="ctv:text-xs ctv:text-muted-foreground">
        {{ $t('mention.createFragment') }} <code class="ctv:text-base-foreground ctv:font-mono">@{{ pendingLabel }}</code>
      </div>
      <textarea
        ref="createTa"
        v-model="pendingContent"
        rows="3"
        class="ctv:w-full ctv:py-1.5 ctv:px-2 ctv:rounded-sm ctv:resize-y ctv:outline-none ctv:box-border ctv:text-xs ctv:leading-snug
               ctv:bg-secondary-background ctv:text-base-foreground
               ctv:border ctv:border-border-default
               ctv:focus:border-primary-background"
        :placeholder="$t('mention.contentPlaceholder')"
        @keydown.stop="onCreateKeydown"
      />
      <div class="ctv:flex ctv:justify-end ctv:gap-1.5">
        <button :class="actionBtn()" @click="cancelCreate">{{ $t('stage.cancel') }}</button>
        <button
          :class="actionBtn('save')"
          :disabled="!pendingContent.trim()"
          @click="saveCreate"
        >{{ $t('mention.save') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MentionSuggestionItem } from '@/composables/stages/useMentionSuggestion'
import {
  mentionItemKey as itemKey,
  useMentionList,
  type MentionCommandAttrs,
} from '@/composables/stages/useMentionList'

const props = defineProps<{
  items: MentionSuggestionItem[]
  command: (attrs: MentionCommandAttrs) => void
  query: string
}>()

const { t } = useI18n()

const createTa = ref<HTMLTextAreaElement | null>(null)

const {
  imageItems,
  snippetItems,
  canCreate,
  activeIndex,
  creating,
  pendingLabel,
  pendingContent,
  startCreate,
  cancelCreate,
  saveCreate,
  onCreateKeydown,
  selectItem,
  onKeyDown,
} = useMentionList({
  items: () => props.items,
  query: () => props.query,
  command: (attrs) => props.command(attrs),
  focusCreate: () => { void nextTick(() => createTa.value?.focus()) },
})

function itemTitle(item: MentionSuggestionItem): string {
  if (item.type === 'imageSlot') {
    return t('mention.imageItemTitle', {
      n: item.slot,
      text: t('mention.imageExpand', { n: item.ordinal }),
    })
  }
  return item.module.body
}

defineExpose({
  onKeyDown({ event }: { event: KeyboardEvent }): boolean {
    return onKeyDown(event)
  },
})

const ACTION_BTN_BASE = 'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-2 ctv:cursor-pointer'
  + ' ctv:touch-manipulation ctv:whitespace-nowrap ctv:appearance-none ctv:border-none ctv:transition-colors'
  + ' ctv:h-6 ctv:rounded-sm ctv:px-2 ctv:py-1 ctv:text-xs ctv:font-medium'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'
const ACTION_BTN_VARIANTS = {
  default: ' ctv:bg-secondary-background ctv:text-secondary-foreground ctv:hover:bg-secondary-background-hover',
  save:    ' ctv:bg-primary-background ctv:text-base-foreground ctv:hover:bg-primary-background-hover',
} as const
function actionBtn(variant: keyof typeof ACTION_BTN_VARIANTS = 'default') {
  return ACTION_BTN_BASE + ACTION_BTN_VARIANTS[variant]
}
</script>
