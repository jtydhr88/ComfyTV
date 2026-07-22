<template>
  <div
    class="ctv:flex ctv:w-56 ctv:shrink-0 ctv:flex-col ctv:overflow-hidden ctv:rounded-md
           ctv:border ctv:border-[#161616] ctv:bg-[#2b2b2b] ctv:text-[11px] ctv:text-[#d6d6d6]"
  >
    <div class="ctv:flex ctv:items-center ctv:gap-0.5 ctv:border-b ctv:border-[#161616] ctv:bg-[#333333] ctv:px-2 ctv:py-1">
      <span class="ctv:flex-1 ctv:text-[11px] ctv:font-semibold">{{ $t('layerEditor.layers') }}</span>
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

    <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1.5">
      <div
        class="ctv:min-w-0 ctv:flex-1"
        :class="!blendEnabled ? 'ctv:pointer-events-none ctv:opacity-40' : ''"
      >
        <ComfyTVSelect
          :model-value="active?.mode.blend ?? 'normal'"
          :options="blendOptions"
          @update:model-value="(v) => active && editor.setBlendMode(active.id, v as BlendFn)"
        />
      </div>
      <label
        class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1 ctv:text-[10px] ctv:text-[#9b9b9b]"
        :class="!active ? 'ctv:pointer-events-none ctv:opacity-40' : ''"
      >
        {{ $t('layerEditor.opacity') }}
        <input
          type="number" min="0" max="100" step="1"
          :class="numInputClass"
          class="ctv:w-11!"
          :value="active ? Math.round(active.opacity * 100) : 100"
          @change="(e) => active && editor.setOpacity(active.id, Math.max(0, Math.min(100, Number((e.target as HTMLInputElement).value))) / 100)"
        />%
      </label>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-2 ctv:py-1 ctv:text-[10px] ctv:text-[#9b9b9b]">
      <span>{{ $t('layerEditor.lockLabel') }}</span>
      <button
        type="button"
        :class="[miniBtnClass, (active as any)?.lockAlpha ? 'ctv:text-[#1473e6]' : '']"
        :disabled="!active || active.kind !== 'raster'"
        :title="$t((active as any)?.lockAlpha ? 'layerEditor.unlockAlpha' : 'layerEditor.lockAlpha')"
        @click="active && editor.toggleLockAlpha(active.id)"
      >
        <IconDroplet class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="[miniBtnClass, active?.locks.content ? 'ctv:text-[#1473e6]' : '']"
        :disabled="!active"
        :title="$t(active?.locks.content ? 'layerEditor.unlockLayer' : 'layerEditor.lockLayer')"
        @click="active && editor.toggleLock(active.id)"
      >
        <IconLock v-if="active?.locks.content" class="ctv:size-3.5" />
        <IconUnlock v-else class="ctv:size-3.5" />
      </button>
    </div>

    <div
      class="ctv:min-h-16 ctv:flex-1 ctv:overflow-y-auto ctv:border-y ctv:border-[#161616] ctv:bg-[#262626]"
      @dragover="onListDragOver"
      @drop="onListDrop"
    >
      <div
        v-if="displayRows.length === 0"
        class="ctv:py-4 ctv:text-center ctv:text-[10px] ctv:italic ctv:text-[#9b9b9b]/70"
      >
        {{ $t('layerEditor.noLayers') }}
      </div>

      <div
        v-for="row in displayRows"
        :key="row.node.id"
        class="ctv:flex ctv:h-10 ctv:cursor-pointer ctv:items-stretch ctv:border-b ctv:border-[#1c1c1c] ctv:transition-colors"
        :class="[
          row.node.id === editor.activeId.value ? 'ctv:bg-[#44546a]' : 'ctv:hover:bg-[#333333]',
          rowDropClass(row),
          dragId === row.node.id ? 'ctv:opacity-50' : '',
        ]"
        :draggable="renamingId !== row.node.id"
        @click="selectLayer(row.node)"
        @dblclick="renamingId = row.node.id"
        @dragstart="onRowDragStart(row, $event)"
        @dragover="onRowDragOver(row, $event)"
        @drop="onRowDrop(row, $event)"
        @dragend="endDrag"
      >
        <button
          type="button"
          class="ctv:flex ctv:w-7 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:border-0 ctv:border-r
                 ctv:border-[#1c1c1c] ctv:bg-transparent ctv:p-0 ctv:text-[#d6d6d6] ctv:cursor-pointer"
          :title="$t(row.node.visible ? 'layerEditor.hideLayer' : 'layerEditor.showLayer')"
          @click.stop="editor.toggleVisible(row.node.id)"
        >
          <IconEye v-if="row.node.visible" class="ctv:size-3.5" />
          <span v-else class="ctv:size-3.5" />
        </button>

        <div class="ctv:flex ctv:min-w-0 ctv:flex-1 ctv:items-center" :style="{ paddingLeft: row.depth * 12 + 'px' }">
          <template v-if="row.node.kind === 'group'">
            <button
              type="button"
              class="ctv:ml-0.5 ctv:inline-flex ctv:size-5 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:rounded
                     ctv:border-0 ctv:bg-transparent ctv:p-0 ctv:text-[#9b9b9b] ctv:cursor-pointer ctv:hover:text-[#d6d6d6]"
              @click.stop="toggleCollapsed(row.node.id)"
            >
              <IconChevronRight v-if="collapsedGroups.has(row.node.id)" class="ctv:size-3.5" />
              <IconChevronDown v-else class="ctv:size-3.5" />
            </button>
            <IconFolder class="ctv:mx-1 ctv:size-4 ctv:shrink-0 ctv:text-[#9b9b9b]" />
          </template>
          <template v-else>
            <canvas
              width="40"
              height="32"
              class="ctv:my-1 ctv:ml-1.5 ctv:h-8 ctv:w-10 ctv:shrink-0 ctv:rounded-xs ctv:border ctv:border-[#161616]"
              :style="checkerStyle"
              :title="$t('layerEditor.targetContent')"
              :ref="(el) => drawThumb(el as HTMLCanvasElement | null, row.node)"
              @click.stop="selectLayer(row.node, 'content')"
            />
            <canvas
              v-if="row.node.mask"
              width="32"
              height="32"
              class="ctv:my-1 ctv:ml-1 ctv:size-8 ctv:shrink-0 ctv:rounded-xs ctv:border"
              :class="[
                maskTargeted(row.node) ? 'ctv:border-[#1473e6]' : 'ctv:border-[#161616]',
                row.node.mask.enabled ? '' : 'ctv:opacity-40',
              ]"
              :title="$t('layerEditor.targetMask')"
              :ref="(el) => drawMaskThumb(el as HTMLCanvasElement | null, row.node)"
              @click.stop="onMaskThumbClick(row.node, $event)"
            />
          </template>

          <input
            v-if="renamingId === row.node.id"
            :value="row.node.name"
            class="ctv:mx-1.5 ctv:my-auto ctv:min-w-0 ctv:flex-1 ctv:rounded-xs ctv:border ctv:border-[#1473e6]
                   ctv:bg-[#1e1e1e] ctv:px-1 ctv:py-0.5 ctv:text-[11px] ctv:text-[#d6d6d6] ctv:outline-none"
            @click.stop
            @keydown.enter="commitRename(row.node.id, $event)"
            @keydown.escape="renamingId = null"
            @blur="commitRename(row.node.id, $event)"
            @vue:mounted="({ el }: any) => (el as HTMLInputElement).select()"
          />
          <span
            v-else
            class="ctv:mx-1.5 ctv:min-w-0 ctv:flex-1 ctv:truncate ctv:text-[11px]"
            :title="row.node.name"
          >
            <IconType v-if="row.node.kind === 'text'" class="ctv:mr-0.5 ctv:inline ctv:size-3 ctv:align-[-2px] ctv:text-[#9b9b9b]" />
            <IconShapes v-else-if="row.node.kind === 'vector'" class="ctv:mr-0.5 ctv:inline ctv:size-3 ctv:align-[-2px] ctv:text-[#9b9b9b]" />
            {{ row.node.name }}
          </span>

          <IconLock
            v-if="row.node.locks.content"
            class="ctv:mr-1.5 ctv:size-3 ctv:shrink-0 ctv:self-center ctv:text-[#9b9b9b]"
          />
        </div>
      </div>
    </div>

    <div v-if="active" class="ctv:flex ctv:items-center ctv:gap-0.5 ctv:px-1.5 ctv:py-0.5">
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.moveUp')" @click="editor.moveLayer(active.id, 1)">
        <IconChevronUp class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.moveDown')" @click="editor.moveLayer(active.id, -1)">
        <IconChevronDownArrange class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.duplicateLayer')" @click="editor.duplicateLayer(active.id)">
        <IconCopy class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.groupLayers')" @click="editor.groupActiveLayer()">
        <IconFolderPlus class="ctv:size-3.5" />
      </button>
      <button
        v-if="active.kind === 'group'"
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.ungroupLayers')"
        @click="editor.ungroupActiveLayer()"
      >
        <IconFolderMinus class="ctv:size-3.5" />
      </button>
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.mergeDown')" @click="editor.mergeDown(active.id)">
        <IconArrowDownToLine class="ctv:size-3.5" />
      </button>
      <template v-if="active.kind === 'raster'">
        <button type="button" :class="miniBtnClass" :title="$t('layerEditor.cropToContent')" @click="editor.cropToContent(active.id)">
          <IconCrop class="ctv:size-3.5" />
        </button>
        <button type="button" :class="miniBtnClass" :title="$t('layerEditor.layerToCanvasSize')" @click="editor.layerToCanvasSize(active.id)">
          <IconMaximize class="ctv:size-3.5" />
        </button>
      </template>
      <div class="ctv:flex-1" />
      <button type="button" :class="miniBtnClass" :title="$t('layerEditor.flattenImage')" @click="editor.flattenImage()">
        <IconLayers class="ctv:size-3.5" />
      </button>
    </div>

    <template v-if="active">
      <template v-if="active.kind === 'adjustment'">
        <div class="ctv:mx-2 ctv:border-t ctv:border-[#3d3d3d]" />
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('layerEditor.adjustmentOp') }}</span>
          <div class="ctv:min-w-0 ctv:flex-1">
            <ComfyTVSelect
              :model-value="active.op"
              :options="adjustOptions"
              @update:model-value="(v) => editor.updateAdjustment(active!.id, { op: v as string })"
            />
          </div>
        </div>
        <div
          v-for="def in adjustParamDefs"
          :key="def.key"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1"
        >
          <span :class="paramLabelClass">{{ $t(`layerEditor.adj_${def.key}`) }}</span>
          <input
            type="range"
            :min="def.min"
            :max="def.max"
            :step="(def.max - def.min) / 200"
            class="ctv:flex-1 ctv:accent-[#1473e6] ctv:cursor-pointer"
            :value="(active as any).params[def.key] ?? def.default"
            @input="(e) => editor.updateAdjustment(active!.id, { params: { [def.key]: Number((e.target as HTMLInputElement).value) } })"
          />
          <span :class="paramValueClass">
            {{ Math.round(((active as any).params[def.key] ?? def.default) * (def.max === 180 ? 1 : 100)) }}
          </span>
        </div>
      </template>

      <template v-if="active.kind === 'vector'">
        <div class="ctv:mx-2 ctv:border-t ctv:border-[#3d3d3d]" />
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('layerEditor.shapeFill') }}</span>
          <input
            type="checkbox"
            class="ctv:accent-[#1473e6]"
            :checked="!!active.fill"
            @change="onVectorFillToggle"
          />
          <input
            type="color"
            :disabled="!active.fill"
            :class="colorInputClass"
            :value="active.fill?.color ?? '#3b82f6'"
            @input="(e) => onVectorFillColor((e.target as HTMLInputElement).value)"
          />
        </div>
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('layerEditor.shapeStroke') }}</span>
          <input
            type="checkbox"
            class="ctv:accent-[#1473e6]"
            :checked="!!active.stroke"
            @change="onVectorStrokeToggle"
          />
          <input
            type="color"
            :disabled="!active.stroke"
            :class="colorInputClass"
            :value="active.stroke?.color ?? '#ffffff'"
            @input="(e) => onVectorStrokeColor((e.target as HTMLInputElement).value)"
          />
          <input
            type="range" min="1" max="100" step="1"
            :disabled="!active.stroke"
            class="ctv:flex-1 ctv:accent-[#1473e6] ctv:cursor-pointer ctv:disabled:opacity-30"
            :value="active.stroke?.width ?? 4"
            @input="(e) => onVectorStrokeWidth(Number((e.target as HTMLInputElement).value))"
          />
          <span :class="paramValueClass">
            {{ active.stroke?.width ?? 4 }}
          </span>
        </div>
      </template>

      <template v-if="active.kind === 'fill'">
        <div class="ctv:mx-2 ctv:border-t ctv:border-[#3d3d3d]" />
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('layerEditor.fillType') }}</span>
          <div class="ctv:min-w-0 ctv:flex-1">
            <ComfyTVSelect
              :model-value="active.fill.type"
              :options="fillTypeOptions"
              @update:model-value="(v) => onFillType(v as 'solid' | 'linear' | 'radial')"
            />
          </div>
        </div>
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('layerEditor.fillColors') }}</span>
          <template v-if="active.fill.type === 'solid'">
            <input
              type="color"
              :class="colorInputClass"
              :value="active.fill.color"
              @input="(e) => onFillSolidColor((e.target as HTMLInputElement).value)"
            />
          </template>
          <template v-else>
            <input
              type="color"
              :class="colorInputClass"
              :value="active.fill.stops[0].color"
              @input="(e) => onFillStopColor(0, (e.target as HTMLInputElement).value)"
            />
            <input
              type="color"
              :class="colorInputClass"
              :value="active.fill.stops[active.fill.stops.length - 1].color"
              @input="(e) => onFillStopColor(1, (e.target as HTMLInputElement).value)"
            />
          </template>
        </div>
        <div v-if="active.fill.type === 'linear'" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('layerEditor.fillAngle') }}</span>
          <input
            type="range" min="0" max="360" step="1"
            class="ctv:flex-1 ctv:accent-[#1473e6] ctv:cursor-pointer"
            :value="active.fill.angle"
            @input="(e) => onFillAngle(Number((e.target as HTMLInputElement).value))"
          />
          <span :class="paramValueClass">
            {{ Math.round(active.fill.angle) }}°
          </span>
        </div>
        <div v-if="active.fill.type === 'radial'" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:px-2 ctv:pt-1">
          <span :class="paramLabelClass">{{ $t('layerEditor.fillRadius') }}</span>
          <input
            type="range" min="10" max="200" step="1"
            class="ctv:flex-1 ctv:accent-[#1473e6] ctv:cursor-pointer"
            :value="Math.round(active.fill.radius * 100)"
            @input="(e) => onFillRadius(Number((e.target as HTMLInputElement).value) / 100)"
          />
          <span :class="paramValueClass">
            {{ Math.round(active.fill.radius * 100) }}%
          </span>
        </div>
      </template>
    </template>

    <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:px-2 ctv:py-1 ctv:text-[10px] ctv:text-[#9b9b9b]">
      <span>{{ $t('layerEditor.sectionCanvas') }}</span>
      <input
        type="number" min="64" max="4096" step="8"
        :class="numInputClass"
        :value="editor.canvasSize.value.width"
        @change="onArtboardSize($event, 'w')"
      />
      <span>×</span>
      <input
        type="number" min="64" max="4096" step="8"
        :class="numInputClass"
        :value="editor.canvasSize.value.height"
        @change="onArtboardSize($event, 'h')"
      />
      <span>px</span>
    </div>

    <div class="ctv:flex ctv:items-center ctv:justify-evenly ctv:border-t ctv:border-[#161616] ctv:bg-[#333333] ctv:px-1 ctv:py-0.5">
      <button
        v-if="!active?.mask"
        type="button"
        :class="miniBtnClass"
        :disabled="!active"
        :title="$t('layerEditor.addMask')"
        @click="active && editor.addMask(active.id)"
      >
        <IconCircleDashed class="ctv:size-3.5" />
      </button>
      <button
        v-else
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.deleteMask')"
        @click="editor.removeMask(active!.id)"
      >
        <IconCircleOff class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.addAdjustment')"
        @click="editor.addAdjustmentLayer()"
      >
        <IconSlidersHorizontal class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.addFill')"
        @click="editor.addFillLayer()"
      >
        <IconPaintBucket class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.addTextLayer')"
        @click="addText"
      >
        <IconType class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :title="$t('layerEditor.newLayer')"
        @click="editor.addEmptyLayer()"
      >
        <IconSquarePlus class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="miniBtnClass"
        :disabled="!active"
        :title="$t('layerEditor.deleteLayer')"
        @click="active && editor.removeLayer(active.id)"
      >
        <IconTrash class="ctv:size-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconChevronDownArrange from '~icons/lucide/chevron-down'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconChevronUp from '~icons/lucide/chevron-up'
import IconCircleDashed from '~icons/lucide/circle-dashed'
import IconCircleOff from '~icons/lucide/circle-off'
import IconCopy from '~icons/lucide/copy'
import IconCrop from '~icons/lucide/crop'
import IconDroplet from '~icons/lucide/droplet'
import IconEye from '~icons/lucide/eye'
import IconFolder from '~icons/lucide/folder'
import IconFolderMinus from '~icons/lucide/folder-minus'
import IconFolderPlus from '~icons/lucide/folder-plus'
import IconImagePlus from '~icons/lucide/image-plus'
import IconLayers from '~icons/lucide/layers'
import IconLock from '~icons/lucide/lock'
import IconMaximize from '~icons/lucide/maximize'
import IconPaintBucket from '~icons/lucide/paint-bucket'
import IconShapes from '~icons/lucide/shapes'
import IconSlidersHorizontal from '~icons/lucide/sliders-horizontal'
import IconSquarePlus from '~icons/lucide/square-plus'
import IconTrash from '~icons/lucide/trash-2'
import IconType from '~icons/lucide/type'
import IconUnlock from '~icons/lucide/unlock'
import IconUpload from '~icons/lucide/upload'

import AssetPickerPopup from '@/components/stages/AssetPickerPopup.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import { useLayerListPanel } from '@/composables/widgets/useLayerListPanel'
import type { BlendFn, SceneNode } from '@/widgets/layerEditor/engine'

const props = defineProps<{
  editor: LayerEditorController
}>()

const editor = props.editor
const fileInput = ref<HTMLInputElement | null>(null)

const {
  pickerOpen,
  renamingId,
  collapsedGroups,
  displayRows,
  active,
  blendOptions,
  adjustOptions,
  adjustParamDefs,
  toggleCollapsed,
  dragId,
  onRowDragStart,
  onRowDragOver,
  onRowDrop,
  onListDragOver,
  onListDrop,
  endDrag,
  rowDropClass,
  fillTypeOptions,
  onFillType,
  onFillSolidColor,
  onFillStopColor,
  onFillAngle,
  onFillRadius,
  onVectorFillToggle,
  onVectorFillColor,
  onVectorStrokeToggle,
  onVectorStrokeColor,
  onVectorStrokeWidth,
  onAssetPicked,
  onFilesPicked,
  addText,
  commitRename,
  onArtboardSize,
  drawThumb,
  drawMaskThumb,
} = useLayerListPanel(editor)

const blendEnabled = computed(() => !!active.value && active.value.kind !== 'adjustment')

const checkerStyle = {
  backgroundImage: 'conic-gradient(#6a6a6a 25%, #4c4c4c 0 50%, #6a6a6a 0 75%, #4c4c4c 0)',
  backgroundSize: '8px 8px',
}

function selectLayer(node: SceneNode, target?: 'content' | 'mask'): void {
  editor.setActiveLayer(node.id)
  if (target) editor.paintTarget.value = target
}

function maskTargeted(node: SceneNode): boolean {
  return node.id === editor.activeId.value && editor.paintTarget.value === 'mask'
}

function onMaskThumbClick(node: SceneNode, e: MouseEvent): void {
  if (e.shiftKey) {
    editor.toggleMaskEnabled(node.id)
    return
  }
  selectLayer(node, 'mask')
}

const paramLabelClass = 'ctv:w-12 ctv:shrink-0 ctv:text-[10px] ctv:uppercase ctv:tracking-wide ctv:text-[#9b9b9b]'
const paramValueClass = 'ctv:w-8 ctv:text-right ctv:text-[10px] ctv:font-mono ctv:text-[#9b9b9b]'
const miniBtnClass =
  'ctv:inline-flex ctv:size-6 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:rounded ctv:border-0 ' +
  'ctv:bg-transparent ctv:p-0 ctv:text-[#9b9b9b] ctv:cursor-pointer ctv:transition-colors ' +
  'ctv:hover:bg-[#3a3a3a] ctv:hover:text-[#d6d6d6] ' +
  'ctv:disabled:opacity-30 ctv:disabled:cursor-default ctv:disabled:hover:bg-transparent'
const numInputClass =
  'ctv-num-input ctv:w-14 ctv:rounded-xs ctv:border ctv:border-[#3d3d3d] ctv:bg-[#1e1e1e] ' +
  'ctv:px-1 ctv:py-0.5 ctv:text-[11px] ctv:font-mono ctv:text-[#d6d6d6]'
const colorInputClass =
  'ctv:size-6 ctv:cursor-pointer ctv:rounded ctv:border ctv:border-[#161616] ctv:bg-transparent ctv:p-0 ctv:disabled:opacity-30'
</script>
