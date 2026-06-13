<template>
  <div :class="cardClass">
    <MainPromptInput :node="node" />

    <section
      v-if="state.kind === 'image-picker' && !hideContext && (poolCount > 0 || connectedInputs.length > 0)"
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
        type="COMFYTV_IMAGES"
        :content="poolContent"
        :empty-label="pickerSource === 'upstream-pending' ? $t('stage.empty.pending_upstream') : $t('stage.empty.no_output')"
        :selected-index="state.pickedIndex"
        click-mode="pick"
        @item-click="onItemClick"
      />
    </section>

    <section v-if="!hideContext && state.variant !== 'loader' && state.kind !== 'image-picker' && connectedInputs.length > 0"
             class="ctv:flex ctv:flex-col ctv:gap-1">
      <div :class="sectionLabel">{{ $t('stage.section.context') }}</div>

      <div class="ctv:flex ctv:flex-wrap ctv:gap-1.5">
        <div
          v-for="inp in connectedInputs"
          :key="inp.slot"
          :class="[
            'ctv-input-tile ctv:relative ctv:w-[76px] ctv:h-[76px] ctv:rounded-sm ctv:overflow-hidden ctv:bg-black/30 ctv:border',
            inp.source === 'upstream'         ? 'ctv:border-primary-background/70'
              : inp.source === 'upstream-pending' ? 'ctv:border-warning-background/70'
              : 'ctv:border-border-default',
          ]"
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
          >×</button>
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
      <span class="ctv:text-[13px]">{{ state.error.type === 'Cancelled' ? '⏹' : '⚠️' }}</span>
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

    <section v-if="!hideOutput" class="output ctv:flex-1 ctv:min-h-0 ctv:flex ctv:flex-col ctv:gap-1">
      <div :class="sectionLabel">{{ $t('stage.section.output', { type: state.outputType }) }}</div>

      <ValuePreview
        class="ctv:flex-1 ctv:min-h-0"
        :type="state.outputType"
        :content="state.output"
        :empty-label="state.running ? $t('stage.empty.generating') : $t('stage.empty.no_output')"
        :click-mode="state.kind === 'image-batch' ? 'pick' : 'refine'"
        :selected-index="state.kind === 'image-batch' ? state.pickedIndex : undefined"
        @item-click="onOutputItemClick"
      />
    </section>

    <section v-if="state.output && stageActions.length" class="ctv:flex ctv:flex-col ctv:gap-1">
      <div :class="sectionLabel">{{ $t('stage.section.actions') }}</div>
      <div class="action-list ctv:flex ctv:flex-wrap ctv:gap-1.5">
        <button
          v-for="a in stageActions"
          :key="a.id"
          :class="actionBtnClass(openActionId === a.id)"
          :title="$t(actionTooltipKey(state.kind, a.id))"
          @click="onActionClick(a)"
        >
          <span class="ctv:text-xs">{{ a.icon }}</span>
          <span class="ctv:font-semibold">{{ $t(actionLabelKey(state.kind, a.id)) }}</span>
          <span v-if="a.presets?.length" class="ctv:ml-0.5 ctv:text-3xs ctv:opacity-70">
            {{ openActionId === a.id ? '▾' : '▸' }}
          </span>
        </button>
      </div>
      <div
        v-if="openPresets.length"
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
          <span class="ctv:shrink-0 ctv:text-xs">{{ p.icon }}</span>
          <span class="ctv:flex-1">{{ $t(presetLabelKey(p.category, p.id)) }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  const base = 'ctv:flex ctv:flex-col ctv:gap-2 ctv:p-2 ctv:size-full ctv:box-border ctv:text-xs ctv:text-base-foreground'
  if (!props.state.error) return base
  if (props.state.error.type === 'Cancelled')
    return `${base} ctv:rounded ctv:outline ctv:outline-1 ctv:-outline-offset-1 ctv:outline-warning-background/50`
  return `${base} ctv:rounded ctv:outline ctv:outline-1 ctv:-outline-offset-1 ctv:outline-destructive-background/55`
})

const sectionLabel = 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60 ctv:mb-[3px]'

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

const batchInput = computed(() =>
  props.state.inputs.find(i => i.slot === 'batch')
)
const poolContent = computed<string | null>(() =>
  props.state.pool ?? batchInput.value?.content ?? null
)
const poolCount = computed(() => {
  try {
    const p = JSON.parse(String(poolContent.value ?? ''))
    return Array.isArray(p?.images) ? p.images.length : 0
  } catch {
    return 0
  }
})
const pickerSource = computed<InputSource>(() => batchInput.value?.source ?? 'empty')

const confirmingClear = ref(false)

watch(poolCount, (n) => { if (n === 0) confirmingClear.value = false })

function onClearPool() {
  props.onAction('clear-pool')
  confirmingClear.value = false
}

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
