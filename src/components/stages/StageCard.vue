<template>
  <div class="stage-card" :class="{
    'has-error': !!state.error && state.error.type !== 'Cancelled',
    'is-cancelled': state.error?.type === 'Cancelled',
  }">
    <MainPromptInput :node="node" />

    <section v-if="!hideContext && state.variant !== 'loader' && connectedInputs.length > 0" class="inputs">
      <div class="section-label">{{ $t('stage.section.context') }}</div>

      <template v-if="state.kind === 'image-picker'">
        <div
          v-for="inp in connectedInputs"
          :key="inp.slot"
          class="picker-input"
          :class="`src-${inp.source}`"
        >
          <div class="picker-input-header">
            <span class="slot-name">{{ formatSlot(inp.slot) }}</span>
            <span class="src-tag">{{ sourceLabel(inp.source) }}</span>
            <button
              class="disconnect-btn"
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

      <div v-else class="input-tiles">
        <div
          v-for="inp in connectedInputs"
          :key="inp.slot"
          class="input-tile"
          :class="`src-${inp.source}`"
          :title="`${formatSlot(inp.slot)} — ${sourceLabel(inp.source)}`"
        >
          <ValuePreview
            compact
            :type="inp.type"
            :content="inp.content"
            :empty-label="inp.source === 'upstream-pending' ? '…' : ''"
          />
          <span class="tile-slot">{{ formatSlot(inp.slot) }}</span>
          <button
            class="tile-disconnect"
            :title="$t('stage.disconnect')"
            @click="onDisconnect(inp.slot)"
          >×</button>
        </div>
      </div>
    </section>

    <div v-if="state.error" class="error-row" :class="{ 'is-cancel-banner': state.error.type === 'Cancelled' }">
      <span class="error-icon">{{ state.error.type === 'Cancelled' ? '⏹' : '⚠️' }}</span>
      <span class="error-msg" :title="state.error.traceback">
        <span v-if="state.error.type" class="error-type">{{ state.error.type }}:</span>
        {{ state.error.message }}
      </span>
      <button class="error-dismiss" :title="$t('error.dismiss')" @click="onDismissError">×</button>
    </div>

    <button
      v-if="state.variant !== 'loader' && state.variant !== 'transform' && state.kind !== 'image-picker'"
      class="run-btn"
      :class="{ 'is-cancel': state.running }"
      :disabled="!state.running && !canRun"
      @click="state.running ? onCancel() : onRun()"
    >
      <span v-if="state.running">⏹ {{ $t('stage.cancel') }}</span>
      <span v-else-if="state.preparingWorkflow">⏳ {{ $t('stage.preparingWorkflow') }}</span>
      <span v-else-if="state.output">↻ {{ $t('stage.rerun') }}</span>
      <span v-else>▶ {{ $t(`stage.runByKind.${state.kind}`, $t('stage.run')) }}</span>
    </button>

    <div v-if="state.running" class="progress-row">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
      <span class="progress-label">
        {{ state.progress?.text || progressFallbackText }}
      </span>
    </div>

    <section v-if="!hideOutput" class="output">
      <div class="section-label">{{ $t('stage.section.output', { type: state.outputType }) }}</div>

      <ValuePreview
        :type="state.outputType"
        :content="state.output"
        :empty-label="state.running ? $t('stage.empty.generating') : $t('stage.empty.no_output')"
        :click-mode="state.kind === 'image-batch' ? 'pick' : 'refine'"
        :selected-index="state.kind === 'image-batch' ? state.pickedIndex : undefined"
        @item-click="onOutputItemClick"
      />
    </section>

    <section v-if="state.output && stageActions.length" class="actions">
      <div class="section-label">{{ $t('stage.section.actions') }}</div>
      <div class="action-list">
        <button
          v-for="a in stageActions"
          :key="a.id"
          class="action-btn"
          :class="{ 'is-open': openActionId === a.id }"
          :title="$t(actionTooltipKey(state.kind, a.id))"
          @click="onActionClick(a)"
        >
          <span class="action-icon">{{ a.icon }}</span>
          <span class="action-label">{{ $t(actionLabelKey(state.kind, a.id)) }}</span>
          <span v-if="a.presets?.length" class="action-caret">
            {{ openActionId === a.id ? '▾' : '▸' }}
          </span>
        </button>
      </div>
      <div v-if="openPresets.length" class="preset-list">
        <button
          v-for="p in openPresets"
          :key="p.id"
          class="preset-btn"
          :title="$t(presetTooltipKey(p.category, p.id))"
          @click="onPresetClick(p)"
        >
          <span class="preset-icon">{{ p.icon }}</span>
          <span class="preset-label">{{ $t(presetLabelKey(p.category, p.id)) }}</span>
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
import { useStageStore, type InputSource, type StageState, type ImagePickContext } from '@/stores/stageStore'

