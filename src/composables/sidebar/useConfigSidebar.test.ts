import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue'

const selection = reactive({
  selected: null as any,
  selectedKey: '',
  refreshFromCanvas: vi.fn(),
  bumpBindings: vi.fn(),
})
vi.mock('@/stores/selectionStore', () => ({
  useSelectionStore: () => selection,
}))

const loadCaps = vi.fn(async (..._a: unknown[]) => {})
vi.mock('./workflowConfigCatalog', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>()
  return { ...orig, loadCaps: (...a: any[]) => loadCaps(...a) }
})

import type { ConfigPayload } from './workflowConfigCatalog'
import {
  boundWidgetCount,
  useNodeFilter,
  useResultMeta,
  useSelectionConfigSync,
} from './useConfigSidebar'

const t = (key: string, args?: Record<string, unknown>) =>
  args ? `${key}:${JSON.stringify(args)}` : key

function makeConfig(over: Partial<ConfigPayload> = {}): ConfigPayload {
  return {
    id: 1,
    kind: 'image',
    label: 'X',
    has_api: true,
    description: null,
    gui_notes: [],
    exposed_widgets: [],
    ...over,
  }
}

function widget(over: Record<string, unknown> = {}) {
  return {
    node_id: '1',
    node_title: 'KSampler',
    node_type: 'KSampler',
    group_title: null,
    widget_name: 'seed',
    widget_type: 'number',
    widget_props: {},
    current_value: 0,
    stage_binding: null,
    override_value: null,
    cast: null,
    ...over,
  } as any
}

let unmounts: Array<() => void> = []

function withSetup<T>(fn: () => T): T {
  let result!: T
  const app = createApp(defineComponent({
    setup() {
      result = fn()
      return () => h('div')
    },
  }))
  app.mount(document.createElement('div'))
  unmounts.push(() => app.unmount())
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
  selection.selected = null
  selection.selectedKey = ''
})

afterEach(() => {
  unmounts.forEach(fn => fn())
  unmounts = []
  vi.useRealTimers()
})

describe('useResultMeta', () => {
  it('derives auto model and options when no result node is set', () => {
    const config = ref<ConfigPayload | null>(makeConfig({
      gui_nodes: [{ id: '3', type: 'SaveImage' }],
    }))
    const meta = useResultMeta(config, vi.fn(), t)
    expect(meta.hasResultNode.value).toBe(false)
    expect(meta.resultNodeModel.value).toBe('__AUTO__')
    expect(meta.resultNodeOptions.value[0].value).toBe('__AUTO__')
    expect(meta.resultNodeOptions.value.some(o => o.value === '3')).toBe(true)
  })

  it('restricts result types by kind and keeps an unknown stored type first', () => {
    const config = ref<ConfigPayload | null>(makeConfig({ kind: 'text', result_type: 'weird' }))
    const meta = useResultMeta(config, vi.fn(), t)
    expect(meta.resultTypeOptions.value.map(o => o.value))
      .toEqual(['weird', 'graph_output_first'])
    expect(meta.resultTypeOptions.value[1].label).toBe('configSidebar.resultType.text')
  })

  it('falls back to the first allowed result type', () => {
    const config = ref<ConfigPayload | null>(makeConfig({ kind: 'image' }))
    const meta = useResultMeta(config, vi.fn(), t)
    expect(meta.resultType.value).toBe('ui_save_batch')
  })

  it('onResultNodeChange posts null meta for the auto option', () => {
    const postMeta = vi.fn(async () => {})
    const config = ref<ConfigPayload | null>(makeConfig())
    const meta = useResultMeta(config, postMeta, t)
    meta.onResultNodeChange('__AUTO__')
    expect(postMeta).toHaveBeenCalledWith({ result_node: null, result_type: null })
  })

  it('onResultNodeChange posts the node with the current type', () => {
    const postMeta = vi.fn(async () => {})
    const config = ref<ConfigPayload | null>(makeConfig({ kind: 'video' }))
    const meta = useResultMeta(config, postMeta, t)
    meta.onResultNodeChange('5')
    expect(postMeta).toHaveBeenCalledWith({ result_node: '5', result_type: 'ui_save_url' })
  })

  it('onResultTypeChange is guarded until a node is selected', () => {
    const postMeta = vi.fn(async () => {})
    const config = ref<ConfigPayload | null>(makeConfig())
    const meta = useResultMeta(config, postMeta, t)
    meta.onResultTypeChange('ui_save_url')
    expect(postMeta).not.toHaveBeenCalled()
    config.value = makeConfig({ result_node: '5' })
    meta.onResultTypeChange('ui_save_url')
    expect(postMeta).toHaveBeenCalledWith({ result_node: '5', result_type: 'ui_save_url' })
  })
})

