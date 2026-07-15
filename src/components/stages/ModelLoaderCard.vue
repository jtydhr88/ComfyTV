<template>
  <div
    :class="[
      'ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full ctv:p-2 ctv:box-border ctv:text-xs ctv:text-base-foreground',
      fileDrop.dragActive.value
        && 'ctv:rounded ctv:outline ctv:outline-2 ctv:-outline-offset-2 ctv:outline-primary-background/70 ctv:bg-primary-background/5',
    ]"
    @dragenter="fileDrop.onDragEnter"
    @dragover="fileDrop.onDragOver"
    @dragleave="fileDrop.onDragLeave"
    @drop="fileDrop.onDrop"
    @contextmenu.stop.prevent
  >
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

    <div class="ctv:group ctv:relative ctv:w-full ctv:flex-1 ctv:min-h-[280px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black">
      <ModelPreview
        v-if="modelSrc"
        ref="previewEl"
        :src="modelSrc"
        pickable
        :part-materials="partMaterials"
        :selected-part="selectedPart"
        @parts-changed="onPartsChanged"
        @part-pick="onPartPick"
        @view-changed="scheduleCapture"
      />
      <div v-else
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <IconBox class="ctv:size-8 ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('modelBinder.noModel') }}</div>
      </div>
      <div v-if="modelSrc" :class="previewActionsClass">
        <button type="button" :class="previewActionBtn"
                :title="$t('stage.action.download')"
                @click.stop="onDownloadModel"><i class="pi pi-download" /></button>
        <button type="button" :class="previewTagBtn"
                :title="$t('stage.action.addTag')"
                @click.stop="openTagMenu(modelSrc, nameFromUrl(modelSrc), $event, 'model')"><i class="pi pi-tag" /></button>
      </div>
    </div>

    <div
      v-if="modelSrc && materialSlots.length"
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @mousedown.stop
    >
      <div class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1 ctv:text-2xs">
        <span class="ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
          {{ selectedPart ? $t('modelBinder.selected', { part: selectedPart }) : $t('modelBinder.pickHint') }}
        </span>
        <template v-if="selectedPart">
          <button
            v-for="s in materialSlots"
            :key="s.slot"
            type="button"
            :class="chipClass(bindings[selectedPart] === s.slot)"
            :title="s.slot"
            @click="bindSelected(s.slot)"
          >
            <span class="ctv:size-3 ctv:rounded-full" :style="{ background: s.color }" />
            {{ s.label }}
          </button>
          <button
            v-if="bindings[selectedPart]"
            type="button"
            :class="chipClass(false)"
            @click="unbind(selectedPart)"
          ><i class="pi pi-times" /> {{ $t('modelBinder.unbind') }}</button>
        </template>
      </div>
      <div v-if="boundEntries.length" class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1">
        <button
          v-for="[part, slot] in boundEntries"
          :key="part"
          type="button"
          :class="chipClass(part === selectedPart)"
          :title="`${part} ← ${slot}`"
          @click="selectedPart = part"
        >
          <span class="ctv:size-2 ctv:rounded-full" :style="{ background: slotColor(slot) }" />
          <span class="ctv:max-w-24 ctv:truncate">{{ part }}</span>
          <span class="ctv:text-muted-foreground ctv:hover:text-destructive-background"
                @click.stop="unbind(part)"><i class="pi pi-times" /></span>
        </button>
      </div>
    </div>

    <div class="ctv:shrink-0">
      <StageCard
        :state="state"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-context
        hide-output
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import IconBox from '~icons/lucide/box'

