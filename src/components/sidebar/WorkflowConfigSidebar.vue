<template>
  <div class="ctv:flex ctv:flex-col ctv:size-full ctv:box-border ctv:overflow-auto ctv:text-xs
              ctv:pt-2 ctv:pb-6 ctv:px-2.5 ctv:text-base-foreground">
    <div class="ctv:sticky ctv:-top-2 ctv:z-[1] ctv:-mx-2.5 ctv:-mt-2 ctv:mb-2 ctv:py-1.5 ctv:px-2.5
                ctv:bg-interface-panel-surface ctv:border-b ctv:border-border-subtle">
      <span class="ctv:font-semibold ctv:text-sm">{{ $t('configSidebar.title') }}</span>
    </div>

    <div v-if="!selected" :class="emptyClass">
      {{ $t('configSidebar.empty') }}
    </div>

    <div v-else-if="!selected.workflowLabel" :class="emptyClass">
      {{ $t('configSidebar.noWorkflowPicked') }}
    </div>

    <div v-else-if="loadError"
         class="ctv:my-1.5 ctv:py-1.5 ctv:px-2 ctv:text-xs ctv:rounded
                ctv:bg-destructive-background/15 ctv:border ctv:border-destructive-background/50 ctv:text-destructive-background">
      {{ loadError }}
    </div>

    <div v-else-if="config" class="ctv:flex ctv:flex-col ctv:gap-3">
      <div class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:pt-1 ctv:pb-2 ctv:border-b ctv:border-border-subtle">
        <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ config.kind }}</span>
        <span class="ctv:text-xs ctv:font-semibold">{{ config.label }}</span>
        <span v-if="!config.has_api" class="ctv:mt-1 ctv:text-2xs ctv:italic ctv:text-warning-background">
          {{ $t('configSidebar.pickWorkflowFirst') }}
        </span>
      </div>

      <section v-if="config.gui_notes?.length"
               class="ctv:rounded ctv:overflow-hidden
                      ctv:bg-warning-background/[0.03] ctv:border ctv:border-warning-background/25">
        <button
          :class="[
            'ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:py-[5px] ctv:px-2 ctv:text-left ctv:cursor-pointer ctv:[font-family:inherit]',
            'ctv:bg-warning-background/5 ctv:border-0 ctv:border-b ctv:text-inherit',
            'ctv:hover:bg-warning-background/10',
            notesCollapsed ? 'ctv:border-b-transparent' : 'ctv:border-b-warning-background/15',
          ]"
          :aria-expanded="!notesCollapsed"
          @click="toggleNotesCollapsed"
        >
          <span class="ctv:w-2.5 ctv:text-2xs ctv:text-warning-background/75">{{ notesCollapsed ? '▸' : '▾' }}</span>
          <span class="ctv:flex-1 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:font-semibold ctv:text-warning-background">
            {{ $t('configSidebar.section.notes') }}
          </span>
          <span class="ctv:text-3xs ctv:font-mono ctv:py-px ctv:px-1.5 ctv:rounded-lg
                       ctv:bg-warning-background/10 ctv:text-warning-background/70">
            {{ config.gui_notes.length }}
          </span>
        </button>
        <div v-if="!notesCollapsed" class="ctv:flex ctv:flex-col ctv:gap-1 ctv:py-1.5 ctv:px-2">
          <div v-for="(note, i) in config.gui_notes" :key="i"
               class="ctv:py-1 ctv:px-2 ctv:rounded-sm ctv:border-l-2
                      ctv:bg-warning-background/5 ctv:border-warning-background/50">
            <pre class="ctv:m-0 ctv:text-xs ctv:whitespace-pre-wrap ctv:[font-family:inherit] ctv:text-base-foreground">{{ note.text }}</pre>
          </div>
        </div>
      </section>

      <section v-if="config.exposed_widgets?.length">
        <h3 :class="sectionHeading">{{ $t('configSidebar.section.widgets') }}</h3>
        <div v-for="(grp, gi) in groupedWidgets" :key="gi"
             class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:mb-2.5">
          <div v-if="grp.title"
               class="ctv:py-1 ctv:text-3xs ctv:uppercase ctv:tracking-wide
                      ctv:text-muted-foreground ctv:border-b ctv:border-border-subtle">
            {{ grp.title }}
          </div>

          <div v-for="node in grp.nodes" :key="node.node_id"
               class="ctv:rounded-lg ctv:overflow-hidden ctv:bg-base-foreground/[0.03]">
            <button
              :class="[
                'ctv:flex ctv:items-center ctv:gap-1.5 ctv:w-full ctv:py-1.5 ctv:px-2 ctv:text-left ctv:cursor-pointer ctv:text-inherit ctv:[font-family:inherit]',
                'ctv:bg-transparent ctv:border-none ctv:hover:bg-secondary-background-hover',
              ]"
              :aria-expanded="!isCollapsed(node.node_id)"
              @click="toggleCollapsed(node.node_id)"
            >
              <span class="ctv:w-2.5 ctv:text-2xs ctv:text-muted-foreground">{{ isCollapsed(node.node_id) ? '▸' : '▾' }}</span>
              <span class="ctv:text-xs ctv:font-semibold ctv:text-base-foreground">{{ node.node_title }}</span>
              <span v-if="node.node_title !== node.node_type"
                    class="ctv:text-2xs ctv:font-mono ctv:text-muted-foreground/60">
                ({{ node.node_type }})
              </span>
              <span class="ctv:text-2xs ctv:font-mono ctv:text-muted-foreground/60">#{{ node.node_id }}</span>
              <span class="ctv:flex-1"></span>
              <span class="ctv:text-3xs ctv:font-mono ctv:py-px ctv:px-1.5 ctv:rounded-lg ctv:bg-base-foreground/5 ctv:text-muted-foreground">
                {{ boundCountFor(node) }} / {{ node.widgets.length }}
              </span>
            </button>

            <div v-if="!isCollapsed(node.node_id)" class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-2">
              <div
                v-for="w in node.widgets"
                :key="`${w.node_id}/${w.widget_name}`"
                class="ctv:flex ctv:flex-col ctv:gap-1 ctv:[&_+_&]:pt-1.5 ctv:[&_+_&]:border-t ctv:[&_+_&]:border-solid ctv:[&_+_&]:border-border-subtle"
              >
                <div class="ctv:text-2xs">
                  <span class="ctv:font-mono ctv:text-muted-foreground">.{{ w.widget_name }}</span>
                </div>
                <ComfyTVWidget
                  :kind="w.widget_type"
                  :model-value="effectiveValue(w)"
                  :options="comboOptions(w)"
                  :min="numProp(w, 'min')"
                  :max="numProp(w, 'max')"
                  :step="numProp(w, 'step')"
                  :precision="numProp(w, 'precision')"
                  :multiline="!!w.widget_props?.multiline"
                  :disabled="isStageBound(w)"
                  @update:model-value="onValueChange(w, $event)"
                />
                <div class="ctv:grid ctv:grid-cols-[60px_1fr] ctv:items-center ctv:gap-1.5 ctv:mt-0.5">
                  <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('configSidebar.bindTo') }}</span>
                  <ComfyTVSelect
                    :model-value="dropdownValueFor(w)"
                    :options="bindingOptions"
                    @update:model-value="onBindingChange(w, $event as string)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-else class="ctv:p-2 ctv:text-xs ctv:text-left ctv:italic ctv:text-muted-foreground/60">
        {{ $t('configSidebar.noExposedWidgets') }}
      </div>

      <section v-if="config.description">
        <h3 :class="sectionHeading">{{ $t('configSidebar.section.description') }}</h3>
        <p class="ctv:m-0 ctv:text-xs ctv:whitespace-pre-wrap ctv:text-muted-foreground">{{ config.description }}</p>
      </section>

      <div class="ctv:mt-4 ctv:pt-2.5 ctv:pb-3.5 ctv:px-3 ctv:flex ctv:flex-col ctv:gap-1 ctv:border-t ctv:border-border-subtle">
        <button
          :class="exportBtn"
          :disabled="!config.has_api || exportBusy"
          :title="$t('configSidebar.exportPresetTooltip')"
          @click="onExportPreset"
        >⇩ {{ $t('configSidebar.exportPreset') }}</button>
        <button
          :class="resetBtn"
          :disabled="resetBusy"
          :title="$t('configSidebar.resetToPresetTooltip')"
          @click="onResetToPreset"
        >{{ $t('configSidebar.resetToPreset') }}</button>
        <span v-if="exportError" class="ctv:text-xs ctv:text-destructive-background">{{ exportError }}</span>
        <span v-if="resetError" class="ctv:text-xs ctv:text-destructive-background">{{ resetError }}</span>
      </div>
    </div>

    <div v-else :class="emptyClass">{{ $t('configSidebar.loading') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ComfyTVWidget from '@/components/widgets/ComfyTVWidget.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import { useBindingWriter } from '@/composables/sidebar/useBindingWriter'
import { useCollapsedFlag, useCollapsedNodeIds } from '@/composables/sidebar/useCollapsedState'
import { useWorkflowConfig } from '@/composables/sidebar/useWorkflowConfig'
import {
  buildBindingOptions,
  loadCaps,
  type ExposedWidget,
  type NodeBlock,
} from '@/composables/sidebar/workflowConfigCatalog'
import { useSelectionStore } from '@/stores/selectionStore'

const { t } = useI18n()

const selection = useSelectionStore()
const selected  = computed(() => selection.selected)

const {
  config, loadError,
  exportBusy, exportError,
  resetBusy,  resetError,
  loadConfig,
  onExportPreset,
  onResetToPreset,
  postBinding,
  deleteBinding,
} = useWorkflowConfig(t)

const workflowId = computed(() => config.value?.id ?? null)
const { isCollapsed, toggle: toggleCollapsed } = useCollapsedNodeIds(workflowId)
const { collapsed: notesCollapsed, toggle: toggleNotesCollapsed } =
  useCollapsedFlag(workflowId, 'comfytv:sidebar:notes-collapsed:')

const bindingOptions = computed(() =>
  buildBindingOptions(
    config.value?.exposed_widgets ?? [],
    selection.selected?.workflowKind,
  ),
)

const groupedWidgets = computed(() => {
  const groups: Array<{ title: string | null; nodes: NodeBlock[] }> = []
  const groupIdx = new Map<string, number>()
  const nodeIdx  = new Map<string, number>()   // key: `${groupIdx}/${node_id}`
  for (const w of config.value?.exposed_widgets ?? []) {
    const gkey = w.group_title ?? ''
    let gi = groupIdx.get(gkey)
    if (gi === undefined) {
      gi = groups.length
      groupIdx.set(gkey, gi)
      groups.push({ title: w.group_title, nodes: [] })
    }
    const nkey = `${gi}/${w.node_id}`
    let ni = nodeIdx.get(nkey)
    if (ni === undefined) {
      ni = groups[gi].nodes.length
      nodeIdx.set(nkey, ni)
      groups[gi].nodes.push({
        node_id:    w.node_id,
        node_title: w.node_title,
        node_type:  w.node_type,
        widgets:    [],
      })
    }
    groups[gi].nodes[ni].widgets.push(w)
  }
  return groups
})

const {
  isStageBound,
  dropdownValueFor,
  effectiveValue,
  comboOptions,
  numProp,
  onValueChange,
  onBindingChange,
} = useBindingWriter(postBinding, deleteBinding)

function boundCountFor(node: NodeBlock): number {
  return node.widgets.filter(w => isStageBound(w) || w.stage_binding?.startsWith('literal:')).length
}

watch(
  () => selection.selectedKey,
  () => {
    const sel = selection.selected
    if (!sel || !sel.workflowLabel) { config.value = null; return }
    void loadConfig(sel.workflowKind, sel.workflowLabel)
  },
  { immediate: true },
)

let _pollTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  void loadCaps()
  selection.refreshFromCanvas()
  _pollTimer = setInterval(() => selection.refreshFromCanvas(), 400)
})
onBeforeUnmount(() => {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
})

const emptyClass     = 'ctv:py-5 ctv:px-1.5 ctv:text-center ctv:italic ctv:text-xs ctv:text-muted-foreground/60'
const sectionHeading = 'ctv:mt-1 ctv:mb-1.5 ctv:text-xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground'

const COMFY_BTN_SM = [
  'ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-1 ctv:cursor-pointer ctv:whitespace-nowrap ctv:appearance-none',
  'ctv:border-none ctv:transition-colors ctv:focus-visible:outline-none',
  'ctv:disabled:pointer-events-none ctv:disabled:opacity-50',
  'ctv:h-6 ctv:rounded-sm ctv:px-2 ctv:py-1 ctv:text-xs ctv:font-medium',
].join(' ')

const exportBtn = COMFY_BTN_SM
  + ' ctv:self-start ctv:text-secondary-foreground ctv:bg-secondary-background ctv:hover:bg-secondary-background-hover'

const resetBtn = COMFY_BTN_SM
  + ' ctv:self-start ctv:bg-transparent ctv:text-muted-foreground ctv:hover:bg-warning-background/10 ctv:hover:text-warning-background'
</script>