describe('useNodeFilter', () => {
  const widgets = [
    widget({ node_id: '1', node_title: 'KSampler', group_title: null }),
    widget({ node_id: '2', node_title: 'CLIPTextEncode', node_type: 'CLIPTextEncode', widget_name: 'text', group_title: 'Prompts' }),
    widget({ node_id: '3', node_title: 'CLIPTextEncode', node_type: 'CLIPTextEncode', widget_name: 'text', group_title: 'Prompts' }),
  ]

  it('exposes counts, chips and group visibility', () => {
    const config = ref<ConfigPayload | null>(makeConfig({ exposed_widgets: widgets }))
    const f = useNodeFilter(config, ref(1), t)
    expect(f.totalNodeCount.value).toBe(3)
    expect(f.showNodeFilter.value).toBe(true)
    expect(f.groupChips.value).toEqual([
      { key: '', label: 'configSidebar.groupUngrouped', count: 1 },
      { key: 'Prompts', label: 'Prompts', count: 2 },
    ])
    expect(f.visibleGroups.value).toHaveLength(2)
  })

  it('filters by search query and group chip', () => {
    const config = ref<ConfigPayload | null>(makeConfig({ exposed_widgets: widgets }))
    const f = useNodeFilter(config, ref(1), t)
    f.searchQuery.value = 'ksampler'
    expect(f.visibleGroups.value).toHaveLength(1)
    expect(f.visibleGroups.value[0].nodes[0].node_title).toBe('KSampler')
    f.searchQuery.value = ''
    f.groupFilter.value = 'Prompts'
    expect(f.visibleGroups.value).toHaveLength(1)
    expect(f.visibleGroups.value[0].title).toBe('Prompts')
  })

  it('hides the filter for small ungrouped workflows', () => {
    const config = ref<ConfigPayload | null>(makeConfig({ exposed_widgets: [widgets[0]] }))
    const f = useNodeFilter(config, ref(1), t)
    expect(f.showNodeFilter.value).toBe(false)
  })

  it('resets the query and group when the workflow changes', async () => {
    const config = ref<ConfigPayload | null>(makeConfig({ exposed_widgets: widgets }))
    const workflowId = ref<number | null>(1)
    const f = useNodeFilter(config, workflowId, t)
    f.searchQuery.value = 'clip'
    f.groupFilter.value = 'Prompts'
    workflowId.value = 2
    await nextTick()
    expect(f.searchQuery.value).toBe('')
    expect(f.groupFilter.value).toBe('__ALL__')
  })
})

describe('boundWidgetCount', () => {
  it('counts stage-bound and literal-bound widgets only', () => {
    const node = {
      node_id: '1',
      node_title: 'N',
      node_type: 'N',
      widgets: [
        widget({ stage_binding: 'main_prompt' }),
        widget({ stage_binding: 'literal:42' }),
        widget({ stage_binding: null }),
      ],
    } as any
    const isStageBound = (w: any) => w.stage_binding === 'main_prompt'
    expect(boundWidgetCount(node, isStageBound)).toBe(2)
  })
})

describe('useSelectionConfigSync', () => {
  it('loads the config when the selection points at a workflow', async () => {
    const config = ref<ConfigPayload | null>(null)
    const loadConfig = vi.fn(async () => {})
    withSetup(() => useSelectionConfigSync(config, loadConfig))
    selection.selected = { workflowKind: 'image', workflowLabel: 'X' }
    selection.selectedKey = 'node-1'
    await nextTick()
    expect(loadConfig).toHaveBeenCalledWith('image', 'X')
  })

  it('clears the config when nothing usable is selected', async () => {
    const config = ref<ConfigPayload | null>(makeConfig())
    const loadConfig = vi.fn(async () => {})
    withSetup(() => useSelectionConfigSync(config, loadConfig))
    selection.selected = null
    selection.selectedKey = 'gone'
    await nextTick()
    expect(config.value).toBeNull()
    expect(loadConfig).not.toHaveBeenCalled()
  })

  it('exposes the selected computed', () => {
    selection.selected = { workflowKind: 'video', workflowLabel: 'Y' }
    const { selected } = withSetup(() =>
      useSelectionConfigSync(ref<ConfigPayload | null>(null), vi.fn(async () => {})),
    )
    expect(selected.value).toEqual({ workflowKind: 'video', workflowLabel: 'Y' })
  })

  it('polls the canvas on mount and stops on unmount', async () => {
    vi.useFakeTimers()
    const config = ref<ConfigPayload | null>(null)
    withSetup(() => useSelectionConfigSync(config, vi.fn(async () => {}), 400))
    expect(loadCaps).toHaveBeenCalled()
    expect(selection.refreshFromCanvas).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1200)
    expect(selection.refreshFromCanvas).toHaveBeenCalledTimes(4)
    unmounts.forEach(fn => fn())
    unmounts = []
    vi.advanceTimersByTime(1200)
    expect(selection.refreshFromCanvas).toHaveBeenCalledTimes(4)
  })
})
