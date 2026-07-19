import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'

const release = vi.fn()
const store = {
  servers: [] as any[],
  localCapabilities: null as any,
  statusFor: vi.fn(),
  load: vi.fn(async () => {}),
  loadLocalCapabilities: vi.fn(async () => null),
  subscribeStatus: vi.fn(() => release),
  create: vi.fn(async (p: any) => ({ id: 1, enabled: true, ...p })),
  update: vi.fn(async (id: number, p: any) => ({ id, ...p })),
  remove: vi.fn(async () => true),
  testConnection: vi.fn(async () => ({ ok: true, version: 'v1' })),
  capabilityProbeFor: vi.fn(),
  probeCapabilities: vi.fn(async () => ({ installed: false, error: 'x' })),
}
vi.mock('@/stores/serverStore', () => ({ useServerStore: () => store }))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      args ? `${key}:${JSON.stringify(args)}` : key,
  }),
}))

vi.mock('@/i18n', () => ({
  t: (key: string, args?: Record<string, unknown>) =>
    args ? `${key}:${JSON.stringify(args)}` : key,
}))

const fetchRemoteCapabilities = vi.fn(
  async (..._a: any[]): Promise<any> => ({ installed: false, error: 'x' }))
vi.mock('@/api', () => ({
  fetchRemoteCapabilities: (...a: any[]) => fetchRemoteCapabilities(...a),
}))

const askConfirm = vi.fn(async (..._a: unknown[]) => true)
vi.mock('@/composables/dialog/useConfirmDialog', () => ({
  askConfirm: (...a: any[]) => askConfirm(...a),
}))

import { useServersPanel } from './useServersPanel'

function probeInstalled(over: Record<string, unknown> = {}) {
  return {
    installed: true as const,
    capabilities: {
      version: '1.8.0',
      node_ids: ['A', 'B'],
      resources: { lut: [], font: [] },
      resource_fields: {},
      ...over,
    },
  }
}

function server(over: Record<string, unknown> = {}) {
  return { id: 7, label: 'Box', host: '10.0.0.2', port: 8188, enabled: true, ...over } as any
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
})

afterEach(() => {
  unmounts.forEach(fn => fn())
  unmounts = []
})

