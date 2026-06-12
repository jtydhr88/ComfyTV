<template>
  <div :class="cardClass">
    <MainPromptInput :node="node" />

    <section v-if="!hideContext && state.variant !== 'loader' && connectedInputs.length > 0"
             class="flex flex-col gap-1">
      <div :class="sectionLabel">{{ $t('stage.section.context') }}</div>

      <template v-if="state.kind === 'image-picker'">
        <div
          v-for="inp in connectedInputs"
          :key="inp.slot"
          class="ctv-picker-input flex flex-col gap-1 py-1"
          :class="`ctv-src-${inp.source}`"
        >
          <div class="flex items-baseline gap-2">
            <span class="text-[11px] font-semibold">{{ formatSlot(inp.slot) }}</span>
            <span class="ctv-src-tag text-3xs py-px px-1.5 rounded-sm tracking-wide bg-base-foreground/5 text-muted-foreground">
              {{ sourceLabel(inp.source) }}
            </span>
            <button
              :class="disconnectBtn"
              :title="$t('stage.disconnect')"
              @click="onDisconnect(inp.slot)"
            >×</button>
          </div>
          <ValuePreview
            :type="inp.type"
            :content="inp.content"
            :empty-label="inp.source === 'upstream-pending' ? $t('stage.empty.pending_upstream') : ''"
            :selected-index="inp.slot === 'batch' ? state.pickedIndex : undefined"
            click-mode="pick"
            @item-click="onItemClick"
          />
        </div>
      </template>

      <div v-else class="flex flex-wrap gap-1.5">
        <div
          v-for="inp in connectedInputs"
          :key="inp.slot"
          :class="[
            'ctv-input-tile relative w-[76px] h-[76px] rounded-sm overflow-hidden bg-black/30 border',
            inp.source === 'upstream'         ? 'border-primary-background/70'
              : inp.source === 'upstream-pending' ? 'border-warning-background/70'
              : 'border-border-default',
          ]"
          :title="`${formatSlot(inp.slot)} — ${sourceLabel(inp.source)}`"
        >
          <ValuePreview
            compact
            :type="inp.type"
            :content="inp.content"
            :empty-label="inp.source === 'upstream-pending' ? '…' : ''"
          />
          <span class="absolute bottom-0 inset-x-0 py-0.5 px-1 text-3xs font-semibold tracking-wide
                       text-white/90 overflow-hidden whitespace-nowrap text-ellipsis pointer-events-none
                       bg-linear-to-b from-transparent to-black/75">{{ formatSlot(inp.slot) }}</span>
          <button
            :class="['ctv-tile-disconnect absolute top-0.5 right-0.5 hidden', tileDisconnectBtn]"
            :title="$t('stage.disconnect')"
            @click="onDisconnect(inp.slot)"
          >×</button>
        </div>
      </div>
    </section>

    <div v-if="state.error"
         :class="[
           'error-row flex items-start gap-1.5 py-1.5 px-2 rounded-sm text-[11px] leading-snug border',
           state.error.type === 'Cancelled'
             ? 'is-cancel-banner border-warning-background/55 bg-warning-background/10 text-warning-background'
             : 'border-destructive-background/55 bg-destructive-background/10 text-destructive-background',
         ]">
      <span class="text-[13px]">{{ state.error.type === 'Cancelled' ? '⏹' : '⚠️' }}</span>
      <span class="flex-1 break-words font-mono" :title="state.error.traceback">
        <span v-if="state.error.type"
              :class="[
                'inline-block mr-1 py-0 px-1 rounded-sm font-bold',
                state.error.type === 'Cancelled'
                  ? 'bg-warning-background/30 text-base-foreground'
                  : 'bg-destructive-background/30 text-base-foreground',
              ]">{{ state.error.type }}:</span>
        {{ state.error.message }}
      </span>
      <button
        :class="tileDisconnectBtn"
        :title="$t('error.dismiss')"
        @click="onDismissError"
      >×</button>
    </div>

    <button
      v-if="state.variant !== 'loader' && state.variant !== 'transform' && state.kind !== 'image-picker'"
      :class="['run-btn', state.running && 'is-cancel', runBtnClass]"
      :disabled="!state.running && !canRun"
      @click="state.running ? onCancel() : onRun()"
    >
      <span v-if="state.running">⏹ {{ $t('stage.cancel') }}</span>
      <span v-else-if="state.preparingWorkflow">⏳ {{ $t('stage.preparingWorkflow') }}</span>
      <span v-else-if="state.output">↻ {{ $t('stage.rerun') }}</span>
      <span v-else>▶ {{ $t(`stage.runByKind.${state.kind}`, $t('stage.run')) }}</span>
    </button>

    <div v-if="state.running" class="flex items-center gap-1.5 mt-0.5">
      <div class="relative flex-auto h-1.5 rounded-sm overflow-hidden bg-base-foreground/10">
        <div
          class="progress-fill h-full transition-[width] duration-150 ease-out
                 bg-linear-to-r from-primary-background/85 to-primary-background-hover/85"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
      <span class="shrink-0 min-w-[60px] text-2xs text-right font-mono text-muted-foreground">
        {{ state.progress?.text || progressFallbackText }}
      </span>
    </div>

    <section v-if="!hideOutput" class="output flex-1 min-h-0 flex flex-col gap-1">
      <div :class="sectionLabel">{{ $t('stage.section.output', { type: state.outputType }) }}</div>

      <ValuePreview
        class="flex-1 min-h-0"
        :type="state.outputType"
        :content="state.output"
        :empty-label="state.running ? $t('stage.empty.generating') : $t('stage.empty.no_output')"
        :click-mode="state.kind === 'image-batch' ? 'pick' : 'refine'"
        :selected-index="state.kind === 'image-batch' ? state.pickedIndex : undefined"
        @item-click="onOutputItemClick"
      />
    </section>

    <section v-if="state.output && stageActions.length" class="flex flex-col gap-1">
      <div :class="sectionLabel">{{ $t('stage.section.actions') }}</div>
      <div class="action-list flex flex-wrap gap-1.5">
        <button
          v-for="a in stageActions"
          :key="a.id"
          :class="actionBtnClass(openActionId === a.id)"
          :title="$t(actionTooltipKey(state.kind, a.id))"
          @click="onActionClick(a)"
        >
          <span class="text-xs">{{ a.icon }}</span>
          <span class="font-semibold">{{ $t(actionLabelKey(state.kind, a.id)) }}</span>
          <span v-if="a.presets?.length" class="ml-0.5 text-3xs opacity-70">
            {{ openActionId === a.id ? '▾' : '▸' }}
          </span>
        </button>
      </div>
      <div
        v-if="openPresets.length"
        class="grid gap-1 p-1 mt-0.5 rounded-sm grid-cols-[repeat(auto-fill,minmax(110px,1fr))]
               bg-primary-background/5 border border-dashed border-primary-background/30"
      >
        <button
          v-for="p in openPresets"
          :key="p.id"
          :class="presetBtnClass"
          :title="$t(presetTooltipKey(p.category, p.id))"
          @click="onPresetClick(p)"
        >
          <span class="shrink-0 text-xs">{{ p.icon }}</span>
          <span class="flex-1">{{ $t(presetLabelKey(p.category, p.id)) }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MainPromptInput from './MainPromptInput.vue'
import ValuePreview from './ValuePreview.vue'
import { type ImagePreset } from '@/composables/stages/imagePresets'
import {
  ACTIONS_BY_KIND,
  type StageAction,
} from '@/composables/stages/stageActions'
import {
  actionLabelKey,
  actionTooltipKey,
  presetLabelKey,
  presetTooltipKey,
} from '@/composables/stages/actionLabels'
import type { LGraphNode } from '@/lib/comfyApp'
import { useStageStore, type InputSource, type StageState, type ImagePickContext } from '@/stores/stageStore'

const props = defineProps<{
  state: StageState
  node?: LGraphNode
  onRunRequest: () => void | Promise<void>
  onCancelRequest: () => void | Promise<void>
  onDisconnect: (slotName: string) => void
  onAction: (actionId: string, context?: ImagePickContext) => void
  hideContext?: boolean
  hideOutput?: boolean
}>()

const stageActions = computed<StageAction[]>(() => ACTIONS_BY_KIND[props.state.kind] || [])

const openActionId = ref<string | null>(null)
const openPresets = computed<ImagePreset[]>(() => {
  if (!openActionId.value) return []
  const a = stageActions.value.find(x => x.id === openActionId.value)
  return a?.presets ?? []
})

const progressPercent = computed(() => {
  const p = props.state.progress
  if (!p || !p.max) return 0
  return Math.max(0, Math.min(100, (p.value / p.max) * 100))
})
const progressFallbackText = computed(() => {
  const p = props.state.progress
  if (!p) return 'starting…'
  return `${p.value} / ${p.max}`
})

function onDismissError() {
  useStageStore().clearError(props.state)
}

function onActionClick(a: StageAction) {
  if (a.presets && a.presets.length) {
    openActionId.value = openActionId.value === a.id ? null : a.id
    return
  }
  openActionId.value = null
  props.onAction(a.id)
}

function onPresetClick(p: ImagePreset) {
  if (!openActionId.value) return
  props.onAction(`${openActionId.value}:${p.id}`)
  openActionId.value = null
}

function onItemClick(payload: ImagePickContext) {
  props.onAction('pick-item', payload)
}

function onOutputItemClick(payload: ImagePickContext) {
  if (props.state.kind !== 'image-batch') return
  props.onAction('pick-item', payload)
}

const t_disconnect = '断开此连接'

function sourceLabel(s: InputSource): string {
  switch (s) {
    case 'upstream':         return '← upstream'
    case 'upstream-pending': return '… waiting'
    default:                 return ''
  }
}

function formatSlot(slot: string): string {
  const dot = slot.indexOf('.')
  if (dot < 0) return slot
  const tail = slot.slice(dot + 1)
  const m = tail.match(/^([a-zA-Z_]+)(\d+)$/)
  if (m) return `${m[1]} #${m[2]}`
  return tail
}

const connectedInputs = computed(() =>
  props.state.inputs.filter(
    i => i.source === 'upstream' || i.source === 'upstream-pending'
  )
)

const canRun = computed(() => {
  if (props.state.preparingWorkflow) return false
  const hasPrompt = !!(props.state.mainPrompt && props.state.mainPrompt.trim())

  return hasPrompt || connectedInputs.value.length > 0
})

function onRun() { if (canRun.value) props.onRunRequest() }
function onCancel() { props.onCancelRequest() }
function onDisconnect(slot: string) { props.onDisconnect(slot) }

const cardClass = computed(() => {
  const base = 'flex flex-col gap-2 p-2 size-full box-border text-xs text-base-foreground'
  if (!props.state.error) return base
  if (props.state.error.type === 'Cancelled')
    return `${base} rounded outline outline-1 -outline-offset-1 outline-warning-background/50`
  return `${base} rounded outline outline-1 -outline-offset-1 outline-destructive-background/55`
})

const sectionLabel = 'text-2xs uppercase tracking-wide opacity-60 mb-[3px]'

const COMFY_BTN_BASE = 'relative inline-flex items-center justify-center gap-2 cursor-pointer'
  + ' touch-manipulation whitespace-nowrap appearance-none border-none transition-colors'
  + ' disabled:pointer-events-none disabled:opacity-50'

const COMFY_SIZE_LG = ' h-10 rounded-lg px-4 py-2 text-sm font-medium'
const COMFY_SIZE_SM = ' h-6 rounded-sm px-2 py-1 text-xs font-medium'

const disconnectBtn = COMFY_BTN_BASE
  + ' size-5 p-0 rounded-sm shrink-0 ml-auto'
  + ' bg-transparent text-muted-foreground hover:bg-secondary-background-hover'

const tileDisconnectBtn = COMFY_BTN_BASE
  + ' size-5 p-0 rounded-full'
  + ' bg-transparent text-destructive-background hover:bg-destructive-background/10'

const runBtnClass = computed(() => {
  const v = props.state.running
    ? ' bg-destructive-background text-base-foreground hover:bg-destructive-background-hover'
    : ' bg-primary-background text-base-foreground hover:bg-primary-background-hover'
  return COMFY_BTN_BASE + COMFY_SIZE_LG + v
})

function actionBtnClass(open: boolean) {
  const v = open
    ? ' bg-primary-background text-base-foreground hover:bg-primary-background-hover'
    : ' bg-secondary-background text-secondary-foreground hover:bg-secondary-background-hover'
  return COMFY_BTN_BASE + COMFY_SIZE_SM + v
}

const presetBtnClass = COMFY_BTN_BASE + COMFY_SIZE_SM
  + ' bg-secondary-background text-secondary-foreground hover:bg-secondary-background-hover'
</script>

<style scoped>
.ctv-input-tile:hover .ctv-tile-disconnect { display: inline-flex; }

.ctv-picker-input.ctv-src-upstream         .ctv-src-tag { background: color-mix(in srgb, var(--primary-background) 22%, transparent); color: var(--primary-background); }
.ctv-picker-input.ctv-src-upstream-pending .ctv-src-tag { background: color-mix(in srgb, var(--warning-background) 18%, transparent); color: var(--warning-background); }
</style>
