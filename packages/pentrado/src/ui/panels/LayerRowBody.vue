<template>
  <button
    type="button"
    class="ctv:flex ctv:w-7 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:border-0 ctv:border-r
           ctv:border-[#1c1c1c] ctv:bg-transparent ctv:p-0 ctv:text-[#d6d6d6] ctv:cursor-pointer"
    :title="$t(row.node.visible ? 'pentrado.hideLayer' : 'pentrado.showLayer')"
    @click.stop="editor.toggleVisible(row.node.id)"
  >
    <IconEye v-if="row.node.visible" class="ctv:size-3.5" />
    <span v-else class="ctv:size-3.5" />
  </button>

  <div class="ctv:flex ctv:min-w-0 ctv:flex-1 ctv:items-center" :style="{ paddingLeft: row.depth * 12 + (row.node.clip ? 10 : 0) + 'px' }">
    <IconCornerDownRight
      v-if="row.node.clip"
      class="ctv:mr-0.5 ctv:size-3.5 ctv:shrink-0 ctv:text-[#7a7a7a]"
      :title="$t('pentrado.clipMask')"
    />
    <template v-if="row.node.kind === 'group'">
      <button
        type="button"
        class="ctv:ml-0.5 ctv:inline-flex ctv:size-5 ctv:shrink-0 ctv:items-center ctv:justify-center ctv:rounded
               ctv:border-0 ctv:bg-transparent ctv:p-0 ctv:text-[#9b9b9b] ctv:cursor-pointer ctv:hover:text-[#d6d6d6]"
        @click.stop="emit('toggle-collapsed', row.node.id)"
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
        class="ctv:my-1 ctv:ml-1.5 ctv:h-8 ctv:w-10 ctv:shrink-0 ctv:rounded-xs ctv:border"
        :class="contentTargeted(row.node) ? 'ctv:border-[#1473e6]' : 'ctv:border-[#161616]'"
        :style="checkerStyle"
        :title="$t('pentrado.targetContent')"
        :ref="(el) => drawThumb(el as HTMLCanvasElement | null, row.node)"
        @click.stop="onContentThumbClick(row.node, $event)"
      />
      <canvas
        v-if="row.node.mask"
        width="32"
        height="32"
        class="ctv:my-1 ctv:ml-1 ctv:size-8 ctv:shrink-0 ctv:rounded-xs ctv:border"
        :class="maskThumbBorder(row.node)"
        :title="$t('pentrado.targetMask')"
        :ref="(el) => drawMaskThumb(el as HTMLCanvasElement | null, row.node)"
        @click.stop="onMaskThumbClick(row.node, $event)"
        @contextmenu.stop.prevent="emit('mask-menu', row.node, $event)"
      />
    </template>

    <input
      v-if="renamingId === row.node.id"
      :value="row.node.name"
      class="ctv:mx-1.5 ctv:my-auto ctv:min-w-0 ctv:flex-1 ctv:rounded-xs ctv:border ctv:border-[#1473e6]
             ctv:bg-[#1e1e1e] ctv:px-1 ctv:py-0.5 ctv:text-[11px] ctv:text-[#d6d6d6] ctv:outline-none"
      @click.stop
      @keydown.enter="emit('rename-commit', row.node.id, $event)"
      @keydown.escape="emit('rename-cancel')"
      @blur="emit('rename-commit', row.node.id, $event)"
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
      v-if="anyLocked(row.node)"
      class="ctv:mr-1.5 ctv:size-3 ctv:shrink-0 ctv:self-center"
      :class="fullyLocked(row.node) ? 'ctv:text-[#d6d6d6]' : 'ctv:text-[#9b9b9b] ctv:opacity-60'"
    />
  </div>
</template>

<script setup lang="ts">
import IconChevronDown from '~icons/lucide/chevron-down'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconCornerDownRight from '~icons/lucide/corner-down-right'
import IconEye from '~icons/lucide/eye'
import IconFolder from '~icons/lucide/folder'
import IconLock from '~icons/lucide/lock'
import IconShapes from '~icons/lucide/shapes'
import IconType from '~icons/lucide/type'

import type { LayerEditorController } from '../useLayerEditorStage'
import type { SceneNode } from '../../engine'
import type { LayerRow } from '../../types'

const props = defineProps<{
  editor: LayerEditorController
  row: LayerRow
  collapsedGroups: Set<string>
  renamingId: string | null
  drawThumb: (el: HTMLCanvasElement | null, node: SceneNode) => void
  drawMaskThumb: (el: HTMLCanvasElement | null, node: SceneNode) => void
}>()

const emit = defineEmits<{
  (e: 'toggle-collapsed', id: string): void
  (e: 'rename-commit', id: string, ev: Event): void
  (e: 'rename-cancel'): void
  (e: 'row-click', node: SceneNode, ev: MouseEvent): void
  (e: 'mask-menu', node: SceneNode, ev: MouseEvent): void
}>()

const editor = props.editor

const checkerStyle = {
  backgroundImage: 'conic-gradient(#6a6a6a 25%, #4c4c4c 0 50%, #6a6a6a 0 75%, #4c4c4c 0)',
  backgroundSize: '8px 8px',
}

function selectLayer(node: SceneNode, target?: 'content' | 'mask'): void {
  editor.setActiveLayer(node.id)
  if (target) editor.paintTarget.value = target
}

function onContentThumbClick(node: SceneNode, e: MouseEvent): void {
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    emit('row-click', node, e)
    return
  }
  selectLayer(node, 'content')
}

function maskTargeted(node: SceneNode): boolean {
  return node.id === editor.activeId.value && editor.paintTarget.value === 'mask'
}

function contentTargeted(node: SceneNode): boolean {
  return node.id === editor.activeId.value && editor.paintTarget.value === 'content'
}

function anyLocked(node: SceneNode): boolean {
  return node.locks.content || node.locks.position || (node as { lockAlpha?: boolean }).lockAlpha === true
}

function fullyLocked(node: SceneNode): boolean {
  return node.locks.content && node.locks.position
}

function maskThumbBorder(node: SceneNode): string {
  if (!node.mask?.enabled) return 'ctv:border-[#dc2626] ctv:opacity-60'
  if (node.id === editor.activeId.value && editor.maskView.value) return 'ctv:border-[#22c55e]'
  if (maskTargeted(node)) return 'ctv:border-[#1473e6]'
  return 'ctv:border-[#161616]'
}

function onMaskThumbClick(node: SceneNode, e: MouseEvent): void {
  if (e.shiftKey) {
    editor.toggleMaskEnabled(node.id)
    return
  }
  if (e.altKey) {
    selectLayer(node, 'mask')
    editor.maskView.value = !editor.maskView.value
    return
  }
  selectLayer(node, 'mask')
}
</script>
