<template>
  <div class="ctv:flex ctv:w-52 ctv:shrink-0 ctv:flex-col ctv:gap-1 ctv:overflow-y-auto ctv:rounded-lg ctv:bg-node-background ctv:p-1.5">
    <div :class="groupHeaderClass">
      <span class="ctv:flex-1">{{ $t('layerEditor.layers') }}</span>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.addFromLibrary')"
        @click="pickerOpen = !pickerOpen"
      >
        <IconImagePlus class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.addFromFile')"
        @click="fileInput?.click()"
      >
        <IconUpload class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.addTextLayer')"
        @click="addText"
      >
        <IconType class="ctv:size-3.5" />
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="ctv:hidden"
        @change="onFilesPicked"
      />
    </div>

    <AssetPickerPopup
      v-if="pickerOpen"
      @select="onAssetPicked"
      @close="pickerOpen = false"
    />

    <div
      v-if="reversedLayers.length === 0"
      class="ctv:py-3 ctv:text-center ctv:text-2xs ctv:italic ctv:text-muted-foreground/60"
    >
      {{ $t('layerEditor.noLayers') }}
    </div>

    <div
      v-for="layer in reversedLayers"
      :key="layer.id"
      :class="rowClass(layer.id === editor.activeId.value)"
      @click="editor.setActiveLayer(layer.id)"
      @dblclick="renamingId = layer.id"
    >
      <canvas
        width="28"
        height="28"
        class="ctv:size-7 ctv:shrink-0 ctv:rounded-sm ctv:bg-black/40"
        :ref="(el) => drawThumb(el as HTMLCanvasElement | null, layer)"
      />
      <input
        v-if="renamingId === layer.id"
        :value="layer.name"
        class="ctv:min-w-0 ctv:flex-1 ctv:rounded-sm ctv:border ctv:border-primary-background ctv:bg-secondary-background
               ctv:px-1 ctv:py-0.5 ctv:text-2xs ctv:text-base-foreground ctv:outline-none"
        @click.stop
        @keydown.enter="commitRename(layer.id, $event)"
        @keydown.escape="renamingId = null"
        @blur="commitRename(layer.id, $event)"
        @vue:mounted="({ el }: any) => (el as HTMLInputElement).select()"
      />
      <span v-else class="ctv:min-w-0 ctv:flex-1 ctv:truncate ctv:text-2xs" :title="layer.name">
        <IconType v-if="layer.type === 'text'" class="ctv:mr-0.5 ctv:inline ctv:size-3 ctv:align-[-2px] ctv:text-muted-foreground" />
        {{ layer.name }}
      </span>

      <button
        v-if="layer.mask"
        type="button"
        :class="[miniBtnClass, layer.mask.enabled ? 'ctv:text-primary-background' : '']"
        :title="$t(layer.mask.enabled ? 'layerEditor.disableMask' : 'layerEditor.enableMask')"
        @click.stop="editor.toggleMaskEnabled(layer.id)"
      >
        <IconCircleDashed class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t(layer.visible ? 'layerEditor.hideLayer' : 'layerEditor.showLayer')"
        @click.stop="editor.toggleVisible(layer.id)"
      >
        <IconEye v-if="layer.visible" class="ctv:size-3.5" />
        <IconEyeOff v-else class="ctv:size-3.5 ctv:opacity-50" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t(layer.locked ? 'layerEditor.unlockLayer' : 'layerEditor.lockLayer')"
        @click.stop="editor.toggleLock(layer.id)"
      >
        <IconLock v-if="layer.locked" class="ctv:size-3.5" />
        <IconUnlock v-else class="ctv:size-3.5 ctv:opacity-50" />
      </button>
    </div>

    <div v-if="active" class="ctv:mt-0.5 ctv:flex ctv:items-center ctv:gap-0.5">
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.moveUp')" @click="editor.moveLayer(active.id, 1)">
        <IconChevronUp class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.moveDown')" @click="editor.moveLayer(active.id, -1)">
        <IconChevronDown class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.duplicateLayer')" @click="editor.duplicateLayer(active.id)">
        <IconCopy class="ctv:size-3.5" />
      </button>
      <div class="ctv:flex-1" />
      <button
        v-if="!active.mask"
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.addMask')"
        @click="editor.addMask(active.id)"
      >
        <IconCircleDashed class="ctv:size-3.5" />
      </button>
      <button
        v-else
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.deleteMask')"
        @click="editor.removeMask(active.id)"
      >
        <IconCircleOff class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.deleteLayer')" @click="editor.removeLayer(active.id)">
        <IconTrash class="ctv:size-3.5" />
      </button>
    </div>

    <template v-if="active">
      <div class="ctv:my-0.5 ctv:border-b ctv:border-border-subtle" />

      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span :class="paramLabelClass">{{ $t('layerEditor.opacity') }}</span>
        <input
          type="range" min="0" max="100" step="1"
          class="ctv:flex-1 ctv:accent-primary-background ctv:cursor-pointer"
          :value="Math.round(active.opacity * 100)"
          @input="(e) => editor.setOpacity(active!.id, Number((e.target as HTMLInputElement).value) / 100)"
        />
        <span class="ctv:w-8 ctv:text-right ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">
          {{ Math.round(active.opacity * 100) }}%
        </span>
      </div>

      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span :class="paramLabelClass">{{ $t('layerEditor.blendMode') }}</span>
        <div class="ctv:min-w-0 ctv:flex-1">
          <ComfyTVSelect
            :model-value="active.blendMode"
            :options="blendOptions"
            @update:model-value="(v) => editor.setBlendMode(active!.id, v as BlendMode)"
          />
        </div>
      </div>
    </template>

    <div class="ctv:my-0.5 ctv:border-b ctv:border-border-subtle" />

    <span :class="groupHeaderClass">{{ $t('layerEditor.sectionCanvas') }}</span>
    <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-[11px]">
      <input
        type="number" min="64" max="4096" step="8"
        :class="numInputClass"
        :value="editor.state.value.width"
        @change="onArtboardSize($event, 'w')"
      />
      <span class="ctv:text-2xs ctv:text-muted-foreground">×</span>
      <input
        type="number" min="64" max="4096" step="8"
        :class="numInputClass"
        :value="editor.state.value.height"
        @change="onArtboardSize($event, 'h')"
      />
      <span class="ctv:text-2xs ctv:text-muted-foreground">px</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconChevronUp from '~icons/lucide/chevron-up'
