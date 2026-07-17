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

      <section v-if="isLinked"
               class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:py-1.5 ctv:px-2 ctv:rounded"
               :class="linkBroken
                 ? 'ctv:bg-destructive-background/10 ctv:border ctv:border-destructive-background/40'
                 : 'ctv:bg-primary-background/[0.06] ctv:border ctv:border-primary-background/25'">
        <div class="ctv:flex ctv:items-center ctv:gap-1.5">
          <i :class="['pi', linkBroken ? 'pi-exclamation-triangle' : 'pi-link',
                      'ctv:text-2xs', linkBroken ? 'ctv:text-destructive-background' : 'ctv:text-primary-foreground']" />
          <span class="ctv:text-2xs ctv:font-semibold"
                :class="linkBroken ? 'ctv:text-destructive-background' : 'ctv:text-base-foreground'">
            {{ linkBroken ? $t('configSidebar.linkBroken') : $t('configSidebar.linkedSource') }}
          </span>
        </div>
        <p class="ctv:m-0 ctv:text-3xs ctv:leading-relaxed ctv:text-muted-foreground ctv:break-all">
          {{ linkBroken ? $t('configSidebar.linkBrokenHint') : $t('configSidebar.linkedSourceHint') }}
        </p>
        <button
          :class="resetBtn"
          :disabled="unlinkBusy"
          @click="onUnlink"
        ><i class="pi pi-link" /> {{ $t('configSidebar.unlink') }}</button>
        <span v-if="unlinkError" class="ctv:text-3xs ctv:text-destructive-background">{{ unlinkError }}</span>
      </section>

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
          <i :class="['pi', notesCollapsed ? 'pi-chevron-right' : 'pi-chevron-down', 'ctv:w-2.5 ctv:text-2xs ctv:text-warning-background/75']" />
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

        <div v-if="showNodeFilter" class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:mb-2.5">
          <div class="ctv:relative">
            <IconSearch
              class="ctv:absolute ctv:left-2 ctv:top-1/2 ctv:-translate-y-1/2 ctv:size-3.5
                     ctv:text-muted-foreground ctv:pointer-events-none"
            />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="$t('configSidebar.searchNodes')"
              class="ctv:w-full ctv:h-7 ctv:box-border ctv:pl-7 ctv:pr-2 ctv:rounded-lg ctv:text-xs ctv:[font-family:inherit]
                     ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
                     ctv:placeholder:text-muted-foreground ctv:focus-visible:outline-none ctv:focus:border-border-default"
            />
          </div>
          <div v-if="groupChips.length > 1" class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1">
            <button
              :class="chipClass(groupFilter === ALL_GROUPS)"
              @click="groupFilter = ALL_GROUPS"
            >
              {{ $t('configSidebar.groupAll') }}
              <span :class="chipCountClass">{{ totalNodeCount }}</span>
            </button>
            <button
              v-for="chip in groupChips"
              :key="chip.key"
              :class="chipClass(groupFilter === chip.key)"
              @click="groupFilter = groupFilter === chip.key ? ALL_GROUPS : chip.key"
            >
              {{ chip.label }}
              <span :class="chipCountClass">{{ chip.count }}</span>
            </button>
          </div>
        </div>

        <div v-if="!visibleGroups.length" :class="emptyClass">
          {{ $t('configSidebar.noMatchingNodes') }}
        </div>

        <div v-for="(grp, gi) in visibleGroups" :key="gi"
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
              :aria-expanded="!isNodeCollapsed(node.node_id)"
              @click="toggleCollapsed(node.node_id)"
            >
              <i :class="['pi', isNodeCollapsed(node.node_id) ? 'pi-chevron-right' : 'pi-chevron-down', 'ctv:w-2.5 ctv:text-2xs ctv:text-muted-foreground']" />
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

            <div v-if="!isNodeCollapsed(node.node_id)" class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:p-2">
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

      <div v-else class="ctv:p-2 ctv:text-xs ctv:text-left ctv:flex ctv:flex-col ctv:gap-2">
        <p class="ctv:m-0 ctv:italic ctv:text-muted-foreground/60">
          {{ $t('configSidebar.noExposedWidgets') }}
        </p>
        <template v-if="config && !config.has_api">
          <p class="ctv:m-0 ctv:text-muted-foreground/80">
            {{ $t('configSidebar.conversionMayHaveFailed') }}
          </p>
          <button
            :class="exportBtn"
            :disabled="uploadApiBusy"
            :title="$t('configSidebar.uploadApiTooltip')"
            @click="onUploadApiSidecar"
          ><i class="pi pi-upload" /> {{ $t('configSidebar.uploadApi') }}</button>
          <span v-if="uploadApiError" class="ctv:text-destructive-background">{{ uploadApiError }}</span>
        </template>
      </div>

      <section v-if="config.has_api">
        <h3 :class="sectionHeading">{{ $t('configSidebar.section.result') }}</h3>
        <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:px-1">
          <div class="ctv:grid ctv:grid-cols-[42px_1fr] ctv:items-center ctv:gap-1.5">
            <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('configSidebar.resultNode') }}</span>
            <ComfyTVSelect
              :model-value="resultNodeModel"
              :options="resultNodeOptions"
              @update:model-value="onResultNodeChange($event as string)"
            />
          </div>
          <div v-if="hasResultNode && resultTypeOptions.length > 1" class="ctv:grid ctv:grid-cols-[42px_1fr] ctv:items-center ctv:gap-1.5">
            <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('configSidebar.resultType.label') }}</span>
            <ComfyTVSelect
              :model-value="resultType"
              :options="resultTypeOptions"
              @update:model-value="onResultTypeChange($event as string)"
            />
          </div>
          <p class="ctv:m-0 ctv:text-2xs ctv:italic ctv:text-muted-foreground/60">
            {{ hasResultNode ? $t('configSidebar.resultHintSet') : $t('configSidebar.resultHintAuto') }}
          </p>
        </div>
      </section>

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
        ><i class="pi pi-download" /> {{ $t('configSidebar.exportPreset') }}</button>
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import IconSearch from '~icons/lucide/search'

