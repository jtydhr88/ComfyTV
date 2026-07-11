<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full ctv:p-2 ctv:box-border ctv:text-xs ctv:text-base-foreground">
    <button
      ref="triggerEl"
      type="button"
      class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:h-8 ctv:px-1.5 ctv:cursor-pointer
             ctv:rounded ctv:border ctv:border-border-default ctv:bg-secondary-background
             ctv:text-xs ctv:text-base-foreground ctv:[font-family:inherit] ctv:transition-colors
             ctv:hover:border-border-default ctv:hover:bg-secondary-background-hover"
      @click="toggleMenu"
    >
      <span class="ctv:relative ctv:size-6 ctv:shrink-0 ctv:overflow-hidden ctv:rounded-sm ctv:bg-secondary-background-hover">
        <ModelThumb v-if="selected" :src="selected" :alt="baseName(selected)">
          <IconBox class="ctv:size-3.5" />
        </ModelThumb>
        <span v-else class="ctv:flex ctv:size-full ctv:items-center ctv:justify-center ctv:text-muted-foreground">
          <IconBox class="ctv:size-3.5" />
        </span>
      </span>
      <span class="ctv:flex-1 ctv:min-w-0 ctv:truncate ctv:text-left"
            :class="selected ? '' : 'ctv:text-muted-foreground'">
        {{ selected ? baseName(selected) : $t('modelLoader.pickHint') }}
      </span>
      <i :class="['pi', menuOpen ? 'pi-chevron-up' : 'pi-chevron-down', 'ctv:shrink-0 ctv:text-3xs ctv:text-muted-foreground']" />
    </button>

    <div class="ctv:flex-1 ctv:min-h-0">
      <StageCard
        :state="state"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-context
      />
    </div>

    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="ctv:fixed ctv:inset-0 ctv:z-[9999]"
        @click="menuOpen = false"
        @wheel.stop
      >
        <div
          class="ctv:absolute ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-[380px] ctv:max-w-[92vw] ctv:p-2 ctv:rounded ctv:shadow-md
                 ctv:bg-interface-menu-surface ctv:text-xs ctv:text-base-foreground
                 ctv:border ctv:border-border-default"
          :style="menuStyle"
          @click.stop
        >
          <div class="ctv:flex ctv:items-center ctv:gap-1.5">
            <input
              ref="searchEl"
              v-model="query"
              type="text"
              :placeholder="$t('promptAssets.search')"
              class="ctv:flex-1 ctv:min-w-0 ctv:py-1 ctv:px-1.5 ctv:rounded-sm ctv:outline-none ctv:box-border
                     ctv:text-xs ctv:leading-snug ctv:[font-family:inherit]
                     ctv:bg-secondary-background ctv:text-base-foreground
                     ctv:border ctv:border-border-default ctv:focus:border-primary-background"
            />
            <button :class="uploadBtnClass" :disabled="uploading" @click="filePicker?.click()">
              <i class="pi pi-upload" />
              {{ uploading ? $t('modelLoader.uploading') : $t('modelLoader.upload') }}
            </button>
          </div>

          <div class="comfytv-asset-scroll ctv:h-[300px] ctv:shrink-0 ctv:overflow-y-scroll">
            <div v-if="filteredFiles.length === 0"
                 class="ctv:py-4 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
              {{ $t('modelLoader.empty') }}
            </div>
            <div v-else class="ctv:grid ctv:grid-cols-4 ctv:gap-1.5">
              <button
                v-for="file in filteredFiles"
                :key="file"
                type="button"
                :class="[
                  'ctv:relative ctv:flex ctv:flex-col ctv:p-0 ctv:cursor-pointer ctv:overflow-hidden ctv:rounded',
                  'ctv:bg-secondary-background ctv:border ctv:[font-family:inherit] ctv:transition-colors',
                  file === selected
                    ? 'ctv:border-primary-background'
                    : 'ctv:border-border-subtle ctv:hover:border-primary-background/60',
                ]"
                :title="file"
                @click="onPick(file)"
              >
                <div class="ctv:relative ctv:w-full ctv:aspect-square ctv:bg-secondary-background-hover">
                  <ModelThumb :src="file" :alt="baseName(file)">
                    <IconBox class="ctv:size-7" />
                  </ModelThumb>
                </div>
                <span
                  v-if="file === selected"
                  class="ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:flex ctv:items-center ctv:justify-center
                         ctv:size-4 ctv:rounded-full ctv:text-3xs ctv:leading-none
                         ctv:bg-primary-background ctv:text-white"
                ><i class="pi pi-check" /></span>
                <span class="ctv:w-full ctv:truncate ctv:py-0.5 ctv:px-1 ctv:text-left ctv:text-3xs ctv:text-muted-foreground">
                  {{ baseName(file) }}
                </span>
              </button>
            </div>
          </div>

          <div v-if="uploadError" class="ctv:truncate ctv:text-2xs ctv:text-destructive-background">{{ uploadError }}</div>
        </div>
      </div>
    </Teleport>

    <input
      ref="filePicker"
      type="file"
      :accept="fileAccept"
      multiple
      class="ctv:hidden"
      @change="onPickFiles"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import IconBox from '~icons/lucide/box'

