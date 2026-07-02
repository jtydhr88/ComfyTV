import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { app } from '@/lib/comfyApp'

import { useWorkflowConfig } from './useWorkflowConfig'

vi.mock('@/composables/stages/useWorkflowPrep', () => ({
  prepareWorkflow: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/composables/dialog/useConfirmDialog', () => ({
  askConfirm: vi.fn(async () => true),
}))

import { askConfirm } from '@/composables/dialog/useConfirmDialog'

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

    vi.mocked(askConfirm).mockResolvedValueOnce(true)

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
    vi.mocked(askConfirm).mockResolvedValueOnce(true)

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
    vi.mocked(askConfirm).mockResolvedValueOnce(false)

    const { loadConfig, onResetToPreset } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    fetchApi.mockClear()
    await onResetToPreset()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('onExportPreset is a no-op when nothing is selected / no config', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    const { onExportPreset, exportError } = useWorkflowConfig(t)
    await onExportPreset()
    expect(fetchApi).not.toHaveBeenCalled()
    expect(exportError.value).toBeNull()
  })

  it('onResetToPreset is a no-op when no config is loaded', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    const { onResetToPreset } = useWorkflowConfig(t)
    await onResetToPreset()
    expect(askConfirm).not.toHaveBeenCalled()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('onUploadApiSidecar posts the file then reloads config on success', async () => {
    const { useSelectionStore } = await import('@/stores/selectionStore')
    ;(useSelectionStore() as any).selected = { workflowKind: 'image', workflowLabel: 'X' }

    const configPayload = {
      id: 12, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({
      ok: true, label: 'X', node_count: 4, sidecar: 'X.api.json',
    }))
    fetchApi.mockResolvedValueOnce(jsonResp(configPayload))

    const realCE = document.createElement.bind(document)
    let capturedInput: any = null
    const ceSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = realCE(tag)
      if (tag === 'input') capturedInput = el
      return el
    })

    const { onUploadApiSidecar, uploadApiBusy, uploadApiError, config } = useWorkflowConfig(t)
    onUploadApiSidecar()
    ceSpy.mockRestore()

    expect(capturedInput).not.toBeNull()
    const file = new File(['{"node":1}'], 'sidecar.json', { type: 'application/json' })
    Object.defineProperty(capturedInput, 'files', { value: [file], configurable: true })
    await capturedInput.onchange()

    expect(fetchApi).toHaveBeenCalledTimes(2)
    const [path, init] = fetchApi.mock.calls[0]
    expect(path).toBe('/comfytv/workflows/api_sidecar')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.kind).toBe('image')
    expect(body.label).toBe('X')
    expect(body.content).toBe('{"node":1}')

    expect(uploadApiError.value).toBeNull()
    expect(uploadApiBusy.value).toBe(false)
    expect(config.value).toEqual(configPayload)
  })

  it('onUploadApiSidecar surfaces an error for non-JSON files', async () => {
    const { useSelectionStore } = await import('@/stores/selectionStore')
    ;(useSelectionStore() as any).selected = { workflowKind: 'image', workflowLabel: 'X' }

    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>

    const realCE = document.createElement.bind(document)
    let capturedInput: any = null
    const ceSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = realCE(tag)
      if (tag === 'input') capturedInput = el
      return el
    })

    const { onUploadApiSidecar, uploadApiError, uploadApiBusy } = useWorkflowConfig(t)
    onUploadApiSidecar()
    ceSpy.mockRestore()

    const file = new File(['not json at all'], 'sidecar.json', { type: 'application/json' })
    Object.defineProperty(capturedInput, 'files', { value: [file], configurable: true })
    await capturedInput.onchange()

    expect(fetchApi).not.toHaveBeenCalled()
    expect(uploadApiBusy.value).toBe(false)
    expect(uploadApiError.value).toContain('configSidebar.uploadApiFailed')
  })

  it('onUploadApiSidecar is a no-op with no selection', () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    const ceSpy = vi.spyOn(document, 'createElement')
    const { onUploadApiSidecar } = useWorkflowConfig(t)
    onUploadApiSidecar()
    expect(ceSpy).not.toHaveBeenCalled()
    expect(fetchApi).not.toHaveBeenCalled()
    ceSpy.mockRestore()
  })

  it('onUnlink unlinks the workflow and clears config on success', async () => {
    const payload = {
      id: 21, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true, kind: 'image', label: 'X' }))
    vi.mocked(askConfirm).mockResolvedValueOnce(true)

    const { loadConfig, onUnlink, config, unlinkError, unlinkBusy } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    await onUnlink()

    const [path, init] = fetchApi.mock.calls[1]
    expect(path).toBe('/comfytv/workflows/21/unlink')
    expect(init.method).toBe('POST')
    expect(config.value).toBeNull()
    expect(unlinkError.value).toBeNull()
    expect(unlinkBusy.value).toBe(false)
  })

  it('onUnlink bails when the user cancels the confirm', async () => {
    const payload = {
      id: 21, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    vi.mocked(askConfirm).mockResolvedValueOnce(false)

    const { loadConfig, onUnlink, config } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    fetchApi.mockClear()
    await onUnlink()
    expect(fetchApi).not.toHaveBeenCalled()
    expect(config.value).toEqual(payload)
  })

  it('onUnlink surfaces an error and keeps config on failure', async () => {
    const payload = {
      id: 21, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    fetchApi.mockResolvedValueOnce(jsonResp({ error: 'in use' }, 500))
    vi.mocked(askConfirm).mockResolvedValueOnce(true)

    const { loadConfig, onUnlink, config, unlinkError, unlinkBusy } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    await onUnlink()

    expect(unlinkBusy.value).toBe(false)
    expect(unlinkError.value).toContain('configSidebar.unlinkFailed')
    expect(config.value).toEqual(payload)
  })

  it('onUnlink is a no-op when no config is loaded', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    const { onUnlink } = useWorkflowConfig(t)
    await onUnlink()
    expect(askConfirm).not.toHaveBeenCalled()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('postMeta sends workflow_id + payload then reloads config', async () => {
    const payloadV1 = {
      id: 33, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const payloadV2 = { ...payloadV1, description: 'edited' }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payloadV1))
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true }))
    fetchApi.mockResolvedValueOnce(jsonResp(payloadV2))

    const { loadConfig, postMeta, config } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    const { useSelectionStore } = await import('@/stores/selectionStore')
    ;(useSelectionStore() as any).selected = { workflowKind: 'image', workflowLabel: 'X' }
    await postMeta({ description: 'edited' })

    const [path, init] = fetchApi.mock.calls[1]
    expect(path).toBe('/comfytv/workflows/config/meta')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.workflow_id).toBe(33)
    expect(body.description).toBe('edited')
    expect(config.value?.description).toBe('edited')
  })

  it('postMeta is a no-op before a config is loaded', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    const { postMeta } = useWorkflowConfig(t)
    await postMeta({ description: 'x' })
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('postMeta surfaces server error into loadError', async () => {
    const payload = {
      id: 33, kind: 'image', label: 'X',
      has_api: true, description: null, gui_notes: [], exposed_widgets: [],
    }
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp(payload))
    fetchApi.mockResolvedValueOnce(jsonResp({ error: 'db locked' }, 500))

    const { loadConfig, postMeta, loadError } = useWorkflowConfig(t)
    await loadConfig('image', 'X')
    await postMeta({ description: 'edited' })
    expect(loadError.value).toContain('save failed')
    expect(loadError.value).toContain('500')
  })
})
