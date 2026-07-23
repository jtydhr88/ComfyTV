<template>
  <Teleport to="body" :disabled="!fullscreen">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1 ctv:text-xs ctv:text-base-foreground ctv:outline-none"
      :class="fullscreen
        ? 'ctv:fixed ctv:inset-0 ctv:z-[1400] ctv:bg-base-background ctv:p-2'
        : 'ctv:size-full'"
      tabindex="0"
      @pointerdown.stop
      @mousedown.stop
      @contextmenu.stop.prevent
      @keydown="onKeyDown"
      @keyup="onKeyUp"
    >
      <LayerEditorToolBar :editor="editor">
        <template #trailing>
          <button
            type="button"
            :class="[toggleBtnClass, sb.guideCenter.value ? activeToggleClass : '']"
            :title="$t('storyboardEditor.guideCenter')"
            @click="sb.guideCenter.value = !sb.guideCenter.value"
          ><i class="pi pi-plus ctv:text-[11px]" /></button>
          <button
            type="button"
            :class="[toggleBtnClass, sb.guideThirds.value ? activeToggleClass : '']"
            :title="$t('storyboardEditor.guideThirds')"
            @click="sb.guideThirds.value = !sb.guideThirds.value"
          ><i class="pi pi-th-large ctv:text-[11px]" /></button>
          <button
            type="button"
            :class="[toggleBtnClass, sb.guideGrid.value ? activeToggleClass : '']"
            :title="$t('storyboardEditor.guideGrid')"
            @click="sb.guideGrid.value = !sb.guideGrid.value"
          ><i class="pi pi-table ctv:text-[11px]" /></button>
          <button
            type="button"
            :class="toggleBtnClass"
            :title="$t('storyboardEditor.flipH')"
            @click="sb.flipBoard('h')"
          ><i class="pi pi-arrows-h ctv:text-[11px]" /></button>
          <button
            type="button"
            :class="toggleBtnClass"
            :title="$t('storyboardEditor.flipV')"
            @click="sb.flipBoard('v')"
          ><i class="pi pi-arrows-v ctv:text-[11px]" /></button>
          <span class="ctv:w-px ctv:h-4 ctv:bg-border-subtle ctv:mx-0.5" />
          <button
            type="button"
            :class="[toggleBtnClass, sb.onionPrev.value ? activeToggleClass : '']"
            :title="$t('storyboardEditor.onionPrev')"
            @click="sb.onionPrev.value = !sb.onionPrev.value"
          ><i class="pi pi-step-backward ctv:text-[11px]" /></button>
          <button
            type="button"
            :class="[toggleBtnClass, sb.onionNext.value ? activeToggleClass : '']"
            :title="$t('storyboardEditor.onionNext')"
            @click="sb.onionNext.value = !sb.onionNext.value"
          ><i class="pi pi-step-forward ctv:text-[11px]" /></button>
          <button
            type="button"
            :class="[toggleBtnClass, sb.captions.value ? activeToggleClass : '']"
            :title="$t('storyboardEditor.captions')"
            @click="sb.captions.value = !sb.captions.value"
          ><i class="pi pi-comment ctv:text-[11px]" /></button>
          <button
            type="button"
            :class="[toggleBtnClass, sb.loop.value ? activeToggleClass : '']"
            :title="$t('storyboardEditor.loop')"
            @click="sb.loop.value = !sb.loop.value"
          ><i class="pi pi-replay ctv:text-[11px]" /></button>
          <button
            type="button"
            :class="toggleBtnClass"
            :title="$t(sb.playing.value ? 'storyboardEditor.stop' : 'storyboardEditor.play')"
            @click="sb.playing.value ? sb.stopPlayback() : sb.play()"
          ><i :class="sb.playing.value ? 'pi pi-stop' : 'pi pi-play'" class="ctv:text-[11px]" /></button>
          <button
            type="button"
            :class="toggleBtnClass"
            :title="$t(fullscreen ? 'layerEditor.exitFullscreen' : 'layerEditor.fullscreen')"
            @click="toggleFullscreen"
          >
            <IconMinimize v-if="fullscreen" class="ctv:size-4" />
            <IconMaximize v-else class="ctv:size-4" />
          </button>
        </template>
      </LayerEditorToolBar>

      <div class="ctv:flex ctv:min-h-0 ctv:flex-1 ctv:gap-1">
        <LayerEditorToolStrip :editor="editor" />
        <div class="ctv:relative ctv:min-w-0 ctv:flex-1">
          <LayerEditorCanvas ref="canvasEl" :editor="editor">
            <template #onion>
              <img
                v-if="sb.onionPrevUrl.value"
                :src="sb.onionPrevUrl.value"
                class="ctv:absolute ctv:top-0 ctv:left-0 ctv:size-full ctv:pointer-events-none ctv:mix-blend-multiply ctv:opacity-40"
                style="filter: grayscale(1) sepia(1) saturate(3) hue-rotate(-30deg)"
                draggable="false"
              />
              <img
                v-if="sb.onionNextUrl.value"
                :src="sb.onionNextUrl.value"
                class="ctv:absolute ctv:top-0 ctv:left-0 ctv:size-full ctv:pointer-events-none ctv:mix-blend-multiply ctv:opacity-30"
                style="filter: grayscale(1) sepia(1) saturate(3) hue-rotate(90deg)"
                draggable="false"
              />
              <svg
                v-if="sb.guideCenter.value || sb.guideThirds.value || sb.guideGrid.value"
                class="ctv:absolute ctv:top-0 ctv:left-0 ctv:size-full ctv:pointer-events-none"
                :viewBox="`0 0 ${guideSize.width} ${guideSize.height}`"
                preserveAspectRatio="none"
              >
                <g v-if="sb.guideGrid.value" stroke="#00bcd4" stroke-opacity="0.35" :stroke-width="guideStroke">
                  <line v-for="i in 7" :key="`gv${i}`" :x1="guideSize.width * i / 8" y1="0" :x2="guideSize.width * i / 8" :y2="guideSize.height" />
                  <line v-for="i in 7" :key="`gh${i}`" x1="0" :y1="guideSize.height * i / 8" :x2="guideSize.width" :y2="guideSize.height * i / 8" />
                </g>
                <g v-if="sb.guideThirds.value" stroke="#ffc107" stroke-opacity="0.65" :stroke-width="guideStroke">
                  <line v-for="i in 2" :key="`tv${i}`" :x1="guideSize.width * i / 3" y1="0" :x2="guideSize.width * i / 3" :y2="guideSize.height" />
                  <line v-for="i in 2" :key="`th${i}`" x1="0" :y1="guideSize.height * i / 3" :x2="guideSize.width" :y2="guideSize.height * i / 3" />
                </g>
                <g v-if="sb.guideCenter.value" stroke="#ff5252" stroke-opacity="0.65" :stroke-width="guideStroke">
                  <line :x1="guideSize.width / 2" y1="0" :x2="guideSize.width / 2" :y2="guideSize.height" />
                  <line x1="0" :y1="guideSize.height / 2" :x2="guideSize.width" :y2="guideSize.height / 2" />
                </g>
              </svg>
            </template>
          </LayerEditorCanvas>
          <TextEditPopup :editor="editor" />

          <div
            v-if="sb.playing.value"
            class="ctv:absolute ctv:inset-0 ctv:z-20 ctv:flex ctv:items-center ctv:justify-center ctv:bg-black ctv:cursor-pointer"
            @click="sb.stopPlayback()"
          >
            <img
              v-if="sb.playingBoard.value && playingImageUrl"
              :src="playingImageUrl"
              class="ctv:max-h-full ctv:max-w-full ctv:object-contain"
              draggable="false"
            />
            <div
              v-if="sb.captions.value && sb.playingBoard.value?.dialogue"
              class="ctv:absolute ctv:bottom-8 ctv:left-1/2 ctv:-translate-x-1/2 ctv:max-w-[85%] ctv:py-1 ctv:px-3 ctv:rounded
                     ctv:bg-black/70 ctv:text-white ctv:text-sm ctv:text-center ctv:leading-snug ctv:whitespace-pre-line"
            >{{ sb.playingBoard.value.dialogue }}</div>
            <span
              class="ctv:absolute ctv:bottom-2 ctv:left-2 ctv:py-0.5 ctv:px-1.5 ctv:rounded ctv:text-2xs ctv:font-mono ctv:bg-black/70 ctv:text-white"
            >{{ sb.labels.value[sb.playIndex.value] }} · {{ sb.playIndex.value + 1 }}/{{ sb.boards.value.length }}</span>
          </div>
        </div>

        <div class="ctv:flex ctv:flex-col ctv:w-56 ctv:shrink-0 ctv:gap-1 ctv:min-h-0">
          <div class="ctv:flex ctv:gap-px ctv:rounded-md ctv:bg-secondary-background ctv:p-px">
            <button
              type="button"
              :class="[tabBtnClass, sideTab === 'board' ? tabActiveClass : '']"
              @click="sideTab = 'board'"
            >{{ $t('storyboardEditor.tabBoard') }}</button>
            <button
              type="button"
              :class="[tabBtnClass, sideTab === 'layers' ? tabActiveClass : '']"
              @click="sideTab = 'layers'"
            >{{ $t('storyboardEditor.tabLayers') }}</button>
          </div>
          <LayerListPanel v-show="sideTab === 'layers'" :editor="editor" class="ctv:min-h-0 ctv:flex-1" />
          <StoryboardBoardPanel v-show="sideTab === 'board'" :sb="sb" class="ctv:min-h-0 ctv:flex-1" />
        </div>
      </div>

      <StoryboardTimelineStrip
        :sb="sb"
        :has-upstream="hasUpstream"
        :has-upstream-images="hasUpstreamImages"
        :exporting-pdf="exportingPdf"
        @import-upstream="onImportUpstream"
        @import-upstream-images="onImportUpstreamImages"
        @import-script="onImportScript"
        @import-images="onImportImages"
        @export-animatic="onExportAnimatic"
        @export-gif="onExportGif"
        @export-pdf="onExportPdf"
        @export-zip="onExportZip"
      />

      <StageCard
        class="ctv:h-auto! ctv:grow-0 ctv:shrink-0"
        :state="stageState"
        :node="node"
        :on-run-request="onRunRequest"
        :on-cancel-request="onCancelRequest"
        :on-disconnect="onDisconnect"
        :on-action="onAction"
        hide-context
        hide-output
        hide-actions
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import IconMaximize from '~icons/lucide/maximize-2'
import IconMinimize from '~icons/lucide/minimize-2'