const props = defineProps<{
  state: StageState
  node?: any
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
</script>

<style scoped>
.stage-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 8px;
  font-size: 12px;
  color: var(--input-text, #ddd);
  height: 100%;
  box-sizing: border-box;
}

.section-label {
  font-size: 10px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 3px;
}

.inputs { display: flex; flex-direction: column; gap: 4px; }

/* Picker context — full-width single input with full clickable grid below.
   Distinct from the compact tile row everywhere else. */
.picker-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 0;
}
.picker-input-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.slot-name { font-size: 11px; font-weight: 600; }
.src-tag {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.5px;
}
.picker-input.src-upstream  .src-tag { background: rgba(78, 168, 255, 0.22); color: #9dd0ff; }
.picker-input.src-upstream-pending .src-tag { background: rgba(255, 200, 87, 0.18); color: #ffd089; }

.disconnect-btn {
  margin-left: auto;
  width: 20px; height: 20px;
  border: 1px solid var(--border-color, #555);
  background: transparent;
  color: rgba(255,255,255,0.6);
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 0;
}
.disconnect-btn:hover {
  background: rgba(220, 50, 50, 0.7);
  color: #fff;
  border-color: rgba(220, 50, 50, 0.8);
}

.input-tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.input-tile {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 3px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.32);
  border: 1px solid var(--border-color, #444);
  flex: 0 0 auto;
}
.input-tile.src-upstream         { border-color: rgba(78, 168, 255, 0.7); }
.input-tile.src-upstream-pending { border-color: rgba(255, 200, 87, 0.7); }

.tile-slot {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 4px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
  color: rgba(255, 255, 255, 0.92);
  pointer-events: none;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.tile-disconnect {
  position: absolute;
  top: 2px; right: 2px;
  width: 18px; height: 18px;
  border: 1px solid rgba(220, 50, 50, 0.65);
  background: rgba(0, 0, 0, 0.65);
  color: rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: none;
  align-items: center;
  justify-content: center;
}
.input-tile:hover .tile-disconnect { display: inline-flex; }
.tile-disconnect:hover {
  background: rgba(220, 50, 50, 0.85);
  color: #fff;
}

.run-btn {
  padding: 6px 12px;
  border: 1px solid var(--p-primary-color, #4ea8ff);
  background: rgba(78, 168, 255, 0.15);
  color: #9dd0ff;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.run-btn:hover:not(:disabled) { background: rgba(78, 168, 255, 0.28); }
.run-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.run-btn.is-cancel {
  border-color: rgba(220, 70, 70, 0.7);
  background: rgba(220, 70, 70, 0.18);
  color: #ffcdcd;
}
.run-btn.is-cancel:hover {
  background: rgba(220, 70, 70, 0.32);
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.progress-bar {
  flex: 1 1 auto;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(78, 168, 255, 0.85), rgba(155, 110, 230, 0.85));
  transition: width 120ms ease-out;
}
.progress-label {
  flex: 0 0 auto;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  min-width: 60px;
  text-align: right;
}

.stage-card.has-error {
  outline: 1px solid rgba(220, 70, 70, 0.55);
  outline-offset: -1px;
  border-radius: 4px;
}
.stage-card.is-cancelled {
  outline: 1px solid rgba(230, 180, 60, 0.5);
  outline-offset: -1px;
  border-radius: 4px;
}
.error-row {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  padding: 5px 7px;
  border: 1px solid rgba(220, 70, 70, 0.55);
  background: rgba(220, 70, 70, 0.12);
  color: #ffcdcd;
  border-radius: 3px;
  font-size: 11px;
  line-height: 1.35;
}
.error-row.is-cancel-banner {
  border-color: rgba(230, 180, 60, 0.55);
  background: rgba(230, 180, 60, 0.12);
  color: #ffe6a0;
}
.error-row.is-cancel-banner .error-type {
  background: rgba(230, 180, 60, 0.32);
  color: #fff2c2;
}
.error-icon { flex: 0 0 auto; font-size: 13px; }
.error-msg {
  flex: 1 1 auto;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.error-type {
  display: inline-block;
  margin-right: 4px;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(220, 70, 70, 0.3);
  color: #ffe0e0;
  font-weight: 700;
}
.error-dismiss {
  flex: 0 0 auto;
  width: 18px; height: 18px;
  border: 1px solid rgba(220, 70, 70, 0.4);
  background: transparent;
  color: #ffcdcd;
  border-radius: 50%;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 0;
}
.error-dismiss:hover {
  background: rgba(220, 70, 70, 0.4);
  color: #fff;
}

.actions { display: flex; flex-direction: column; gap: 4px; }
.action-list {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.action-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 9px;
  border: 1px solid var(--border-color, #555);
  background: rgba(255,255,255,0.04);
  color: var(--input-text, #ddd);
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}
.action-btn:hover {
  background: rgba(155, 110, 230, 0.22);
  border-color: rgba(155, 110, 230, 0.7);
  color: #e0d0ff;
}
.action-icon { font-size: 12px; }
.action-label { font-weight: 600; }
.action-caret {
  margin-left: 2px;
  font-size: 9px;
  opacity: 0.7;
}
.action-btn.is-open {
  background: rgba(155, 110, 230, 0.22);
  border-color: rgba(155, 110, 230, 0.7);
  color: #e0d0ff;
}

.preset-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 4px;
  padding: 4px;
  margin-top: 2px;
  background: rgba(155, 110, 230, 0.06);
  border: 1px dashed rgba(155, 110, 230, 0.35);
  border-radius: 3px;
}
.preset-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 8px;
  border: 1px solid var(--border-color, #555);
  background: rgba(255,255,255,0.04);
  color: var(--input-text, #ddd);
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  text-align: left;
  min-height: 26px;
}
.preset-btn:hover {
  background: rgba(155, 110, 230, 0.22);
  border-color: rgba(155, 110, 230, 0.7);
  color: #e0d0ff;
}
.preset-icon { font-size: 12px; flex: 0 0 auto; }
.preset-label { flex: 1 1 auto; }
</style>
