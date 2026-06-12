import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { app } from '@/lib/comfyApp'

import { useWorkflowConfig } from './useWorkflowConfig'

vi.mock('@/composables/stages/useWorkflowPrep', () => ({
  prepareWorkflow: vi.fn().mockResolvedValue(undefined),
}))

const jsonResp = (data: any, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json', ...headers },
  })

function t(key: string, args?: Record<string, unknown>) {
  return args ? `${key}:${JSON.stringify(args)}` : key
}

describe('useWorkflowConfig', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loadConfig stores the payload on success', async () => {
    const payload = {
      id: 7, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    ;(app as any).api.fetchApi.mockResolvedValueOnce(jsonResp(payload))
    const { config, loadError, loadConfig } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    expect(config.value).toEqual(payload)
    expect(loadError.value).toBeNull()
  })

  it('loadConfig surfaces error and nulls config on HTTP failure', async () => {
    ;(app as any).api.fetchApi.mockResolvedValueOnce(jsonResp({ error: 'nope' }, 500))
    const { config, loadError, loadConfig } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    expect(config.value).toBeNull()
    expect(loadError.value).toContain('500')
    expect(loadError.value).toContain('nope')
  })

  it('postBinding sends workflow_id + payload then notifies validator', async () => {
    const payload = {
      id: 42, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true }))

    const { loadConfig, postBinding } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    await postBinding({ node_id: '1', input_name: 'seed', from: 'option:seed' })

    expect(fetchApi).toHaveBeenCalledTimes(2)
    const [path, init] = fetchApi.mock.calls[1]
    expect(path).toBe('/comfytv/workflows/config/binding')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.workflow_id).toBe(42)
    expect(body.node_id).toBe('1')
    expect(body.input_name).toBe('seed')
  })

  it('postBinding before a config is loaded is a no-op', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    const { postBinding } = useWorkflowConfig(t)
    await postBinding({ node_id: '1', input_name: 'x', from: 'option:seed' })
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('deleteBinding uses DELETE verb with body identifying the row', async () => {
    const payload = {
      id: 99, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true }))

    const { loadConfig, deleteBinding } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    await deleteBinding('3', 'seed')

    const [path, init] = fetchApi.mock.calls[1]
    expect(path).toBe('/comfytv/workflows/config/binding')
    expect(init.method).toBe('DELETE')
    const body = JSON.parse(init.body as string)
    expect(body.workflow_id).toBe(99)
    expect(body.node_id).toBe('3')
    expect(body.input_name).toBe('seed')
  })

  it('onResetToPreset re-loads config after a successful reset', async () => {
    const payloadV1 = {
      id: 5, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const payloadV2 = { ...payloadV1, has_api: true, description: 'fresh' }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payloadV1))
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true }))
    fetchApi.mockResolvedValueOnce(jsonResp(payloadV2))

    ;(globalThis as any).confirm = () => true
    ;(globalThis as any).window = (globalThis as any).window ?? globalThis
    ;(globalThis as any).window.confirm = () => true

    const { config, loadConfig, onResetToPreset } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    const { useSelectionStore } = await import('@/stores/selectionStore')
    const sel = useSelectionStore()
    ;(sel as any).selected = { workflowKind: 'image', workflowLabel: 'X' }
    await onResetToPreset()
    await nextTick()
    expect(config.value?.description).toBe('fresh')
  })

  it('postBinding surfaces server error into loadError', async () => {
    const payload = {
      id: 1, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    fetchApi.mockResolvedValueOnce(jsonResp({ error: 'db locked' }, 500))

    const { loadError, loadConfig, postBinding } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    await postBinding({ node_id: '1', input_name: 'seed', from: 'option:seed' })
    expect(loadError.value).toContain('save failed')
    expect(loadError.value).toContain('500')
  })

  it('deleteBinding surfaces server error into loadError', async () => {
    const payload = {
      id: 1, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    fetchApi.mockResolvedValueOnce(jsonResp({ error: 'no row' }, 404))

    const { loadError, loadConfig, deleteBinding } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    await deleteBinding('3', 'seed')
    expect(loadError.value).toContain('delete failed')
    expect(loadError.value).toContain('404')
  })

  it('onExportPreset triggers a blob download with the filename from Content-Disposition', async () => {
    const payload = {
      id: 5, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    fetchApi.mockResolvedValueOnce(new Response('{"preset": 1}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-disposition': 'attachment; filename="local-sd15_preset.json"',
      },
    }))

    const { useSelectionStore } = await import('@/stores/selectionStore')
    ;(useSelectionStore() as any).selected = { workflowKind: 'image', workflowLabel: 'X' }

    const created: string[] = []
    ;(URL as any).createObjectURL = vi.fn(() => { const u = `blob:${Math.random()}`; created.push(u); return u })
    ;(URL as any).revokeObjectURL = vi.fn()
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const clickedFilenames: string[] = []
    const realCreateElement = document.createElement.bind(document)
    const ceSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = realCreateElement(tag)
      if (tag === 'a') {
        ;(el as any).click = () => clickedFilenames.push((el as HTMLAnchorElement).download)
      }
      return el
    })

    const { config, loadConfig, onExportPreset, exportError } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    expect(config.value).toEqual(payload)
    await onExportPreset()

    expect(exportError.value).toBeNull()
    expect(clickedFilenames).toEqual(['local-sd15_preset.json'])
    expect(appendSpy).toHaveBeenCalled()
    ceSpy.mockRestore()
  })

  it('onExportPreset surfaces error when the preset endpoint fails', async () => {
    const payload = {
      id: 9, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    fetchApi.mockResolvedValueOnce(jsonResp({ error: 'no preset on disk' }, 404))

    const { useSelectionStore } = await import('@/stores/selectionStore')
    ;(useSelectionStore() as any).selected = { workflowKind: 'image', workflowLabel: 'X' }

    const { loadConfig, onExportPreset, exportError, exportBusy } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    await onExportPreset()
    expect(exportBusy.value).toBe(false)
    expect(exportError.value).toContain('configSidebar.exportPresetFailed')
    expect(exportError.value).toContain('404')
  })

  it('onResetToPreset surfaces error from the reset endpoint', async () => {
    const payload = {
      id: 9, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    fetchApi.mockResolvedValueOnce(jsonResp({ error: 'missing preset row' }, 500))
    ;(globalThis as any).window = (globalThis as any).window ?? globalThis
    ;(globalThis as any).window.confirm = () => true

    const { loadConfig, onResetToPreset, resetError, resetBusy } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    await onResetToPreset()
    expect(resetBusy.value).toBe(false)
    expect(resetError.value).toContain('configSidebar.resetToPresetFailed')
  })

  it('onResetToPreset bails when the user cancels the confirm', async () => {
    const payload = {
      id: 5, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    ;(globalThis as any).window = (globalThis as any).window ?? globalThis
    ;(globalThis as any).window.confirm = () => false

    const { loadConfig, onResetToPreset } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    fetchApi.mockClear()
    await onResetToPreset()
    expect(fetchApi).not.toHaveBeenCalled()
  })
})