import type { LGraphNode } from '@/lib/comfyApp'
import { app } from '@/lib/comfyApp'
import { t } from '@/i18n'
import StageCard from '@/components/stages/StageCard.vue'
import LayerEditorCanvas from '@/components/widgets/LayerEditorCanvas.vue'
import LayerEditorToolBar from '@/components/widgets/LayerEditorToolBar.vue'
import LayerEditorToolStrip from '@/components/widgets/LayerEditorToolStrip.vue'
import LayerListPanel from '@/components/widgets/LayerListPanel.vue'
import StoryboardBoardPanel from '@/components/widgets/StoryboardBoardPanel.vue'
import StoryboardTimelineStrip from '@/components/widgets/StoryboardTimelineStrip.vue'
import TextEditPopup from '@/components/widgets/TextEditPopup.vue'
import { useLayerEditorHotkeys } from '@/composables/widgets/useLayerEditorHotkeys'
import { useStoryboardEditor } from '@/composables/widgets/useStoryboardEditor'
import { useStoryboardHotkeys } from '@/composables/widgets/useStoryboardHotkeys'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { boardImageUrl } from '@/widgets/storyboard/boardDoc'
import { downloadBlob, exportStoryboardPdf } from '@/widgets/storyboard/pdfExport'
import { onNodeConfigure, readWidgetStr } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const stageState = props.state
const stageStore = useStageStore()
const canvasEl = ref<InstanceType<typeof LayerEditorCanvas> | null>(null)
const fullscreen = ref(false)
const sideTab = ref<'board' | 'layers'>('board')

