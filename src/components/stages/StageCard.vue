<template>
  <div
    :class="cardClass"
    @dragenter="onCardDragEnter"
    @dragover="onCardDragOver"
    @dragleave="onCardDragLeave"
    @drop="onCardDrop"
  >
    <MainPromptInput :node="node" />

    <ImageReferences v-if="!hideContext && state.variant !== 'loader'" :node="node" />

    <section
      v-if="isPicker && !hideContext && (poolCount > 0 || connectedInputs.length > 0)"
      class="ctv-picker-input ctv:flex ctv:flex-col ctv:gap-1 ctv:py-1"
      :class="`ctv-src-${pickerSource}`"
    >
      <div class="ctv:flex ctv:items-center ctv:gap-2">
        <span class="ctv:text-[11px] ctv:font-semibold">{{ $t('stage.section.pool') }}</span>
        <span class="ctv:text-3xs ctv:text-muted-foreground ctv:font-mono">{{ poolCount }}</span>
        <span v-if="pickerSource !== 'empty'" class="ctv-src-tag ctv:text-3xs ctv:py-px ctv:px-1.5 ctv:rounded-sm ctv:tracking-wide ctv:bg-base-foreground/5 ctv:text-muted-foreground">
          {{ sourceLabel(pickerSource) }}
        </span>
        <template v-if="poolCount > 0">
          <button
            v-if="!confirmingClear"
            :class="['ctv:ml-auto', clearBtn]"
            :title="$t('stage.pool.clearHint')"
            @click="confirmingClear = true"
          >{{ $t('stage.pool.clear') }}</button>
          <template v-else>
            <span class="ctv:ml-auto ctv:text-3xs ctv:text-destructive-background ctv:font-semibold">
              {{ $t('stage.pool.confirmClear') }}
            </span>
            <button :class="clearConfirmBtn" @click="onClearPool">{{ $t('stage.pool.confirm') }}</button>
            <button :class="clearBtn" @click="confirmingClear = false">{{ $t('stage.pool.cancel') }}</button>
          </template>
        </template>
      </div>
      <ValuePreview
        :type="poolPreviewType"
        :content="poolContent"
        :empty-label="pickerSource === 'upstream-pending' ? $t('stage.empty.pending_upstream') : $t('stage.empty.no_output')"
        :selected-index="state.pickedIndex"
        click-mode="pick"
        removable
        :upstream-urls="upstreamBatchUrls"
        @item-click="onItemClick"
        @item-remove="onItemRemove"
        @load-asset="onLoadAssetAction"
      />
    </section>

    <section v-if="!hideContext && state.variant !== 'loader' && !isPicker && connectedInputs.length > 0"
             class="ctv:flex ctv:flex-col ctv:gap-1">
      <button :class="contextToggle" :aria-expanded="!contextCollapsed" @click="contextCollapsed = !contextCollapsed">
        <i :class="['pi', contextCollapsed ? 'pi-chevron-right' : 'pi-chevron-down', 'ctv:w-2.5 ctv:text-2xs ctv:text-muted-foreground']" />
        <span :class="sectionLabel" class="ctv:mb-0">{{ $t('stage.section.context') }}</span>
        <span class="ctv:text-3xs ctv:text-muted-foreground ctv:font-mono ctv:normal-case ctv:tracking-normal">{{ contextSummary }}</span>
      </button>

      <div v-show="!contextCollapsed" class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
        <div
          v-for="inp in connectedInputs"
          :key="inp.slot"
          :class="[
            'ctv-input-tile ctv:relative ctv:w-[76px] ctv:h-[76px] ctv:rounded-sm ctv:overflow-hidden ctv:bg-black/30 ctv:border',
            tileSlotColor(inp)                ? ''
              : inp.source === 'upstream'         ? 'ctv:border-primary-background/70'
              : inp.source === 'upstream-pending' ? 'ctv:border-warning-background/70'
              : 'ctv:border-border-default',
          ]"
          :style="tileSlotColor(inp) ? { borderColor: tileSlotColor(inp)! } : undefined"
          :title="`${formatSlot(inp.slot)} — ${sourceLabel(inp.source)}`"
        >
          <ValuePreview
            compact
            :type="inp.type"
            :content="inp.content"
            :empty-label="inp.source === 'upstream-pending' ? '…' : ''"
          />
          <span class="ctv:absolute ctv:bottom-0 ctv:inset-x-0 ctv:py-0.5 ctv:px-1 ctv:text-3xs ctv:font-semibold ctv:tracking-wide
                       ctv:text-white/90 ctv:overflow-hidden ctv:whitespace-nowrap ctv:text-ellipsis ctv:pointer-events-none
                       ctv:bg-linear-to-b ctv:from-transparent ctv:to-black/75">{{ formatSlot(inp.slot) }}</span>
          <button
            :class="['ctv-tile-disconnect ctv:absolute ctv:top-0.5 ctv:right-0.5 ctv:hidden', tileDisconnectBtn]"
            :title="$t('stage.disconnect')"
            @click="onDisconnect(inp.slot)"
          ><i class="pi pi-times" /></button>
        </div>
      </div>
    </section>

    <div v-if="state.error"
         :class="[
           'error-row ctv:flex ctv:items-start ctv:gap-1.5 ctv:py-1.5 ctv:px-2 ctv:rounded-sm ctv:text-[11px] ctv:leading-snug ctv:border',
           state.error.type === 'Cancelled'
             ? 'is-cancel-banner ctv:border-warning-background/55 ctv:bg-warning-background/10 ctv:text-warning-background'
             : 'ctv:border-destructive-background/55 ctv:bg-destructive-background/10 ctv:text-destructive-background',
         ]">
      <i :class="['pi', state.error.type === 'Cancelled' ? 'pi-stop-circle' : 'pi-exclamation-triangle', 'ctv:text-[13px]']" />
      <span class="ctv:flex-1 ctv:break-words ctv:font-mono" :title="state.error.traceback">
        <span v-if="state.error.type"
              :class="[
                'ctv:inline-block ctv:mr-1 ctv:py-0 ctv:px-1 ctv:rounded-sm ctv:font-bold',
                state.error.type === 'Cancelled'
                  ? 'ctv:bg-warning-background/30 ctv:text-base-foreground'
                  : 'ctv:bg-destructive-background/30 ctv:text-base-foreground',
              ]">{{ state.error.type }}:</span>
        {{ state.error.message }}
      </span>
      <button
        :class="tileDisconnectBtn"
        :title="$t('error.dismiss')"
        @click="onDismissError"
      ><i class="pi pi-times" /></button>
    </div>

    <CustomParamsSection v-if="node" :state="state" :node="node" />

    <div v-if="showServerSelect" class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span class="ctv:shrink-0 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60">
        {{ $t('servers.runOn') }}
      </span>
      <ComfyTVSelect
        class="ctv:flex-1 ctv:min-w-0"
        :model-value="serverSelection"
        :options="serverOptions"
        :disabled="state.running"
        @update:model-value="onServerPick"
      />
    </div>

    <button
      v-if="state.variant !== 'loader' && state.variant !== 'transform' && !isPicker"
      :class="['run-btn', state.running && 'is-cancel', runBtnClass]"
      :disabled="!state.running && !canRun"
      @click="state.running ? onCancel() : onRun()"
    >
      <span v-if="state.running"><i class="pi pi-stop" /> {{ $t('stage.cancel') }}</span>
      <span v-else-if="state.preparingWorkflow"><i class="pi pi-hourglass" /> {{ $t('stage.preparingWorkflow') }}</span>
      <span v-else-if="state.output"><i class="pi pi-refresh" /> {{ $t('stage.rerun') }}</span>
      <span v-else><i class="pi pi-play" /> {{ $t(`stage.runByKind.${state.kind}`, $t('stage.run')) }}</span>
    </button>

    <div v-if="state.running" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:mt-0.5">
      <div class="ctv:relative ctv:flex-auto ctv:h-1.5 ctv:rounded-sm ctv:overflow-hidden ctv:bg-base-foreground/10">
        <div
          class="progress-fill ctv:h-full ctv:transition-[width] ctv:duration-150 ctv:ease-out
                 ctv:bg-linear-to-r ctv:from-primary-background/85 ctv:to-primary-background-hover/85"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
      <span class="ctv:shrink-0 ctv:min-w-[60px] ctv:text-2xs ctv:text-right ctv:font-mono ctv:text-muted-foreground">
        {{ state.progress?.text || progressFallbackText }}
      </span>
    </div>

    <section v-if="!hideOutput && state.kind !== 'audio-picker' && state.kind !== 'video-picker'" class="output ctv:flex-1 ctv:min-h-0 ctv:flex ctv:flex-col ctv:gap-1">
      <div :class="sectionLabel">{{ $t('stage.section.output', { type: state.outputType }) }}</div>

      <ValuePreview
        class="ctv:flex-1 ctv:min-h-0"
        :type="state.outputType"
        :content="state.output"
        :empty-label="state.running ? $t('stage.empty.generating') : $t('stage.empty.no_output')"
        :click-mode="state.kind === 'image-batch' ? 'pick' : 'refine'"
        :selected-index="state.kind === 'image-batch' ? state.pickedIndex : undefined"
        @item-click="onOutputItemClick"
        @load-asset="onLoadAssetAction"
        @capture-view="onCaptureViewAction"
      />
    </section>

    <section v-if="!hideActions && state.output && stageActions.length" class="ctv:flex ctv:flex-col ctv:gap-1">
      <button :class="contextToggle" :aria-expanded="!actionsCollapsed" @click="actionsCollapsed = !actionsCollapsed">
        <i :class="['pi', actionsCollapsed ? 'pi-chevron-right' : 'pi-chevron-down', 'ctv:w-2.5 ctv:text-2xs ctv:text-muted-foreground']" />
        <span :class="sectionLabel" class="ctv:mb-0">{{ $t('stage.section.actions') }}</span>
        <span class="ctv:text-3xs ctv:text-muted-foreground ctv:font-mono ctv:normal-case ctv:tracking-normal">{{ stageActions.length }}</span>
      </button>
      <div v-show="!actionsCollapsed" class="action-list ctv:flex ctv:flex-wrap ctv:gap-1.5">
        <button
          v-for="a in stageActions"
          :key="a.id"
          :class="actionBtnClass(openActionId === a.id)"
          :title="$t(actionTooltipKey(state.kind, a.id))"
          @click="onActionClick(a)"
        >
          <StageIcon :name="a.icon" class="ctv:text-xs" />
          <span class="ctv:font-semibold">{{ $t(actionLabelKey(state.kind, a.id)) }}</span>
          <i v-if="a.presets?.length"
             :class="['pi', openActionId === a.id ? 'pi-chevron-down' : 'pi-chevron-right', 'ctv:ml-0.5 ctv:text-3xs ctv:opacity-70']" />
        </button>
      </div>
      <div
        v-if="openPresets.length"
        v-show="!actionsCollapsed"
        class="ctv:grid ctv:gap-1 ctv:p-1 ctv:mt-0.5 ctv:rounded-sm ctv:grid-cols-[repeat(auto-fill,minmax(110px,1fr))]
               ctv:bg-primary-background/5 ctv:border ctv:border-dashed ctv:border-primary-background/30"
      >
        <button
          v-for="p in openPresets"
          :key="p.id"
          :class="presetBtnClass"
          :title="$t(presetTooltipKey(p.category, p.id))"
          @click="onPresetClick(p)"
        >
          <StageIcon :name="p.icon" class="ctv:shrink-0 ctv:text-xs" />
          <span class="ctv:flex-1">{{ $t(presetLabelKey(p.category, p.id)) }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import ImageReferences from './ImageReferences.vue'
import MainPromptInput from './MainPromptInput.vue'
import StageIcon from '@/components/widgets/StageIcon.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import CustomParamsSection from './CustomParamsSection.vue'
import { LOCAL_SERVER, useServerStore } from '@/stores/serverStore'
import { t } from '@/i18n'
import ValuePreview from './ValuePreview.vue'
import { imageInputSlotIndex, slotColor } from '@/composables/stages/imageSlotMentions'
import { useActionsCollapsed, useContextCollapsed } from '@/composables/stages/useContextCollapsed'
import { formatSlot, useStageCard } from '@/composables/stages/useStageCard'
import {
  actionLabelKey,
  actionTooltipKey,
  presetLabelKey,
  presetTooltipKey,
} from '@/composables/stages/actionLabels'
import type { LGraphNode } from '@/lib/comfyApp'
import { toastLoaderUploadFailed, useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'
import type { AssetMediaType } from '@/utils/mediaFileTypes'
import { uploadBlobNamed } from '@/utils/uploadCanvas'
import { getWidget, writeWidget } from '@/utils/widget'
import { isPoolPickerKind, useStageStore, type InputSource, type StageState, type ImagePickContext } from '@/stores/stageStore'

const props = defineProps<{
  state: StageState
  node?: LGraphNode
  onRunRequest: () => void | Promise<void>
  onCancelRequest: () => void | Promise<void>
  onDisconnect: (slotName: string) => void
  onAction: (actionId: string, context?: ImagePickContext) => void
  hideContext?: boolean
  hideOutput?: boolean
  hideActions?: boolean
}>()

const {
  stageActions,
  openActionId,
  openPresets,
  onActionClick,
  onPresetClick,
  connectedInputs,
  canRun,
  progressPercent,
  poolContent,
  poolCount,
  pickerSource,
  upstreamBatchUrls,
  confirmingClear,
  onClearPool,
} = useStageCard(() => props.state, props.onAction)

const isPicker = computed(() => isPoolPickerKind(props.state.kind))

const contextCollapsed = useContextCollapsed(() => (props.node as any)?.id ?? null)
const actionsCollapsed = useActionsCollapsed(() => (props.node as any)?.id ?? null)

function slotCategory(slot: string): string {
  const dot = slot.indexOf('.')
  const tail = dot < 0 ? slot : slot.slice(dot + 1)
  const m = tail.match(/^([a-zA-Z_]+)\d*$/)
  return m ? m[1] : tail
}

const contextSummary = computed(() => {
  const counts = new Map<string, number>()
  for (const inp of connectedInputs.value) {
    const c = slotCategory(inp.slot)
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return [...counts]
    .map(([c, n]) => `${n} ${n === 1 ? c : `${c}s`}`)
    .join(' · ')
})

const PLAIN_LOADER_WIDGET: Record<string, { kind: AssetMediaType; widget: string }> = {
  'ComfyTV.ImageLoaderStage': { kind: 'image', widget: 'image' },
  'ComfyTV.VideoLoaderStage': { kind: 'video', widget: 'video' },
  'ComfyTV.AudioLoaderStage': { kind: 'audio', widget: 'audio' },
}

const loaderDropCfg = computed(() =>
  props.node ? PLAIN_LOADER_WIDGET[(props.node as any).comfyClass] ?? null : null,
)

const fileDrop = useLoaderFileDrop({
  kind: () => loaderDropCfg.value?.kind ?? 'image',
  onFiles: async (files) => {
    const cfg = loaderDropCfg.value
    if (!cfg || !props.node) return
    try {
      let last = ''
      for (const f of files) {
        const uploaded = await uploadBlobNamed(f, { subfolder: '', filename: f.name })
        last = uploaded.name
        const w = getWidget(props.node, cfg.widget) as any
        const values = w?.options?.values
        if (Array.isArray(values) && !values.includes(last)) values.push(last)
      }
      if (last) writeWidget(props.node, cfg.widget, last)
    } catch (e) {
      console.error('[ComfyTV/loader-drop] upload failed', e)
      toastLoaderUploadFailed(e)
    }
  },
})

function onCardDragEnter(e: DragEvent) { if (loaderDropCfg.value) fileDrop.onDragEnter(e) }
function onCardDragOver(e: DragEvent)  { if (loaderDropCfg.value) fileDrop.onDragOver(e) }
function onCardDragLeave(e: DragEvent) { if (loaderDropCfg.value) fileDrop.onDragLeave(e) }
function onCardDrop(e: DragEvent)      { if (loaderDropCfg.value) fileDrop.onDrop(e) }

const serverStore = useServerStore()
void serverStore.load()

const showServerSelect = computed(() =>
  props.state.variant !== 'loader'
  && props.state.variant !== 'transform'
  && !isPicker.value
  && !!props.node
  && serverStore.hasRemotes)

function remoteLabel(id: number, label: string): string {
  const st = serverStore.statusFor(id)
  if (!st) return label
  if (!st.online) return `${label} · ${t('servers.status.offline')}`
  const total = st.running + st.pending
  return total > 0 ? `${label} · ${t('servers.status.queueShort', { n: total })}` : label
}

const serverOptions = computed(() => [
  { value: LOCAL_SERVER, label: t('servers.local') },
  ...serverStore.enabledServers.map(s => ({
    value: String(s.id),
    label: remoteLabel(s.id, s.label),
  })),
])

let releaseStatus: (() => void) | null = null
watch(showServerSelect, (on) => {
  if (on && !releaseStatus) {
    releaseStatus = serverStore.subscribeStatus()
  } else if (!on && releaseStatus) {
    releaseStatus()
    releaseStatus = null
  }
}, { immediate: true })
onUnmounted(() => {
  releaseStatus?.()
  releaseStatus = null
})

const serverSelectionTick = ref(0)
const serverSelection = computed(() => {
  void serverSelectionTick.value
  const raw = (props.node as any)?.properties?.comfytv_server
  if (raw == null || raw === '' || raw === LOCAL_SERVER) return LOCAL_SERVER
  const id = Number(raw)
  const server = Number.isFinite(id) ? serverStore.byId(id) : undefined
  return server?.enabled ? String(id) : LOCAL_SERVER
})

function onServerPick(v: string | number) {
  const n = props.node as any
  if (!n) return
  n.properties = n.properties || {}
  n.properties.comfytv_server = String(v)
  serverSelectionTick.value++
}

const poolPreviewType = computed(() => {
  if (props.state.kind === 'audio-picker') return 'COMFYTV_AUDIOS'
  if (props.state.kind === 'video-picker') return 'COMFYTV_VIDEOS'
  return 'COMFYTV_IMAGES'
})

const progressFallbackText = computed(() => {
  const p = props.state.progress
  if (!p) return t('stage.starting')
  return `${p.value} / ${p.max}`
})

function onDismissError() {
  useStageStore().clearError(props.state)
}

function onItemClick(payload: ImagePickContext) {
  props.onAction('pick-item', payload)
}

function onItemRemove(payload: ImagePickContext) {
  props.onAction('remove-pool-item', payload)
}

function onOutputItemClick(payload: ImagePickContext) {
  if (props.state.kind !== 'image-batch') return
  props.onAction('pick-item', payload)
}

function onLoadAssetAction(payload: ImagePickContext) {
  props.onAction('load-asset', payload)
}

function onCaptureViewAction(payload: ImagePickContext) {
  props.onAction('model-capture-view', payload)
}

function sourceLabel(s: InputSource): string {
  switch (s) {
    case 'upstream':         return t('stage.source.upstream')
    case 'upstream-pending': return t('stage.source.pending')
    default:                 return ''
  }
}

function tileSlotColor(inp: { slot: string; source: InputSource }): string | null {
  if (inp.source !== 'upstream') return null
  const idx = imageInputSlotIndex(inp.slot)
  return idx == null ? null : slotColor(idx)
}

function onRun() { if (canRun.value) props.onRunRequest() }
function onCancel() { props.onCancelRequest() }
function onDisconnect(slot: string) { props.onDisconnect(slot) }

const cardClass = computed(() => {
  const base = 'ctv:flex ctv:flex-col ctv:gap-2 ctv:p-2 ctv:size-full ctv:box-border ctv:text-xs ctv:text-base-foreground'
  if (fileDrop.dragActive.value)
    return `${base} ctv:rounded ctv:outline ctv:outline-2 ctv:-outline-offset-2 ctv:outline-primary-background/70 ctv:bg-primary-background/5`
  if (!props.state.error) return base
  if (props.state.error.type === 'Cancelled')
    return `${base} ctv:rounded ctv:outline ctv:outline-1 ctv:-outline-offset-1 ctv:outline-warning-background/50`
  return `${base} ctv:rounded ctv:outline ctv:outline-1 ctv:-outline-offset-1 ctv:outline-destructive-background/55`
})

const sectionLabel = 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60 ctv:mb-[3px]'
const contextToggle = 'ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:py-0 ctv:px-0 ctv:bg-transparent ctv:border-0 ctv:cursor-pointer ctv:text-left ctv:[font-family:inherit]'

const COMFY_BTN_BASE = 'ctv:relative ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-2 ctv:cursor-pointer'
  + ' ctv:touch-manipulation ctv:whitespace-nowrap ctv:appearance-none ctv:border-none ctv:transition-colors'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'

const COMFY_SIZE_LG = ' ctv:h-10 ctv:rounded-lg ctv:px-4 ctv:py-2 ctv:text-sm ctv:font-medium'
const COMFY_SIZE_SM = ' ctv:h-6 ctv:rounded-sm ctv:px-2 ctv:py-1 ctv:text-xs ctv:font-medium'

const tileDisconnectBtn = COMFY_BTN_BASE
  + ' ctv:size-5 ctv:p-0 ctv:rounded-full'
  + ' ctv:bg-transparent ctv:text-destructive-background ctv:hover:bg-destructive-background/10'

const clearBtn = COMFY_BTN_BASE
  + ' ctv:h-5 ctv:px-1.5 ctv:rounded-sm ctv:text-3xs ctv:font-semibold ctv:tracking-wide'
  + ' ctv:bg-transparent ctv:text-muted-foreground ctv:hover:bg-destructive-background/10 ctv:hover:text-destructive-background'

const clearConfirmBtn = COMFY_BTN_BASE
  + ' ctv:h-5 ctv:px-1.5 ctv:rounded-sm ctv:text-3xs ctv:font-semibold ctv:tracking-wide'
  + ' ctv:bg-destructive-background ctv:text-base-foreground ctv:hover:bg-destructive-background-hover'

const runBtnClass = computed(() => {
  const v = props.state.running
    ? ' ctv:bg-destructive-background ctv:text-base-foreground ctv:hover:bg-destructive-background-hover'
    : ' ctv:bg-primary-background ctv:text-base-foreground ctv:hover:bg-primary-background-hover'
  return COMFY_BTN_BASE + COMFY_SIZE_LG + v
})

function actionBtnClass(open: boolean) {
  const v = open
    ? ' ctv:bg-primary-background ctv:text-base-foreground ctv:hover:bg-primary-background-hover'
    : ' ctv:bg-secondary-background ctv:text-secondary-foreground ctv:hover:bg-secondary-background-hover'
  return COMFY_BTN_BASE + COMFY_SIZE_SM + v
}

const presetBtnClass = COMFY_BTN_BASE + COMFY_SIZE_SM
  + ' ctv:bg-secondary-background ctv:text-secondary-foreground ctv:hover:bg-secondary-background-hover'
</script>

<style scoped>
.ctv-input-tile:hover .ctv-tile-disconnect { display: inline-flex; }

.ctv-picker-input.ctv-src-upstream         .ctv-src-tag { background: color-mix(in srgb, var(--primary-background) 22%, transparent); color: var(--primary-background); }
.ctv-picker-input.ctv-src-upstream-pending .ctv-src-tag { background: color-mix(in srgb, var(--warning-background) 18%, transparent); color: var(--warning-background); }
</style>
