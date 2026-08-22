<template>
  <div v-if="items.length" class="v2-corner" @pointerdown.stop>
    <button
      v-if="mt === 'image'"
      type="button"
      class="v2-corner__btn"
      :title="t('stage.action.viewFull')"
      @click.stop="onView"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 4H5.5A1.5 1.5 0 004 5.5V9M15 4h3.5A1.5 1.5 0 0120 5.5V9M9 20H5.5A1.5 1.5 0 014 18.5V15M15 20h3.5a1.5 1.5 0 001.5-1.5V15" />
      </svg>
    </button>
    <button
      type="button"
      class="v2-corner__btn"
      :class="{ 'v2-corner__btn--saved': savedNow }"
      :data-done="done ? '1' : ''"
      :title="t('stage.action.loadAsset')"
      @click.stop="onSave"
    >
      <svg viewBox="0 0 24 24" :fill="savedNow ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2">
        <path d="M6.5 3.5h11a1 1 0 011 1V21l-6.5-4-6.5 4V4.5a1 1 0 011-1z" />
      </svg>
    </button>
    <button
      type="button"
      class="v2-corner__btn"
      :title="t('stage.action.addTag')"
      @click.stop="onTag($event)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3.5 11.2V5a1.5 1.5 0 011.5-1.5h6.2a2 2 0 011.4.6l7.4 7.4a2 2 0 010 2.8l-5.7 5.7a2 2 0 01-2.8 0l-7.4-7.4a2 2 0 01-.6-1.4z" />
        <circle cx="8.3" cy="8.3" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    </button>
  </div>
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
        <button type="button" :class="menuItemClass" @click.stop="setUncategorized">
          <span class="ctv:w-3 ctv:inline-block ctv:text-primary-background"><i v-if="tagMenuIsUncategorized()" class="pi pi-check" /></span>
          <span class="ctv:flex-1 ctv:truncate ctv:italic ctv:text-muted-foreground">{{ t('assets.category.none') }}</span>
        </button>
        <div class="ctv:my-1 ctv:border-t ctv:border-border-subtle"></div>
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          :class="menuItemClass"
          @click.stop="toggleOutputTag(cat.id)"
        >
          <span class="ctv:w-3 ctv:inline-block ctv:text-primary-background"><i v-if="tagMenuHas(cat.id)" class="pi pi-check" /></span>
          <span class="ctv:flex-1 ctv:truncate">{{ cat.name }}</span>
        </button>
        <div v-if="categories.length" class="ctv:my-1 ctv:border-t ctv:border-border-subtle"></div>
        <button type="button" :class="[menuItemClass, 'ctv:text-primary-background']" @click.stop="onCreateCategory">
          <span class="ctv:w-3 ctv:inline-block"><i class="pi pi-plus" /></span>
          <span class="ctv:flex-1 ctv:truncate">{{ t('assets.tagPopover.create') }}</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useTimeoutFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { askText } from '@/composables/dialog/useTextInputDialog'
import { useOutputAssetTagging } from '@/composables/stages/useOutputAssetTagging'
import { openLightbox } from '@/composables/useLightbox'
import type { StageState } from '@/stores/stageStore'

const { t } = useI18n()

const props = defineProps<{
  state: StageState
  source: 'batch' | 'pool'
  onAction: (id: string, context?: unknown) => void
  mediaType?: 'image' | 'video' | 'audio'
}>()

const mt = computed(() => props.mediaType ?? 'image')

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

const items = computed<Array<{ url: string; label: string }>>(() => {
  const raw = props.source === 'pool' ? props.state.pool : props.state.output
  const str = String(raw ?? '')
  try {
    const data = JSON.parse(str)
    const images = Array.isArray(data?.images) ? data.images : []
    const cells = images
      .map((im: any) => ({ url: String(im?.image_url ?? ''), label: String(im?.label ?? '') }))
      .filter((c: any) => c.url)
    if (cells.length) return cells
  } catch { }
  return props.source === 'batch' && str && !str.trim().startsWith('{')
    ? [{ url: str, label: '' }]
    : []
})

const idx = computed(() => {
  const i = Number(props.state.pickedIndex)
  return Math.min(Math.max(Number.isFinite(i) && i >= 1 ? i : 1, 1), Math.max(items.value.length, 1))
})

const current = computed(() => items.value[idx.value - 1] ?? null)
const savedNow = computed(() => (current.value ? isSaved(current.value.url) : false))

function onView() {
  if (!items.value.length) return
  openLightbox(
    items.value.map((it) => ({ url: it.url, label: it.label || nameFromUrl(it.url) })),
    idx.value - 1,
  )
}

const done = ref(false)
const doneFlash = useTimeoutFn(() => { done.value = false }, 1200, { immediate: false })
function onSave() {
  const c = current.value
  if (!c) return
  props.onAction('load-asset', {
    imageUrl: c.url,
    label: c.label || nameFromUrl(c.url),
    mediaType: mt.value,
  })
  done.value = true
  doneFlash.stop()
  doneFlash.start()
}

function onTag(e: MouseEvent) {
  const c = current.value
  if (!c) return
  openTagMenu(c.url, c.label || nameFromUrl(c.url), e, mt.value)
}

async function onCreateCategory() {
  const name = (await askText({
    title: t('assets.category.new'),
    label: t('assets.category.newPrompt'),
  }))?.trim()
  if (!name) return
  await createCategoryAndTag(name)
}

const menuItemClass = 'ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:px-1.5 ctv:py-1 ctv:rounded-sm ctv:cursor-pointer '
  + 'ctv:text-left ctv:text-2xs ctv:bg-transparent ctv:border-none ctv:text-base-foreground '
  + 'ctv:hover:bg-secondary-background-hover'
</script>

<style scoped>
.v2-corner {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.v2-corner__btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: rgba(20, 20, 24, 0.66);
  backdrop-filter: blur(4px);
  color: #ececf1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.v2-corner__btn svg { width: 13px; height: 13px; }
.v2-corner__btn:hover { background: rgba(20, 20, 24, 0.9); }
.v2-corner__btn--saved { color: #a78bfa; }
.v2-corner__btn[data-done='1'] {
  background: #a78bfa;
  color: #17171b;
}
</style>