const sb = useStoryboardEditor(props.node, stageState, {
  onCommitted: (cover, batch) => {
    stageStore.setOutputSlot(stageState, 0, cover || null)
    stageStore.setOutputSlot(stageState, 1, batch || null)
  },
  onAnimatic: (url) => stageStore.setOutputSlot(stageState, 2, url || null),
})
const editor = sb.editor
const exportingPdf = ref(false)

const hasUpstream = computed(() =>
  stageState.inputs.some((i) => i.slot === 'storyboard' && i.source !== 'empty'))
const hasUpstreamImages = computed(() =>
  stageState.inputs.some((i) => i.slot === 'images' && i.source !== 'empty'))

const playingImageUrl = computed(() => {
  const b = sb.playingBoard.value
  return b ? boardImageUrl(b) : null
})

const guideSize = computed(() => editor.canvasSize.value)
const guideStroke = computed(() => Math.max(1, Math.round(guideSize.value.height / 400)))

function syncOutputSlots(): void {
  const image = readWidgetStr(props.node, 'captured_image', '')
  const images = readWidgetStr(props.node, 'captured_images', '')
  const video = readWidgetStr(props.node, 'animatic_video', '')
  stageStore.setOutputSlot(stageState, 0, image || null)
  stageStore.setOutputSlot(stageState, 1, images || null)
  stageStore.setOutputSlot(stageState, 2, video || null)
}
onNodeConfigure(props.node, syncOutputSlots)
syncOutputSlots()

