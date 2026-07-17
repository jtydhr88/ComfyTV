import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'

import { app } from '@/lib/comfyApp'

const listWorkflowOverview = vi.fn()
const rescanWorkflows = vi.fn()
const importWorkflow = vi.fn()
vi.mock('@/api', () => ({
  listWorkflowOverview: (...a: any[]) => listWorkflowOverview(...a),
  rescanWorkflows: (...a: any[]) => rescanWorkflows(...a),
  importWorkflow: (...a: any[]) => importWorkflow(...a),
}))

const addOptionEverywhere = vi.fn()
vi.mock('@/composables/stages/workflowCombo', () => ({
  addOptionEverywhere: (...a: any[]) => addOptionEverywhere(...a),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      args ? `${key}:${JSON.stringify(args)}` : key,
  }),
}))

import { WORKFLOW_API_GENERATED, emitWorkflowApiGenerated } from '@/utils/workflowEvents'

import { useStageWorkflowList, workflowFileName } from './useStageWorkflowList'

const toastAdd = vi.fn()

function overview(over: Record<string, unknown> = {}) {
  return {
    kinds: ['image', 'video'],
    workflows: [{ id: 1, label: 'A', has_api: false }],
    recent_added: [],
    ...over,
  }
}

let unmounts: Array<() => void> = []

function withSetup<T>(fn: () => T): T {
  let result!: T
  const host = createApp(defineComponent({
    setup() {
      result = fn()
      return () => h('div')
    },
  }))
  host.mount(document.createElement('div'))
  unmounts.push(() => host.unmount())
  return result
}

async function flush() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(app as any).extensionManager = { toast: { add: toastAdd } }
  listWorkflowOverview.mockResolvedValue(overview())
})

afterEach(() => {
  unmounts.forEach(fn => fn())
  unmounts = []
})

describe('workflowFileName', () => {
  it('strips directories with either separator', () => {
    expect(workflowFileName('a/b/c.json')).toBe('c.json')
    expect(workflowFileName('a\\b\\c.json')).toBe('c.json')
    expect(workflowFileName('c.json')).toBe('c.json')
  })
})

describe('useStageWorkflowList', () => {
  it('reloads immediately for the kind and reports kinds upward', async () => {
    listWorkflowOverview.mockResolvedValue(overview({
      recent_added: [
        { kind: 'image', label: 'Fresh' },
        { kind: 'video', label: 'Elsewhere' },
      ],
    }))
    const onKinds = vi.fn()
    const list = withSetup(() => useStageWorkflowList(ref('image'), () => false, onKinds))
    await flush()
    expect(listWorkflowOverview).toHaveBeenCalledWith('image')
    expect(list.rows.value).toHaveLength(1)
    expect(list.recentAdded.value).toEqual(new Set(['Fresh']))
    expect(onKinds).toHaveBeenCalledWith(['image', 'video'])
    expect(list.loading.value).toBe(false)
  })

  it('reloads when the kind changes and when the panel becomes active', async () => {
    const kind = ref('image')
    const active = ref(false)
    withSetup(() => useStageWorkflowList(kind, () => active.value, vi.fn()))
    await flush()
    expect(listWorkflowOverview).toHaveBeenCalledTimes(1)
    kind.value = 'video'
    await flush()
    expect(listWorkflowOverview).toHaveBeenCalledTimes(2)
    expect(listWorkflowOverview).toHaveBeenLastCalledWith('video')
    active.value = true
    await flush()
    expect(listWorkflowOverview).toHaveBeenCalledTimes(3)
  })

  it('surfaces reload failures as loadError', async () => {
    listWorkflowOverview.mockRejectedValue(new Error('down'))
    const list = withSetup(() => useStageWorkflowList(ref('image'), () => false, vi.fn()))
    await flush()
    expect(list.loadError.value).toBe('down')
    expect(list.loading.value).toBe(false)
  })

  it('onRescan registers found workflows and toasts a summary', async () => {
    rescanWorkflows.mockResolvedValue({
      added: [
        { kind: 'image', label: 'One' },
        { kind: 'video', label: 'Two' },
      ],
    })
    const list = withSetup(() => useStageWorkflowList(ref('image'), () => false, vi.fn()))
    await flush()
    await list.onRescan()
    expect(addOptionEverywhere).toHaveBeenCalledWith('image', 'One')
    expect(addOptionEverywhere).toHaveBeenCalledWith('video', 'Two')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'success',
      summary: 'stageManager.rescanFound:{"n":2}',
      detail: 'image/One, video/Two',
    }))
    expect(listWorkflowOverview).toHaveBeenCalledTimes(2)
    expect(list.rescanBusy.value).toBe(false)
  })

  it('onRescan toasts info when nothing new is found', async () => {
    rescanWorkflows.mockResolvedValue({ added: [] })
    const list = withSetup(() => useStageWorkflowList(ref('image'), () => false, vi.fn()))
    await flush()
    await list.onRescan()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }))
  })

  it('onRescan failure toasts an error', async () => {
    rescanWorkflows.mockRejectedValue(new Error('scan broke'))
    const list = withSetup(() => useStageWorkflowList(ref('image'), () => false, vi.fn()))
    await flush()
    await list.onRescan()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'error',
      detail: 'scan broke',
    }))
    expect(list.rescanBusy.value).toBe(false)
  })

  it('importFile rejects non-JSON without hitting the api', async () => {
    const list = withSetup(() => useStageWorkflowList(ref('image'), () => false, vi.fn()))
    await flush()
    await list.importFile(new File(['not json'], 'x.json'))
    expect(importWorkflow).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }))
    expect(list.importBusy.value).toBe(false)
  })

  it('importFile uploads valid JSON, registers the option and reloads', async () => {
    importWorkflow.mockResolvedValue({ label: 'Imported' })
    const list = withSetup(() => useStageWorkflowList(ref('image'), () => false, vi.fn()))
    await flush()
    await list.importFile(new File(['{"nodes":[]}'], 'wf.json'))
    expect(importWorkflow).toHaveBeenCalledWith('image', 'wf.json', '{"nodes":[]}')
    expect(addOptionEverywhere).toHaveBeenCalledWith('image', 'Imported')
    expect(listWorkflowOverview).toHaveBeenCalledTimes(2)
    expect(list.importBusy.value).toBe(false)
  })

  it('importFile failure toasts an error', async () => {
    importWorkflow.mockRejectedValue(new Error('denied'))
    const list = withSetup(() => useStageWorkflowList(ref('image'), () => false, vi.fn()))
    await flush()
    await list.importFile(new File(['{}'], 'wf.json'))
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'error',
      detail: 'denied',
    }))
  })

  it('marks the matching row when its API sidecar is generated', async () => {
    const list = withSetup(() => useStageWorkflowList(ref('image'), () => false, vi.fn()))
    await flush()
    emitWorkflowApiGenerated('video', 'A')
    expect(list.rows.value[0].has_api).toBe(false)
    emitWorkflowApiGenerated('image', 'A')
    expect(list.rows.value[0].has_api).toBe(true)
  })

  it('stops listening for API events after unmount', async () => {
    const list = withSetup(() => useStageWorkflowList(ref('image'), () => false, vi.fn()))
    await flush()
    unmounts.forEach(fn => fn())
    unmounts = []
    window.dispatchEvent(new CustomEvent(WORKFLOW_API_GENERATED, {
      detail: { kind: 'image', label: 'A' },
    }))
    expect(list.rows.value[0].has_api).toBe(false)
  })
})