describe('useServersPanel', () => {
  it('loads servers and subscribes to status on mount, releases on unmount', () => {
    withSetup(() => useServersPanel())
    expect(store.load).toHaveBeenCalled()
    expect(store.subscribeStatus).toHaveBeenCalled()
    unmounts.forEach(fn => fn())
    unmounts = []
    expect(release).toHaveBeenCalled()
  })

  it('openForm creates a blank draft or prefills from a server', () => {
    const p = withSetup(() => useServersPanel())
    p.openForm()
    expect(p.form.value).toEqual({ id: null, label: '', host: '', port: '8188' })
    p.openForm(server())
    expect(p.form.value).toEqual({ id: 7, label: 'Box', host: '10.0.0.2', port: '8188' })
  })

  it('formValid requires label, host and a sane port', () => {
    const p = withSetup(() => useServersPanel())
    expect(p.formValid.value).toBe(false)
    p.openForm()
    expect(p.formValid.value).toBe(false)
    p.form.value!.label = 'A'
    p.form.value!.host = 'h'
    expect(p.formValid.value).toBe(true)
    p.form.value!.port = '0'
    expect(p.formValid.value).toBe(false)
    p.form.value!.port = '70000'
    expect(p.formValid.value).toBe(false)
    p.form.value!.port = '1.5'
    expect(p.formValid.value).toBe(false)
  })

  it('onTestForm trims the host and stores the result', async () => {
    const p = withSetup(() => useServersPanel())
    p.openForm()
    p.form.value!.label = 'A'
    p.form.value!.host = ' 10.0.0.2 '
    await p.onTestForm()
    expect(store.testConnection).toHaveBeenCalledWith('10.0.0.2', 8188)
    expect(p.formTest.value).toEqual({ ok: true, version: 'v1' })
    expect(p.testing.value).toBe(false)
  })

  it('onTestRow records per-row results and clears the busy id', async () => {
    const p = withSetup(() => useServersPanel())
    await p.onTestRow(server())
    expect(store.testConnection).toHaveBeenCalledWith('10.0.0.2', 8188)
    expect(p.rowTests[7]).toEqual({ ok: true, version: 'v1' })
    expect(p.testingId.value).toBeNull()
  })

  it('onSave creates for a new form and closes it on success', async () => {
    const p = withSetup(() => useServersPanel())
    p.openForm()
    p.form.value!.label = ' A '
    p.form.value!.host = ' h '
    await p.onSave()
    expect(store.create).toHaveBeenCalledWith({ label: 'A', host: 'h', port: 8188 })
    expect(store.update).not.toHaveBeenCalled()
    expect(p.form.value).toBeNull()
  })

  it('onSave updates an existing server', async () => {
    const p = withSetup(() => useServersPanel())
    p.openForm(server())
    p.form.value!.label = 'Renamed'
    await p.onSave()
    expect(store.update).toHaveBeenCalledWith(7, { label: 'Renamed', host: '10.0.0.2', port: 8188 })
  })

  it('onSave surfaces a failure without closing the form', async () => {
    store.create.mockResolvedValueOnce(null)
    const p = withSetup(() => useServersPanel())
    p.openForm()
    p.form.value!.label = 'A'
    p.form.value!.host = 'h'
    await p.onSave()
    expect(p.form.value).not.toBeNull()
    expect(p.formError.value).toBe('servers.form.saveFailed')
  })

  it('onToggle flips the enabled flag', async () => {
    const p = withSetup(() => useServersPanel())
    await p.onToggle(server({ enabled: true }))
    expect(store.update).toHaveBeenCalledWith(7, { enabled: false })
  })

  it('onDelete removes only after confirmation', async () => {
    const p = withSetup(() => useServersPanel())
    askConfirm.mockResolvedValueOnce(false)
    await p.onDelete(server())
    expect(store.remove).not.toHaveBeenCalled()
    await p.onDelete(server())
    expect(store.remove).toHaveBeenCalledWith(7)
  })

  it('statusKind maps store status to a semantic level', () => {
    const p = withSetup(() => useServersPanel())
    store.statusFor.mockReturnValueOnce(undefined)
    expect(p.statusKind(server())).toBe('unknown')
    store.statusFor.mockReturnValueOnce({ online: false, running: 0, pending: 0 })
    expect(p.statusKind(server())).toBe('offline')
    store.statusFor.mockReturnValueOnce({ online: true, running: 1, pending: 0 })
    expect(p.statusKind(server())).toBe('busy')
    store.statusFor.mockReturnValueOnce({ online: true, running: 0, pending: 0 })
    expect(p.statusKind(server())).toBe('idle')
  })

  it('statusBadge shows the queue total only when busy', () => {
    const p = withSetup(() => useServersPanel())
    store.statusFor.mockReturnValueOnce({ online: true, running: 1, pending: 2 })
    expect(p.statusBadge(server())).toBe('servers.status.queueShort:{"n":3}')
    store.statusFor.mockReturnValueOnce({ online: true, running: 0, pending: 0 })
    expect(p.statusBadge(server())).toBe('')
    store.statusFor.mockReturnValueOnce({ online: false, running: 5, pending: 0 })
    expect(p.statusBadge(server())).toBe('')
  })

  it('mount kicks off the local capabilities fetch', () => {
    withSetup(() => useServersPanel())
    expect(store.loadLocalCapabilities).toHaveBeenCalled()
  })

  it('onTestRow force-probes remote capabilities', async () => {
    const p = withSetup(() => useServersPanel())
    await p.onTestRow(server())
    expect(store.probeCapabilities).toHaveBeenCalledWith(7, true)
  })

  it('onTestForm probes the drafted origin directly', async () => {
    const p = withSetup(() => useServersPanel())
    p.openForm()
    p.form.value!.label = 'A'
    p.form.value!.host = ' 10.0.0.2 '
    fetchRemoteCapabilities.mockResolvedValueOnce(probeInstalled())
    await p.onTestForm()
    expect(fetchRemoteCapabilities).toHaveBeenCalledWith('http://10.0.0.2:8188')
    expect(p.formCaps.value).toEqual(probeInstalled())
    expect(p.formCapsInfo.value).toEqual({
      kind: 'comfytv',
      label: 'servers.caps.badge:{"version":"1.8.0"}',
      missing: [],
    })
    p.closeForm()
    expect(p.formCaps.value).toBeNull()
  })

  it('capsInfo is null before any probe', () => {
    const p = withSetup(() => useServersPanel())
    store.capabilityProbeFor.mockReturnValue(undefined)
    expect(p.capsInfo(server())).toBeNull()
  })

  it('capsInfo reports ComfyUI-only after a failed probe with a good ping', () => {
    const p = withSetup(() => useServersPanel())
    store.capabilityProbeFor.mockReturnValue({ installed: false, error: 'HTTP 404' })
    store.statusFor.mockReturnValue(undefined)
    expect(p.capsInfo(server())).toBeNull()
    p.rowTests[7] = { ok: true }
    expect(p.capsInfo(server())).toEqual({
      kind: 'comfyOnly',
      label: 'servers.caps.comfyOnly',
      missing: [],
    })
    p.rowTests[7] = { ok: false }
    store.statusFor.mockReturnValue({ online: true, running: 0, pending: 0 })
    expect(p.capsInfo(server())!.kind).toBe('comfyOnly')
  })

  it('capsInfo reports the remote version and the local-vs-remote node diff', () => {
    const p = withSetup(() => useServersPanel())
    store.localCapabilities = probeInstalled({ node_ids: ['A', 'B', 'C'] }).capabilities
    store.capabilityProbeFor.mockReturnValue(probeInstalled({ node_ids: ['A'] }))
    expect(p.capsInfo(server())).toEqual({
      kind: 'comfytv',
      label: 'servers.caps.badge:{"version":"1.8.0"}',
      missing: ['B', 'C'],
    })
    store.localCapabilities = null
  })

  it('toggleCapsExpand flips the expanded row', () => {
    const p = withSetup(() => useServersPanel())
    expect(p.expandedCapsId.value).toBeNull()
    p.toggleCapsExpand(server())
    expect(p.expandedCapsId.value).toBe(7)
    p.toggleCapsExpand(server())
    expect(p.expandedCapsId.value).toBeNull()
  })

  it('statusTitle composes offline, idle and busy descriptions', () => {
    const p = withSetup(() => useServersPanel())
    store.statusFor.mockReturnValueOnce(undefined)
    expect(p.statusTitle(server())).toBe('servers.status.unknown')
    store.statusFor.mockReturnValueOnce({ online: false, error: 'ECONNREFUSED' })
    expect(p.statusTitle(server())).toBe('servers.status.offline — ECONNREFUSED')
    store.statusFor.mockReturnValueOnce({ online: false })
    expect(p.statusTitle(server())).toBe('servers.status.offline')
    store.statusFor.mockReturnValueOnce({ online: true, running: 0, pending: 0, jobs: 2 })
    expect(p.statusTitle(server()))
      .toBe('servers.status.online · servers.status.idle · servers.status.fromComfyTV:{"n":2}')
    store.statusFor.mockReturnValueOnce({ online: true, running: 1, pending: 1, jobs: 0 })
    expect(p.statusTitle(server()))
      .toBe('servers.status.online · servers.status.queueDetail:{"running":1,"pending":1}')
  })
})
