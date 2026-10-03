<template>
  <div
    class="ctv:w-full ctv:mt-1 ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-2 ctv:rounded ctv:text-xs
           ctv:bg-interface-menu-surface ctv:text-base-foreground ctv:border ctv:border-border-default"
    @keydown.escape.stop="$emit('close')"
  >
    <div class="ctv:flex ctv:gap-1.5 ctv:items-center">
      <input
        ref="searchEl"
        v-model="keyword"
        type="text"
        :placeholder="$t('eagle.search')"
        class="ctv:flex-1 ctv:min-w-0 ctv:py-1 ctv:px-1.5 ctv:rounded-sm ctv:outline-none ctv:box-border
               ctv:text-xs ctv:leading-snug ctv:[font-family:inherit]
               ctv:bg-secondary-background ctv:text-base-foreground
               ctv:border ctv:border-border-default ctv:focus:border-primary-background"
      />
      <button
        v-if="aiReady"
        type="button"
        :class="chipClass(aiMode)"
        :title="$t('eagle.ai.tooltip')"
        @click="aiMode = !aiMode"
      >{{ $t('eagle.ai.label') }}</button>
      <select
        v-model="folder"
        class="ctv:w-20 ctv:shrink-0 ctv:py-1 ctv:px-1 ctv:rounded-sm ctv:outline-none ctv:box-border
               ctv:text-xs ctv:[font-family:inherit]
               ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-default"
      >
        <option value="">{{ $t('eagle.folder.all') }}</option>
        <option v-for="f in folders" :key="f.id" :value="f.id">
          {{ `${' '.repeat(f.depth * 2)}${f.name}` }}
        </option>
      </select>
      <button
        type="button"
        :class="closeBtnClass"
        :title="$t('promptAssets.close')"
        @click="$emit('close')"
      ><i class="pi pi-times" /></button>
    </div>

    <div class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1">
      <button
        v-for="m in mediaFilters"
        :key="m || 'all'"
        type="button"
        :class="chipClass(mediaType === m)"
        @click="mediaType = m"
      >{{ m ? $t(`assets.media.${m}`) : $t('assets.media.all') }}</button>
      <span class="ctv:flex-1"></span>
      <span
        class="ctv:inline-flex ctv:items-center ctv:gap-1 ctv:text-3xs ctv:text-muted-foreground"
        :title="mode === 'api' ? '' : $t(`eagle.hint.${mode}`)"
      >
        <span class="ctv:size-2 ctv:rounded-full" :class="modeDotClass" />
        {{ $t(`eagle.mode.${mode}`) }}
      </span>
    </div>

    <div v-if="error"
         class="ctv:py-1 ctv:px-1.5 ctv:rounded ctv:break-all
                ctv:bg-destructive-background/15 ctv:border ctv:border-destructive-background/50
                ctv:text-destructive-background">
      {{ error }}
    </div>

    <div class="comfytv-asset-scroll ctv:h-[224px] ctv:shrink-0 ctv:overflow-y-scroll">
      <div v-if="visibleItems.length === 0"
           class="ctv:py-4 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
        {{ loading ? $t('eagle.loading') : $t('eagle.empty') }}
      </div>
      <div v-else class="ctv:grid ctv:grid-cols-[repeat(auto-fill,minmax(64px,1fr))] ctv:gap-1">
        <button
          v-for="item in visibleItems"
          :key="item.id"
          type="button"
          :class="[
            'ctv:relative ctv:flex ctv:flex-col ctv:p-0 ctv:cursor-pointer ctv:overflow-hidden ctv:rounded',
            'ctv:bg-secondary-background ctv:border ctv:[font-family:inherit]',
            isAdded(item)
              ? 'ctv:border-primary-background'
              : 'ctv:border-border-subtle ctv:hover:border-primary-background/60',
          ]"
          :title="itemTooltip(item)"
          :disabled="pendingId === item.id"
          @click="onPick(item)"
        >
          <img
            :src="eagleThumbUrl(item.id)"
            loading="lazy"
            :class="['ctv:block ctv:w-full ctv:aspect-square ctv:object-cover ctv:bg-black/20',
                     isAdded(item) ? 'ctv:opacity-55' : '']"
            @error="($event.target as HTMLImageElement).style.opacity = '0.15'"
          />
          <span
            class="ctv:absolute ctv:top-0.5 ctv:left-0.5 ctv:px-1 ctv:rounded ctv:text-3xs ctv:uppercase
                   ctv:bg-black/50 ctv:text-white/80"
          >{{ item.ext }}</span>
          <i
            v-if="pendingId === item.id"
            class="pi pi-spin pi-spinner ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:text-3xs ctv:text-white"
          />
          <span
            v-else-if="isAdded(item)"
            class="ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:flex ctv:items-center ctv:justify-center
                   ctv:size-4 ctv:rounded-full ctv:text-3xs ctv:leading-none
                   ctv:bg-primary-background ctv:text-white"
          ><i class="pi pi-check" /></span>
          <span class="ctv:w-full ctv:truncate ctv:py-0.5 ctv:px-1 ctv:text-left ctv:text-3xs ctv:text-muted-foreground">
            {{ item.name || '—' }}
          </span>
        </button>
      </div>
      <div v-if="visibleItems.length > 0 && !exhausted" class="ctv:flex ctv:justify-center ctv:pt-1.5">
        <button type="button" :class="closeBtnClass" class="ctv:!w-auto ctv:px-2" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? $t('eagle.loading') : $t('eagle.loadMore') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { eagleThumbUrl } from '@/api/eagle'