import type { LGraphNode } from '@/lib/comfyApp'
import ModelThumb from '@/components/widgets/ModelThumb.vue'
import StageCard from '@/components/stages/StageCard.vue'
import type { StageState } from '@/stores/stageStore'
import { uploadBlobNamed } from '@/utils/uploadCanvas'
import { getWidget, readWidgetStr, writeWidget } from '@/utils/widget'
import { MODEL_FILE_EXTENSIONS } from '@/widgets/three/modelFormats'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const fileAccept = MODEL_FILE_EXTENSIONS.join(',')

const triggerEl = ref<HTMLButtonElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const filePicker = ref<HTMLInputElement | null>(null)
const files = ref<string[]>([])
const selected = ref('')
const query = ref('')
const uploading = ref(false)
const uploadError = ref('')
const menuOpen = ref(false)
const menuStyle = ref<Record<string, string>>({})

const filteredFiles = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return files.value
  return files.value.filter((f) => f.toLowerCase().includes(q))
})

function baseName(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash >= 0 ? path.slice(slash + 1) : path
}

function toggleMenu(): void {
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  const rect = triggerEl.value?.getBoundingClientRect()
  if (!rect) return
  const panelWidth = 380
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
  const top = Math.min(rect.bottom + 4, window.innerHeight - 380)
  menuStyle.value = { left: `${left}px`, top: `${Math.max(8, top)}px` }
  query.value = ''
  menuOpen.value = true
  void nextTick(() => searchEl.value?.focus())
}

function widgetOptionValues(): string[] {
  const w = getWidget(props.node, 'model') as any
  const values = w?.options?.values
  return Array.isArray(values) ? values.filter((v: unknown) => typeof v === 'string' && v) : []
}

function onPick(file: string): void {
  selected.value = file
  menuOpen.value = false
  writeWidget(props.node, 'model', file)
}

function registerFile(path: string): void {
  if (!files.value.includes(path)) files.value = [...files.value, path].sort()
  const w = getWidget(props.node, 'model') as any
  const values = w?.options?.values
  if (Array.isArray(values) && !values.includes(path)) values.push(path)
}

async function onPickFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''
  if (!picked.length || uploading.value) return
  uploading.value = true
  uploadError.value = ''
  try {
    let lastPath = ''
    for (const file of picked) {
      const uploaded = await uploadBlobNamed(file, { subfolder: '3d', filename: file.name })
      lastPath = `3d/${uploaded.name}`
      registerFile(lastPath)
    }
    if (lastPath) onPick(lastPath)
  } catch (e) {
    console.error('[ComfyTV/model-loader] upload failed', e)
    uploadError.value = String((e as Error)?.message ?? e)
  } finally {
    uploading.value = false
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && menuOpen.value) menuOpen.value = false
}

onMounted(() => {
  for (const w of (props.node as any).widgets ?? []) {
    if (w.name === 'model' || w.type === 'button') w.hidden = true
  }

  files.value = [...widgetOptionValues()].sort()
  const saved = readWidgetStr(props.node, 'model', '')
  if (saved) {
    selected.value = saved
    if (!files.value.includes(saved)) files.value = [...files.value, saved].sort()
  }

  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

const uploadBtnClass =
  'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:cursor-pointer'
  + ' ctv:whitespace-nowrap ctv:appearance-none ctv:border-none ctv:transition-colors'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'
  + ' ctv:h-6 ctv:rounded-sm ctv:px-2 ctv:py-1 ctv:text-xs ctv:font-medium ctv:shrink-0'
  + ' ctv:bg-secondary-background ctv:text-secondary-foreground ctv:hover:bg-secondary-background-hover'
</script>
