<template>
  <Teleport to="body">
    <div
      v-if="tagMenu"
      class="ctv:fixed ctv:inset-0 ctv:z-[9999]"
      @click="closeTagMenu"
      @wheel.prevent.stop
    >
      <div
        class="ctv:absolute ctv:w-44 ctv:max-h-64 ctv:overflow-y-auto ctv:p-1 ctv:rounded ctv:shadow-md ctv:text-xs
               ctv:bg-interface-menu-surface ctv:border ctv:border-border-default"
        :style="tagMenuStyle"
        @click.stop
      >
        <button
          type="button"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:px-1.5 ctv:py-1 ctv:rounded-sm ctv:cursor-pointer
                 ctv:text-left ctv:text-2xs ctv:bg-transparent ctv:border-none ctv:text-base-foreground
                 ctv:hover:bg-secondary-background-hover"
          @click.stop="setUncategorized"
        >
          <span class="ctv:w-3 ctv:inline-block ctv:text-primary-background"><i v-if="tagMenuIsUncategorized()" class="pi pi-check" /></span>
          <span class="ctv:flex-1 ctv:truncate ctv:italic ctv:text-muted-foreground">{{ $t('assets.category.none') }}</span>
        </button>
        <div class="ctv:my-1 ctv:border-t ctv:border-border-subtle"></div>
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:px-1.5 ctv:py-1 ctv:rounded-sm ctv:cursor-pointer
                 ctv:text-left ctv:text-2xs ctv:bg-transparent ctv:border-none ctv:text-base-foreground
                 ctv:hover:bg-secondary-background-hover"
          @click.stop="toggleOutputTag(cat.id)"
        >
          <span class="ctv:w-3 ctv:inline-block ctv:text-primary-background"><i v-if="tagMenuHas(cat.id)" class="pi pi-check" /></span>
          <span class="ctv:flex-1 ctv:truncate">{{ cat.name }}</span>
        </button>
        <div v-if="categories.length" class="ctv:my-1 ctv:border-t ctv:border-border-subtle"></div>
        <button
          type="button"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:px-1.5 ctv:py-1 ctv:rounded-sm ctv:cursor-pointer
                 ctv:text-left ctv:text-2xs ctv:bg-transparent ctv:border-none ctv:text-primary-background
                 ctv:hover:bg-secondary-background-hover"
          @click.stop="onCreateCategory"
        >
          <span class="ctv:w-3 ctv:inline-block"><i class="pi pi-plus" /></span>
          <span class="ctv:flex-1 ctv:truncate">{{ $t('assets.tagPopover.create') }}</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { askText } from '@/composables/dialog/useTextInputDialog'
import { useOutputAssetTagging } from '@/composables/stages/useOutputAssetTagging'

const { t } = useI18n()

const {
  tagMenu,
  categories,
  tagMenuStyle,
  nameFromUrl,
  isSaved,
  openTagMenu,
  closeTagMenu,
  tagMenuHas,
  tagMenuIsUncategorized,
  setUncategorized,
  toggleOutputTag,
  createCategoryAndTag,
} = useOutputAssetTagging()

async function onCreateCategory(): Promise<void> {
  const name = (await askText({
    title: t('assets.category.new'),
    label: t('assets.category.newPrompt'),
  }))?.trim()
  if (!name) return
  await createCategoryAndTag(name)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && tagMenu.value) closeTagMenu()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function open(url: string, e: MouseEvent, mediaType = 'model', name?: string): void {
  openTagMenu(url, name ?? nameFromUrl(url), e, mediaType)
}

defineExpose({ open, isSaved })
</script>