function toast(severity: 'success' | 'warn' | 'error', detail: string): void {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity, summary: 'ComfyTV', detail, life: 5000 })
}

function onImportUpstream(): void {
  const count = sb.importFromUpstream()
  if (count > 0) toast('success', t('storyboardEditor.imported', { count }))
  else toast('warn', t('storyboardEditor.noUpstreamData'))
}

function onImportScript(text: string): void {
  const count = sb.importFountainText(text)
  if (count > 0) toast('success', t('storyboardEditor.imported', { count }))
  else toast('warn', t('storyboardEditor.noScenesFound'))
}

function onImportUpstreamImages(): void {
  const count = sb.importFromUpstreamImages()
  if (count > 0) toast('success', t('storyboardEditor.imported', { count }))
  else toast('warn', t('storyboardEditor.noUpstreamData'))
}

async function onImportImages(files: File[]): Promise<void> {
  try {
    const count = await sb.importImageFiles(files)
    if (count > 0) toast('success', t('storyboardEditor.imported', { count }))
  } catch (err: any) {
    console.error('[ComfyTV/storyboardEditor] image import failed', err)
    toast('error', String(err?.message || err))
  }
}

async function onExportGif(): Promise<void> {
  try {
    const url = await sb.exportGif()
    if (url) {
      downloadUrl(url, `storyboard-${props.node.id}.gif`)
      toast('success', t('storyboardEditor.gifReady'))
    }
  } catch (err: any) {
    console.error('[ComfyTV/storyboardEditor] gif export failed', err)
    toast('error', `${t('storyboardEditor.gifFailed')}: ${String(err?.message || err)}`)
  }
}

async function onExportZip(): Promise<void> {
  try {
    const blob = await sb.exportBoardsZip()
    if (!blob) {
      toast('warn', t('storyboardEditor.zipEmpty'))
      return
    }
    downloadBlob(blob, `storyboard-${props.node.id}-boards.zip`)
  } catch (err: any) {
    console.error('[ComfyTV/storyboardEditor] zip export failed', err)
    toast('error', String(err?.message || err))
  }
}

function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function onExportAnimatic(): Promise<void> {
  try {
    await sb.exportAnimatic()
    toast('success', t('storyboardEditor.animaticReady'))
  } catch (err: any) {
    console.error('[ComfyTV/storyboardEditor] animatic export failed', err)
    toast('error', `${t('storyboardEditor.animaticFailed')}: ${String(err?.message || err)}`)
  }
}

async function onExportPdf(): Promise<void> {
  if (exportingPdf.value) return
  exportingPdf.value = true
  try {
    const blob = await exportStoryboardPdf(sb.doc.value, sb.labels.value, {
      title: String((props.node as any).title || 'Storyboard'),
    })
    downloadBlob(blob, `storyboard-${props.node.id}.pdf`)
  } catch (err: any) {
    console.error('[ComfyTV/storyboardEditor] pdf export failed', err)
    toast('error', `${t('storyboardEditor.pdfFailed')}: ${String(err?.message || err)}`)
  } finally {
    exportingPdf.value = false
  }
}

async function toggleFullscreen(): Promise<void> {
  fullscreen.value = !fullscreen.value
  await nextTick()
  editor.fitView()
}

const layerHotkeys = useLayerEditorHotkeys(editor, {
  setSpaceDown: (v) => canvasEl.value?.setSpaceDown(v),
  isFullscreen: () => fullscreen.value,
  exitFullscreen: () => { void toggleFullscreen() },
})
const { onKeyDown, onKeyUp } = useStoryboardHotkeys(sb, layerHotkeys)

const toggleBtnClass =
  'ctv:inline-flex ctv:size-7 ctv:items-center ctv:justify-center ctv:rounded-md ctv:border-0 ' +
  'ctv:bg-transparent ctv:text-muted-foreground ctv:cursor-pointer ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background ctv:hover:text-base-foreground'
const activeToggleClass = 'ctv:bg-primary-background/20 ctv:text-primary-background'

const tabBtnClass =
  'ctv:flex-1 ctv:py-1 ctv:px-2 ctv:text-2xs ctv:rounded ctv:border-0 ctv:cursor-pointer ' +
  'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:text-base-foreground'
const tabActiveClass = 'ctv:bg-base-background ctv:text-base-foreground'
</script>
