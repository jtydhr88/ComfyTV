import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const apiMock = vi.hoisted(() => ({
  listServers: vi.fn(),
  createServer: vi.fn(),
  updateServer: vi.fn(),
  deleteServer: vi.fn(),
  testServer: vi.fn(),
  listServerStatus: vi.fn(),
  fetchLocalCapabilities: vi.fn(),
  fetchRemoteCapabilities: vi.fn(),
}))

vi.mock('@/api', () => apiMock)

import { LOCAL_SERVER, useServerStore } from './serverStore'

const RIG = { id: 3, label: 'rig', host: '192.168.1.20', port: 8188, enabled: true }
const OFF = { id: 4, label: 'off', host: '192.168.1.21', port: 8188, enabled: false }

describe('serverStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('load populates servers and hasRemotes counts enabled only', async () => {
    apiMock.listServers.mockResolvedValue({ servers: [RIG, OFF] })
    const store = useServerStore()
    await store.load()
    expect(store.servers).toHaveLength(2)
    expect(store.enabledServers.map(s => s.id)).toEqual([3])
    expect(store.hasRemotes).toBe(true)
  })

  it('hasRemotes is false with only disabled servers', async () => {
    apiMock.listServers.mockResolvedValue({ servers: [OFF] })
    const store = useServerStore()
    await store.load()
    expect(store.hasRemotes).toBe(false)
  })

  it('load is cached until forced', async () => {
    apiMock.listServers.mockResolvedValue({ servers: [] })
    const store = useServerStore()
    await store.load()
    await store.load()
    expect(apiMock.listServers).toHaveBeenCalledTimes(1)
    await store.load(true)
    expect(apiMock.listServers).toHaveBeenCalledTimes(2)
  })

  it('create appends, update replaces, remove filters', async () => {
    apiMock.listServers.mockResolvedValue({ servers: [] })
    apiMock.createServer.mockResolvedValue({ server: RIG })
    apiMock.updateServer.mockResolvedValue({ server: { ...RIG, enabled: false } })
    apiMock.deleteServer.mockResolvedValue({ ok: true })
    const store = useServerStore()
    await store.load()

    await store.create({ label: 'rig', host: RIG.host, port: RIG.port })
    expect(store.servers.map(s => s.id)).toEqual([3])

    await store.update(3, { enabled: false })
    expect(store.byId(3)?.enabled).toBe(false)

    await store.remove(3)
    expect(store.servers).toHaveLength(0)
  })

  it('create returns null on api failure', async () => {
    apiMock.createServer.mockRejectedValue(new Error('409'))
    const store = useServerStore()
    expect(await store.create({ label: 'x', host: 'h', port: 1 })).toBeNull()
  })

  it('update returns null and remove returns false on api failure', async () => {
    apiMock.updateServer.mockRejectedValue(new Error('nope'))
    apiMock.deleteServer.mockRejectedValue(new Error('nope'))
    const store = useServerStore()
    expect(await store.update(3, { enabled: false })).toBeNull()
    expect(await store.remove(3)).toBe(false)
  })

  it('testConnection surfaces api errors as {ok:false}', async () => {
    apiMock.testServer.mockRejectedValue(new Error('unreachable'))
    const store = useServerStore()
    const res = await store.testConnection('h', 8188)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('unreachable')
  })

  it('subscribeStatus polls immediately, shares one loop, and statusFor reads it', async () => {
    apiMock.listServerStatus.mockResolvedValue({
      statuses: [{ id: 3, online: true, running: 1, pending: 2, jobs: 0 }],
    })
    const store = useServerStore()
    const off1 = store.subscribeStatus()
    const off2 = store.subscribeStatus()
    await vi.waitFor(() => expect(store.statusFor(3)?.pending).toBe(2))
    expect(apiMock.listServerStatus).toHaveBeenCalledTimes(1)
    off1()
    off1()
    off2()
  })

  it('pollStatus swallows api errors and leaves statuses empty', async () => {
    apiMock.listServerStatus.mockRejectedValue(new Error('boom'))
    const store = useServerStore()
    await store.pollStatus()
    expect(store.statusFor(3)).toBeUndefined()
  })

  it('subscribeStatus re-polls after being fully released', async () => {
    apiMock.listServerStatus.mockResolvedValue({ statuses: [] })
    const store = useServerStore()
    const off = store.subscribeStatus()
    await vi.waitFor(() => expect(apiMock.listServerStatus).toHaveBeenCalledTimes(1))
    off()
    const off2 = store.subscribeStatus()
    await vi.waitFor(() => expect(apiMock.listServerStatus).toHaveBeenCalledTimes(2))
    off2()
  })

  it('probeCapabilities probes the server origin and caches installed results', async () => {
    apiMock.listServers.mockResolvedValue({ servers: [RIG] })
    const caps = {
      version: '1.8.0',
      node_ids: ['ComfyTV.VideoLUTStage'],
      resources: { lut: [], font: [] },
      resource_fields: {},
    }
    apiMock.fetchRemoteCapabilities.mockResolvedValue({ installed: true, capabilities: caps })
    const store = useServerStore()
    await store.load()

    const probe = await store.probeCapabilities(3)
    expect(apiMock.fetchRemoteCapabilities).toHaveBeenCalledWith('http://192.168.1.20:8188')
    expect(probe).toEqual({ installed: true, capabilities: caps })
    expect(store.capabilityProbeFor(3)).toEqual(probe)

    await store.probeCapabilities(3)
    expect(apiMock.fetchRemoteCapabilities).toHaveBeenCalledTimes(1)

    await store.probeCapabilities(3, true)
    expect(apiMock.fetchRemoteCapabilities).toHaveBeenCalledTimes(2)
  })

  it('probeCapabilities re-probes after a failed probe', async () => {
    apiMock.listServers.mockResolvedValue({ servers: [RIG] })
    apiMock.fetchRemoteCapabilities.mockResolvedValue({ installed: false, error: 'HTTP 404' })
    const store = useServerStore()
    await store.load()

    expect(await store.probeCapabilities(3)).toEqual({ installed: false, error: 'HTTP 404' })
    await store.probeCapabilities(3)
    expect(apiMock.fetchRemoteCapabilities).toHaveBeenCalledTimes(2)
    expect(store.capabilityProbeFor(3)).toEqual({ installed: false, error: 'HTTP 404' })
  })

  it('probeCapabilities answers installed:false for unknown servers without fetching', async () => {
    const store = useServerStore()
    expect(await store.probeCapabilities(99)).toEqual({
      installed: false, error: 'unknown server',
    })
    expect(apiMock.fetchRemoteCapabilities).not.toHaveBeenCalled()
  })

  it('loadLocalCapabilities fetches once and caches', async () => {
    const caps = {
      version: '1.8.0',
      node_ids: [],
      resources: { lut: [], font: [] },
      resource_fields: {},
    }
    apiMock.fetchLocalCapabilities.mockResolvedValue(caps)
    const store = useServerStore()
    expect(await store.loadLocalCapabilities()).toEqual(caps)
    expect(await store.loadLocalCapabilities()).toEqual(caps)
    expect(apiMock.fetchLocalCapabilities).toHaveBeenCalledTimes(1)
    expect(store.localCapabilities).toEqual(caps)
  })

  it('loadLocalCapabilities returns null on failure and retries next call', async () => {
    apiMock.fetchLocalCapabilities.mockRejectedValueOnce(new Error('boom'))
    apiMock.fetchLocalCapabilities.mockResolvedValueOnce({
      version: 'x', node_ids: [], resources: {}, resource_fields: {},
    })
    const store = useServerStore()
    expect(await store.loadLocalCapabilities()).toBeNull()
    expect((await store.loadLocalCapabilities())?.version).toBe('x')
    expect(apiMock.fetchLocalCapabilities).toHaveBeenCalledTimes(2)
  })

  it('resolveSelection maps local/missing/disabled to null', async () => {
    apiMock.listServers.mockResolvedValue({ servers: [RIG, OFF] })
    const store = useServerStore()
    await store.load()
    expect(store.resolveSelection(null)).toBeNull()
    expect(store.resolveSelection('')).toBeNull()
    expect(store.resolveSelection(LOCAL_SERVER)).toBeNull()
    expect(store.resolveSelection('999')).toBeNull()   // deleted server
    expect(store.resolveSelection('4')).toBeNull()     // disabled server
    expect(store.resolveSelection('garbage')).toBeNull()
    expect(store.resolveSelection('3')).toBe(3)
    expect(store.resolveSelection(3)).toBe(3)
  })
})