import ComfyTVWidget from '@/components/widgets/ComfyTVWidget.vue'
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import { useBindingWriter } from '@/composables/sidebar/useBindingWriter'
import { useCollapsedFlag, useCollapsedNodeIds } from '@/composables/sidebar/useCollapsedState'
import {
  boundWidgetCount,
  useNodeFilter,
  useResultMeta,
  useSelectionConfigSync,
} from '@/composables/sidebar/useConfigSidebar'
import { useWorkflowConfig } from '@/composables/sidebar/useWorkflowConfig'
import { LINK_TYPE_NATIVE } from '@/api'
import {
  ALL_GROUPS,
  buildBindingOptions,
  type NodeBlock,
} from '@/composables/sidebar/workflowConfigCatalog'

const { t } = useI18n()

const {
  config, loadError,
  exportBusy, exportError,
  resetBusy,  resetError,
  uploadApiBusy, uploadApiError,
  unlinkBusy, unlinkError,
  loadConfig,
  onExportPreset,
  onResetToPreset,
  onUploadApiSidecar,
  onUnlink,
  postBinding,
  deleteBinding,
  postMeta,
} = useWorkflowConfig(t)

const { selected } = useSelectionConfigSync(config, loadConfig)

const isLinked   = computed(() => config.value?.link_type === LINK_TYPE_NATIVE)
const linkBroken = computed(() => isLinked.value && config.value?.file_exists === false)

const {
  hasResultNode,
  resultNodeModel,
  resultType,
  resultNodeOptions,
  resultTypeOptions,
  onResultNodeChange,
  onResultTypeChange,
} = useResultMeta(config, postMeta, t)

const workflowId = computed(() => config.value?.id ?? null)
const { isCollapsed, toggle: toggleCollapsed } = useCollapsedNodeIds(workflowId)
const { collapsed: notesCollapsed, toggle: toggleNotesCollapsed } =
  useCollapsedFlag(workflowId, 'comfytv:sidebar:notes-collapsed:')

const bindingOptions = computed(() =>
  buildBindingOptions(
    config.value?.exposed_widgets ?? [],
    selected.value?.workflowKind,
  ),
)

const {
  searchQuery,
  groupFilter,
  totalNodeCount,
  showNodeFilter,
  groupChips,
  visibleGroups,
} = useNodeFilter(config, workflowId, t)

function isNodeCollapsed(nodeId: string): boolean {
  if (searchQuery.value.trim()) return false
  return isCollapsed(nodeId)
}

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
  return boundWidgetCount(node, isStageBound)
}

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

function chipClass(active: boolean) {
  return [
    'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:[font-family:inherit]',
    'ctv:rounded-lg ctv:border ctv:px-2 ctv:py-0.5 ctv:text-2xs ctv:transition-colors',
    active
      ? 'ctv:bg-secondary-background-selected ctv:border-primary-background/60 ctv:text-base-foreground'
      : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground',
  ].join(' ')
}

const chipCountClass = 'ctv:py-0 ctv:px-1 ctv:rounded-lg ctv:text-3xs ctv:bg-base-foreground/10'
</script>
