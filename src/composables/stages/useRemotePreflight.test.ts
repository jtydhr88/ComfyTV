import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Capabilities, RemoteCapabilityProbe } from '@/api'

vi.mock('@/i18n', () => ({
  t: (key: string, args?: Record<string, unknown>) =>
    args ? `${key}:${JSON.stringify(args)}` : key,
}))

const askConfirm = vi.fn()
vi.mock('@/composables/dialog/useConfirmDialog', () => ({
  askConfirm: (...a: any[]) => askConfirm(...a),
}))

const toastAdd = vi.fn()
vi.mock('@/lib/comfyApp', () => ({
  app: { extensionManager: { toast: { add: (...a: any[]) => toastAdd(...a) } } },
}))

const serverStore = {
  byId: vi.fn(),
  loadLocalCapabilities: vi.fn(),
  probeCapabilities: vi.fn(),
}
vi.mock('@/stores/serverStore', () => ({
  useServerStore: () => serverStore,
}))

import {
  decidePreflight,
  missingNodeIds,
  useRemotePreflight,
} from './useRemotePreflight'

function caps(over: Partial<Capabilities> = {}): Capabilities {
  return {
    version: '1.8.0',
    node_ids: ['ComfyTV.VideoColorStage', 'ComfyTV.VideoLUTStage'],
    resources: {
      lut: [{ filename: 'warm.cube', sha256: 'sha-local' }],
      font: [],
    },
    resource_fields: { 'ComfyTV.VideoLUTStage': { lut_file: 'lut' } },
    ...over,
  }
}

function installed(over: Partial<Capabilities> = {}): RemoteCapabilityProbe {
  return { installed: true, capabilities: caps(over) }
}