import IconCircleDashed from '~icons/lucide/circle-dashed'
import IconCircleOff from '~icons/lucide/circle-off'
import IconCopy from '~icons/lucide/copy'
import IconEye from '~icons/lucide/eye'
import IconEyeOff from '~icons/lucide/eye-off'
import IconImagePlus from '~icons/lucide/image-plus'
import IconLock from '~icons/lucide/lock'
import IconTrash from '~icons/lucide/trash-2'
import IconType from '~icons/lucide/type'
import IconUnlock from '~icons/lucide/unlock'
import IconUpload from '~icons/lucide/upload'

import type { Asset } from '@/api/schemas'
import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import { t } from '@/i18n'
import { BLEND_MODES, type BlendMode, type Layer } from '@/widgets/layerEditor/types'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor
const pickerOpen = ref(false)
const renamingId = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const reversedLayers = computed(() => [...editor.state.value.layers].reverse())
const active = computed(() => editor.activeLayer.value)

const BLEND_KEYS: Record<BlendMode, string> = {
  'source-over': 'normal', multiply: 'multiply', screen: 'screen', overlay: 'overlay',
  darken: 'darken', lighten: 'lighten', 'color-dodge': 'colorDodge', 'color-burn': 'colorBurn',
  'hard-light': 'hardLight', 'soft-light': 'softLight', difference: 'difference', exclusion: 'exclusion',
}

const blendOptions = computed(() =>
  BLEND_MODES.map((mode) => ({ label: t(`layerEditor.blend.${BLEND_KEYS[mode]}`), value: mode })),
)

function onAssetPicked(asset: Asset): void {
  pickerOpen.value = false
  void editor.addImageFromUrl(asset.payload_url, asset.name)
}

function onFilesPicked(e: Event): void {
  const input = e.target as HTMLInputElement
  for (const file of Array.from(input.files ?? [])) editor.addImageFromFile(file)
  input.value = ''
}

function addText(): void {
  const doc = editor.state.value
  const id = editor.addTextLayerAt({ x: doc.width * 0.25, y: doc.height * 0.4 })
  editor.editingTextId.value = id
}

function commitRename(id: string, e: Event): void {
  if (renamingId.value !== id) return
  renamingId.value = null
  editor.renameLayer(id, (e.target as HTMLInputElement).value)
}

function onArtboardSize(e: Event, axis: 'w' | 'h'): void {
  const v = Math.round(Number((e.target as HTMLInputElement).value))
  if (!Number.isFinite(v)) return
  const clamped = Math.min(4096, Math.max(64, v))
  const doc = editor.state.value
  editor.setArtboardSize(axis === 'w' ? clamped : doc.width, axis === 'h' ? clamped : doc.height)
}

function drawThumb(el: HTMLCanvasElement | null, layer: Layer): void {
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, el.width, el.height)
  if (layer.type === 'text') {
    ctx.fillStyle = layer.color
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('T', el.width / 2, el.height / 2 + 1)
    return
  }
  const entry = editor.content.get(layer.contentId)
  if (!entry) return
  const scale = Math.min(el.width / entry.width, el.height / entry.height)
  const w = entry.width * scale
  const h = entry.height * scale
  ctx.drawImage(entry.canvas, (el.width - w) / 2, (el.height - h) / 2, w, h)
}

const groupHeaderClass =
  'ctv:flex ctv:items-center ctv:gap-1 ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground'
const paramLabelClass = 'ctv:w-12 ctv:shrink-0 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground'
const miniBtnClass =
  'ctv:inline-flex ctv:size-5 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:rounded ctv:border-0 ' +
  'ctv:bg-transparent ctv:p-0 ctv:text-muted-foreground ctv:cursor-pointer ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background ctv:hover:text-base-foreground'
const numInputClass =
  'ctv-num-input ctv:w-16 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ' +
  'ctv:px-1 ctv:py-0.5 ctv:text-[11px] ctv:font-mono ctv:text-base-foreground'

function rowClass(selected: boolean): string {
  return [
    'ctv:flex ctv:cursor-pointer ctv:items-center ctv:gap-1 ctv:rounded-md ctv:px-1 ctv:py-0.5 ctv:transition-colors',
    selected
      ? 'ctv:bg-secondary-background-selected'
      : 'ctv:hover:bg-secondary-background',
  ].join(' ')
}
</script>