import type { Asset, EagleItem } from '@/api/schemas'
import { importEagleAsset, importedEagleAsset } from '@/composables/sidebar/useEagleImports'
import { useEaglePanel } from '@/composables/sidebar/useEaglePanel'
import { app } from '@/lib/comfyApp'
import { mediaTypeOfExt } from '@/utils/mediaFileTypes'

const props = defineProps<{
  canPick?: () => boolean
  addedIds?: number[]
  mediaTypes?: string[]
}>()

const emit = defineEmits<{
  select: [asset: Asset]
  deselect: [asset: Asset]
  close: []
}>()

const allowed = computed(() => props.mediaTypes ?? ['image', 'video', 'audio'])
const mediaFilters = computed(() => ['', ...allowed.value])

const {
  items,
  folders,
  keyword,
  folder,
  mediaType,
  aiMode,
  aiReady,
  loading,
  loadingMore,
  exhausted,
  error,
  mode,
  loadMore,
} = useEaglePanel(() => true)

const { t } = useI18n()
const searchEl = ref<HTMLInputElement | null>(null)
const pendingId = ref<string | null>(null)

const visibleItems = computed(() =>
  items.value.filter((item) => {
    const kind = mediaTypeOfExt(item.ext)
    return kind !== null && allowed.value.includes(kind)
  }))

function toggle(asset: Asset): void {
  if ((props.addedIds ?? []).includes(asset.id)) emit('deselect', asset)
  else emit('select', asset)
}

function isAdded(item: EagleItem): boolean {
  const asset = importedEagleAsset(item.id)
  return !!asset && (props.addedIds ?? []).includes(asset.id)
}

async function onPick(item: EagleItem): Promise<void> {
  if (pendingId.value) return
  // Capture this picker's guard before awaiting: a newer picker must not
  // receive the result of an import begun in an older thread.
  const canPick = props.canPick
  if (canPick && !canPick()) return
  const known = importedEagleAsset(item.id)
  if (known) {
    toggle(known)
    return
  }
  pendingId.value = item.id
  try {
    const asset = await importEagleAsset(item.id)
    if (canPick && (!canPick() || props.canPick !== canPick)) return
    toggle(asset)
  } catch (e) {
    ;(app as any)?.extensionManager?.toast?.add?.({
      severity: 'error',
      summary: t('eagle.import.failed'),
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  } finally {
    pendingId.value = null
  }
}

function itemTooltip(item: EagleItem): string {
  const dims = item.width && item.height ? `${item.width}×${item.height}` : ''
  return [item.name, dims, item.tags.join(', ')].filter(Boolean).join('\n')
}

const modeDotClass = computed(() => ({
  api: 'ctv:bg-emerald-500',
  disk: 'ctv:bg-amber-500',
  offline: 'ctv:bg-destructive-background',
  disabled: 'ctv:bg-muted-foreground',
}[mode.value]))

function chipClass(active: boolean): string {
  return [
    'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:shrink-0 ctv:cursor-pointer ctv:[font-family:inherit]',
    'ctv:rounded-lg ctv:border ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:transition-colors',
    active
      ? 'ctv:bg-secondary-background-selected ctv:border-primary-background/60 ctv:text-base-foreground'
      : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground',
  ].join(' ')
}

const closeBtnClass = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-6 ctv:shrink-0 ctv:cursor-pointer ctv:[font-family:inherit]',
  'ctv:rounded-sm ctv:border ctv:border-transparent ctv:text-xs ctv:leading-none',
  'ctv:bg-transparent ctv:text-muted-foreground',
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground',
  'ctv:disabled:opacity-50 ctv:disabled:cursor-default',
].join(' ')

onMounted(() => searchEl.value?.focus())
</script>