const NOT_INSTALLED: RemoteCapabilityProbe = { installed: false, error: 'HTTP 404' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('missingNodeIds', () => {
  it('diffs local node ids against the remote list', () => {
    const local = caps({ node_ids: ['A', 'B', 'C'] })
    expect(missingNodeIds(local, installed({ node_ids: ['A'] }))).toEqual(['B', 'C'])
    expect(missingNodeIds(local, installed({ node_ids: ['A', 'B', 'C'] }))).toEqual([])
  })

  it('returns empty without local caps or an installed probe', () => {
    expect(missingNodeIds(null, installed())).toEqual([])
    expect(missingNodeIds(caps(), NOT_INSTALLED)).toEqual([])
    expect(missingNodeIds(caps(), undefined)).toEqual([])
  })
})

describe('decidePreflight', () => {
  const base = {
    serverLabel: 'rig',
    comfyClass: 'ComfyTV.VideoLUTStage',
    local: caps(),
  }

  it('blocks when the remote has no ComfyTV', () => {
    const d = decidePreflight({ ...base, probe: NOT_INSTALLED, widgetValues: {} })
    expect(d).toEqual({
      action: 'block',
      message: 'servers.preflight.noComfyTV:{"label":"rig"}',
    })
  })

  it('blocks when the remote lacks this stage node', () => {
    const d = decidePreflight({
      ...base,
      probe: installed({ node_ids: ['ComfyTV.VideoColorStage'] }),
      widgetValues: { lut_file: 'warm.cube' },
    })
    expect(d).toEqual({
      action: 'block',
      message: 'servers.preflight.missingNode:{"label":"rig","node":"ComfyTV.VideoLUTStage"}',
    })
  })

  it('warns when a referenced resource is absent on the remote', () => {
    const d = decidePreflight({
      ...base,
      probe: installed({ resources: { lut: [], font: [] } }),
      widgetValues: { lut_file: 'warm.cube' },
    })
    expect(d).toEqual({
      action: 'warn',
      messages: ['servers.preflight.missingResource:{"label":"rig","file":"warm.cube"}'],
    })
  })

  it('warns on a sha256 mismatch', () => {
    const d = decidePreflight({
      ...base,
      probe: installed({
        resources: { lut: [{ filename: 'warm.cube', sha256: 'sha-remote' }], font: [] },
      }),
      widgetValues: { lut_file: 'warm.cube' },
    })
    expect(d).toEqual({
      action: 'warn',
      messages: ['servers.preflight.resourceMismatch:{"label":"rig","file":"warm.cube"}'],
    })
  })

  it('passes when the resource matches by filename and sha', () => {
    const d = decidePreflight({
      ...base,
      probe: installed({
        resources: { lut: [{ filename: 'warm.cube', sha256: 'sha-local' }], font: [] },
      }),
      widgetValues: { lut_file: 'warm.cube' },
    })
    expect(d).toEqual({ action: 'pass' })
  })

  it('strips path prefixes from the widget value', () => {
    const d = decidePreflight({
      ...base,
      probe: installed({ resources: { lut: [], font: [] } }),
      widgetValues: { lut_file: 'sub/dir\\warm.cube' },
    })
    expect(d).toEqual({
      action: 'warn',
      messages: ['servers.preflight.missingResource:{"label":"rig","file":"warm.cube"}'],
    })
  })

  it('skips resource checks for empty or non-string widget values', () => {
    const probe = installed({ resources: { lut: [], font: [] } })
    expect(decidePreflight({ ...base, probe, widgetValues: {} }))
      .toEqual({ action: 'pass' })
    expect(decidePreflight({ ...base, probe, widgetValues: { lut_file: '  ' } }))
      .toEqual({ action: 'pass' })
    expect(decidePreflight({ ...base, probe, widgetValues: { lut_file: 42 } }))
      .toEqual({ action: 'pass' })
  })

  it('skips sha comparison when the local sha is unknown', () => {
    const d = decidePreflight({
      ...base,
      local: caps({ resources: { lut: [], font: [] } }),
      probe: installed({
        resources: { lut: [{ filename: 'warm.cube', sha256: 'sha-remote' }], font: [] },
      }),
      widgetValues: { lut_file: 'warm.cube' },
    })
    expect(d).toEqual({ action: 'pass' })
  })

  it('still blocks without local caps, but skips resource checks', () => {
    expect(decidePreflight({
      ...base, local: null, probe: NOT_INSTALLED, widgetValues: {},
    }).action).toBe('block')
    expect(decidePreflight({
      ...base,
      local: null,
      probe: installed({ resources: { lut: [], font: [] } }),
      widgetValues: { lut_file: 'warm.cube' },
    })).toEqual({ action: 'pass' })
  })
})

describe('useRemotePreflight', () => {
  const RIG = { id: 3, label: 'rig', host: '10.0.0.2', port: 8188, enabled: true }

  function setup(probe: RemoteCapabilityProbe, local: Capabilities | null = caps()) {
    serverStore.byId.mockReturnValue(RIG)
    serverStore.loadLocalCapabilities.mockResolvedValue(local)
    serverStore.probeCapabilities.mockResolvedValue(probe)
    return useRemotePreflight()
  }

  it('blocks with a toast when the remote lacks ComfyTV', async () => {
    const { ensureRemotePreflight } = setup(NOT_INSTALLED)
    const ok = await ensureRemotePreflight(3, 'ComfyTV.VideoLUTStage', {})
    expect(ok).toBe(false)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'error',
      summary: 'servers.preflight.blockedTitle',
      detail: 'servers.preflight.noComfyTV:{"label":"rig"}',
    }))
    expect(askConfirm).not.toHaveBeenCalled()
  })

  it('asks for confirmation on resource warnings and honors the answer', async () => {
    const { ensureRemotePreflight } = setup(installed({ resources: { lut: [], font: [] } }))
    askConfirm.mockResolvedValueOnce(false)
    expect(await ensureRemotePreflight(3, 'ComfyTV.VideoLUTStage', { lut_file: 'warm.cube' }))
      .toBe(false)
    askConfirm.mockResolvedValueOnce(true)
    expect(await ensureRemotePreflight(3, 'ComfyTV.VideoLUTStage', { lut_file: 'warm.cube' }))
      .toBe(true)
    expect(askConfirm).toHaveBeenCalledWith(expect.objectContaining({
      message: 'servers.preflight.missingResource:{"label":"rig","file":"warm.cube"}',
    }))
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('passes silently when everything checks out', async () => {
    const { ensureRemotePreflight } = setup(installed())
    const ok = await ensureRemotePreflight(3, 'ComfyTV.VideoLUTStage', { lut_file: 'warm.cube' })
    expect(ok).toBe(true)
    expect(askConfirm).not.toHaveBeenCalled()
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('passes through when the server is unknown to the store', async () => {
    serverStore.byId.mockReturnValue(undefined)
    const { ensureRemotePreflight } = useRemotePreflight()
    expect(await ensureRemotePreflight(99, 'ComfyTV.VideoLUTStage', {})).toBe(true)
    expect(serverStore.probeCapabilities).not.toHaveBeenCalled()
  })
})