import type { LGraphNode } from '@/lib/comfyApp'
import ModelPreview from '@/components/stages/ModelPreview.vue'
import ModelThumb from '@/components/widgets/ModelThumb.vue'
import StageCard from '@/components/stages/StageCard.vue'
import type { StageState } from '@/stores/stageStore'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { toastLoaderUploadFailed, useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'
import { useOutputAssetTagging } from '@/composables/stages/useOutputAssetTagging'
import { downloadFile } from '@/utils/download'
import { uploadBlobNamed, uploadCanvas } from '@/utils/uploadCanvas'
import { getWidget, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import { parseMaterialState, type MaterialParams } from '@/widgets/material/types'
import { MODEL_FILE_EXTENSIONS } from '@/widgets/three/modelFormats'

const { t } = useI18n()

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string, context?: { imageUrl?: string }) => void
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

function inputFileUrl(path: string): string {
  if (!path) return ''
  const slash = path.lastIndexOf('/')
  const subfolder = slash >= 0 ? path.slice(0, slash) : ''
  const name = slash >= 0 ? path.slice(slash + 1) : path
  const params = new URLSearchParams({ filename: name, type: 'input' })
  if (subfolder) params.set('subfolder', subfolder)
  return `/view?${params.toString()}`
}

const modelSrc = computed(() => props.state.output || inputFileUrl(selected.value))

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

const PREVIEW_BTN_BASE =
  'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:appearance-none'
  + ' ctv:border-none ctv:transition-colors ctv:size-5 ctv:p-0 ctv:rounded-sm ctv:text-sm'
const previewActionsClass =
  'ctv:absolute ctv:top-1 ctv:right-1 ctv:z-10 ctv:flex ctv:gap-1 ctv:opacity-0'
  + ' ctv:group-hover:opacity-100 ctv:transition-opacity'
const previewActionBtn = PREVIEW_BTN_BASE + ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'
const previewTagBtn = computed(() => PREVIEW_BTN_BASE
  + (isSaved(modelSrc.value)
    ? ' ctv:bg-primary-background ctv:text-white ctv:hover:bg-primary-background/90'
    : ' ctv:bg-white ctv:text-gray-600 ctv:hover:bg-white/90'))

async function onDownloadModel(): Promise<void> {
  if (!modelSrc.value) return
  try {
    await downloadFile(modelSrc.value)
  } catch (e) {
    console.error('[ComfyTV/model-loader] download failed', e)
  }
}

async function onCreateCategory(): Promise<void> {
  const name = (await askText({
    title: t('assets.category.new'),
    label: t('assets.category.newPrompt'),
  }))?.trim()
  if (!name) return
  await createCategoryAndTag(name)
}

const previewEl = ref<InstanceType<typeof ModelPreview> | null>(null)
const partKeys = ref<string[]>([])
const selectedPart = ref<string | null>(null)
const bindings = ref<Record<string, string>>(
  parseBindings(readWidgetStr(props.node, 'material_bindings', '')),
)

function parseBindings(json: string): Record<string, string> {
  if (!json) return {}
  try {
    const data = JSON.parse(json)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string' && v) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

const materialSlots = computed(() => {
  const out: { slot: string; label: string; color: string }[] = []
  for (const inp of props.state.inputs) {
    if (inp.type !== 'COMFYTV_MATERIAL' || inp.source !== 'upstream' || !inp.content) continue
    out.push({
      slot: inp.slot,
      label: `M${out.length + 1}`,
      color: parseMaterialState(inp.content).color,
    })
  }
  return out
})

const partMaterials = computed<Record<string, MaterialParams | null>>(() => {
  const bySlot = new Map<string, MaterialParams>()
  for (const inp of props.state.inputs) {
    if (inp.type === 'COMFYTV_MATERIAL' && inp.source === 'upstream' && inp.content) {
      bySlot.set(inp.slot, parseMaterialState(inp.content))
    }
  }
  const out: Record<string, MaterialParams | null> = {}
  for (const [part, slot] of Object.entries(bindings.value)) {
    out[part] = bySlot.get(slot) ?? null
  }
  return out
})

const boundEntries = computed(() => Object.entries(bindings.value))

function slotColor(slot: string): string {
  return materialSlots.value.find((s) => s.slot === slot)?.color ?? '#666'
}

function onPartsChanged(keys: string[]): void {
  partKeys.value = keys
  if (selectedPart.value && !keys.includes(selectedPart.value)) selectedPart.value = null
}

function onPartPick(key: string | null): void {
  selectedPart.value = key
}

function bindSelected(slot: string): void {
  if (!selectedPart.value) return
  bindings.value = { ...bindings.value, [selectedPart.value]: slot }
}

function unbind(part: string): void {
  const next = { ...bindings.value }
  delete next[part]
  bindings.value = next
}

watch(bindings, (v) => {
  writeWidget(props.node, 'material_bindings',
              Object.keys(v).length ? JSON.stringify(v) : '')
}, { deep: true })

onNodeConfigure(props.node, () => {
  bindings.value = parseBindings(readWidgetStr(props.node, 'material_bindings', ''))
  selectedPart.value = null
})

const CAPTURE_SIZE = 1024
const CAPTURE_DELAY_MS = 700

let captureTimer: number | null = null
let captureSeq = 0

function scheduleCapture(): void {
  if (captureTimer != null) window.clearTimeout(captureTimer)
  captureTimer = window.setTimeout(() => {
    captureTimer = null
    void runCapture()
  }, CAPTURE_DELAY_MS)
}

async function runCapture(): Promise<void> {
  const canvas = previewEl.value?.captureCanvas(CAPTURE_SIZE, CAPTURE_SIZE)
  if (!canvas) return
  const mySeq = ++captureSeq
  try {
    const url = await uploadCanvas(canvas, {
      subfolder: 'model3d-view',
      filename: `comfytv-model-view-${Date.now()}.png`,
    })
    if (mySeq !== captureSeq) return
    props.onAction('model-capture-view', { imageUrl: url })
  } catch (e) {
    console.error('[ComfyTV/model-loader] capture upload failed', e)
  }
}

function chipClass(selected: boolean): string {
  return 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]'
    + ' ctv:rounded-lg ctv:border ctv:px-1.5 ctv:py-0.5 ctv:text-2xs ctv:transition-colors'
    + (selected
      ? ' ctv:border-primary-background ctv:bg-primary-background/20 ctv:text-base-foreground'
      : ' ctv:border-border-subtle ctv:bg-secondary-background ctv:text-muted-foreground'
        + ' ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground')
}

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

async function uploadModelFiles(files: File[]): Promise<void> {
  if (!files.length || uploading.value) return
  uploading.value = true
  uploadError.value = ''
  try {
    let lastPath = ''
    for (const file of files) {
      const uploaded = await uploadBlobNamed(file, { subfolder: '3d', filename: file.name })
      lastPath = `3d/${uploaded.name}`
      registerFile(lastPath)
    }
    if (lastPath) onPick(lastPath)
  } catch (e) {
    console.error('[ComfyTV/model-loader] upload failed', e)
    uploadError.value = String((e as Error)?.message ?? e)
    toastLoaderUploadFailed(e)
  } finally {
    uploading.value = false
  }
}

async function onPickFiles(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''
  await uploadModelFiles(picked)
}

const fileDrop = useLoaderFileDrop({
  kind: () => 'model',
  onFiles: uploadModelFiles,
})

function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (tagMenu.value) closeTagMenu()
  else if (menuOpen.value) menuOpen.value = false
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
  captureSeq++
  if (captureTimer != null) window.clearTimeout(captureTimer)
  captureTimer = null
})

const uploadBtnClass =
  'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:cursor-pointer'
  + ' ctv:whitespace-nowrap ctv:appearance-none ctv:border-none ctv:transition-colors'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'
  + ' ctv:h-6 ctv:rounded-sm ctv:px-2 ctv:py-1 ctv:text-xs ctv:font-medium ctv:shrink-0'
  + ' ctv:bg-secondary-background ctv:text-secondary-foreground ctv:hover:bg-secondary-background-hover'
</script>
