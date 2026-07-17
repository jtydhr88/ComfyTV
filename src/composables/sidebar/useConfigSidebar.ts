import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

import { useSelectionStore } from '@/stores/selectionStore'

import {
  ALL_GROUPS,
  AUTO_RESULT_NODE,
  buildResultNodeOptions,
  filterWidgetGroups,
  groupExposedWidgets,
  groupKeyOf,
  loadCaps,
  resultTypesForKind,
  type ConfigPayload,
  type ExposedWidget,
  type NodeBlock,
} from './workflowConfigCatalog'

type TFn = (key: string, args?: Record<string, unknown>) => string

const RESULT_TYPE_LABEL_KEY: Record<string, string> = {
  graph_output_first: 'configSidebar.resultType.text',
  ui_save_url:        'configSidebar.resultType.file',
  ui_save_batch:      'configSidebar.resultType.batch',
}

export function useResultMeta(
  config: Ref<ConfigPayload | null>,
  postMeta: (payload: Record<string, unknown>) => Promise<void>,
  t: TFn,
) {
  const selectedResultNode = computed(() => config.value?.result_node ?? '')
  const hasResultNode = computed(() => !!selectedResultNode.value)
  const resultNodeModel = computed(() => selectedResultNode.value || AUTO_RESULT_NODE)

  const allowedResultTypes = computed(() => resultTypesForKind(config.value?.kind))
  const defaultResultType = computed(() => allowedResultTypes.value[0])
  const resultType = computed(() => config.value?.result_type || defaultResultType.value)

  const resultNodeOptions = computed(() =>
    buildResultNodeOptions(
      config.value?.gui_nodes,
      t('configSidebar.resultAutoDetect'),
      config.value?.kind,
      selectedResultNode.value,
    ),
  )
  const resultTypeOptions = computed(() => {
    const values = [...allowedResultTypes.value] as string[]
    const cur = config.value?.result_type
    if (cur && !values.includes(cur)) values.unshift(cur)
    return values.map(v => ({ value: v, label: t(RESULT_TYPE_LABEL_KEY[v] ?? v) }))
  })

  function onResultNodeChange(nodeId: string) {
    if (!nodeId || nodeId === AUTO_RESULT_NODE) {
      void postMeta({ result_node: null, result_type: null })
    } else {
      void postMeta({ result_node: nodeId, result_type: resultType.value })
    }
  }

  function onResultTypeChange(type: string) {
    if (!selectedResultNode.value) return
    void postMeta({ result_node: selectedResultNode.value, result_type: type })
  }

  return {
    hasResultNode,
    resultNodeModel,
    resultType,
    resultNodeOptions,
    resultTypeOptions,
    onResultNodeChange,
    onResultTypeChange,
  }
}

export function useNodeFilter(
  config: Ref<ConfigPayload | null>,
  workflowId: Ref<number | null>,
  t: TFn,
) {
  const groupedWidgets = computed(() => groupExposedWidgets(config.value?.exposed_widgets ?? []))

  const searchQuery = ref('')
  const groupFilter = ref<string>(ALL_GROUPS)

  const totalNodeCount = computed(() =>
    groupedWidgets.value.reduce((n, g) => n + g.nodes.length, 0),
  )
  const showNodeFilter = computed(() =>
    totalNodeCount.value > 3 || groupedWidgets.value.length > 1,
  )
  const groupChips = computed(() =>
    groupedWidgets.value.map(g => ({
      key:   groupKeyOf(g),
      label: g.title ?? t('configSidebar.groupUngrouped'),
      count: g.nodes.length,
    })),
  )
  const visibleGroups = computed(() =>
    filterWidgetGroups(groupedWidgets.value, searchQuery.value, groupFilter.value),
  )

  watch(workflowId, () => {
    searchQuery.value = ''
    groupFilter.value = ALL_GROUPS
  })

  return {
    searchQuery,
    groupFilter,
    totalNodeCount,
    showNodeFilter,
    groupChips,
    visibleGroups,
  }
}

export function boundWidgetCount(
  node: NodeBlock,
  isStageBound: (w: ExposedWidget) => boolean,
): number {
  return node.widgets.filter(w => isStageBound(w) || w.stage_binding?.startsWith('literal:')).length
}

export function useSelectionConfigSync(
  config: Ref<ConfigPayload | null>,
  loadConfig: (kind: string, label: string) => Promise<void>,
  pollMs = 400,
) {
  const selection = useSelectionStore()
  const selected = computed(() => selection.selected)

  watch(
    () => selection.selectedKey,
    () => {
      const sel = selection.selected
      if (!sel || !sel.workflowLabel) { config.value = null; return }
      void loadConfig(sel.workflowKind, sel.workflowLabel)
    },
    { immediate: true },
  )

  let pollTimer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    void loadCaps()
    selection.refreshFromCanvas()
    pollTimer = setInterval(() => selection.refreshFromCanvas(), pollMs)
  })
  onBeforeUnmount(() => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  })

  return { selected }
}
