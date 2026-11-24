<template>
  <button
    type="button"
    data-testid="item-tag-button"
    v-bind="$attrs"
    :class="[triggerClass, names.length
      ? 'ctv:text-primary-background'
      : 'ctv:text-muted-foreground ctv:hover:text-base-foreground']"
    :title="names.join(', ') || $t('assets.menu.tags')"
    @click.stop="onOpen"
  >
    <IconTag class="ctv:size-3.5 ctv:shrink-0" />
    <span v-if="names.length" class="ctv:max-w-24 ctv:truncate ctv:text-2xs">{{ names.join(', ') }}</span>
  </button>
  <Teleport to="body">
    <div
      v-if="menu"
      class="ctv:fixed ctv:inset-0 ctv:z-[9999]"
      @click.stop="menu = null"
    >
      <div
        data-testid="item-tag-menu"
        class="ctv:absolute ctv:w-44 ctv:max-h-64 ctv:overflow-y-auto ctv:p-1 ctv:rounded ctv:shadow-md ctv:text-xs
               ctv:bg-interface-menu-surface ctv:border ctv:border-border-default"
        :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
        @click.stop
      >
        <div
          v-if="store.categories.length === 0"
          class="ctv:py-2 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60 ctv:text-2xs"
        >
          {{ $t('assets.tagPopover.empty') }}
        </div>
        <button
          v-for="cat in store.categories"
          :key="cat.id"
          type="button"
          :class="[rowClass, 'ctv:text-base-foreground']"
          @click="$emit('toggle', cat.id)"
        >
          <span class="ctv:w-3 ctv:inline-flex ctv:text-primary-background">
            <IconCheck v-if="categoryIds.includes(cat.id)" class="ctv:size-3" />
          </span>
          <span class="ctv:flex-1 ctv:truncate">{{ cat.name }}</span>
        </button>
        <div class="ctv:my-1 ctv:border-t ctv:border-border-subtle" />
        <button type="button" :class="[rowClass, 'ctv:text-primary-background']" @click="onCreate">
          <span class="ctv:w-3 ctv:inline-flex"><IconPlus class="ctv:size-3" /></span>
          <span class="ctv:flex-1 ctv:truncate">{{ $t('assets.tagPopover.create') }}</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { askText } from '@/composables/dialog/useTextInputDialog'
import { TAG_EDITOR_WIDTH } from '@/composables/sidebar/useAssetTagEditor'
import { useAssetStore } from '@/stores/assetStore'

import IconCheck from '~icons/lucide/check'
import IconPlus from '~icons/lucide/plus'
import IconTag from '~icons/lucide/tag'

defineOptions({ inheritAttrs: false })

const TAG_MENU_MAX_HEIGHT = 256

const props = defineProps<{ categoryIds: number[] }>()

const emit = defineEmits<{
  toggle: [categoryId: number]
  create: [name: string]
}>()

const { t } = useI18n()
const store = useAssetStore()

const menu = ref<{ x: number; y: number } | null>(null)

const names = computed(() =>
  store.categories.filter(c => props.categoryIds.includes(c.id)).map(c => c.name))

function onOpen(e: MouseEvent): void {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  menu.value = {
    x: Math.min(Math.max(8, rect.left), window.innerWidth - TAG_EDITOR_WIDTH - 8),
    y: Math.min(rect.bottom + 4, window.innerHeight - TAG_MENU_MAX_HEIGHT - 8),
  }
}

async function onCreate(): Promise<void> {
  menu.value = null
  const name = (await askText({
    title: t('assets.category.new'),
    label: t('assets.category.newPrompt'),
  }))?.trim()
  if (name) emit('create', name)
}

const triggerClass = 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:shrink-0 ctv:[font-family:inherit] '
  + 'ctv:rounded-md ctv:border-none ctv:bg-transparent ctv:p-1 ctv:hover:bg-secondary-background-hover'
const rowClass = 'ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:px-1.5 ctv:py-1 ctv:rounded-sm ctv:cursor-pointer '
  + 'ctv:text-left ctv:text-2xs ctv:[font-family:inherit] ctv:bg-transparent ctv:border-none '
  + 'ctv:hover:bg-secondary-background-hover'
</script>
