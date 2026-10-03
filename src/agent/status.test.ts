import { beforeEach, expect, it, vi } from 'vitest'
const { fetchApi, setEnabled } = vi.hoisted(() => ({ fetchApi: vi.fn(), setEnabled: vi.fn() }))
vi.mock('@agent/scripts/api', () => ({ api: { fetchApi } }))
vi.mock('@/api', () => ({ apiFetch: async (_path: string, schema: any) => schema.parse(await (await fetchApi()).json()) }))
vi.mock('./mount', () => ({ setAgentPanelEnabled: setEnabled }))
const provider = { id: 'hermes', label: 'Hermes', available: true, version: '', logged_in: null, detail: '', stateful: true }
const good = () => new Response(JSON.stringify({ enabled: true, providers: [provider] }))
beforeEach(() => { vi.resetModules(); fetchApi.mockReset(); setEnabled.mockReset() })
it('coalesces concurrent consumers and passive opens never retry or poll', async () => {
  const s = await import('./status')
  let resolve!: (r: Response) => void
  fetchApi.mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const a = s.refreshAgentStatus()
  const b = s.refreshAgentStatus()
  expect(fetchApi).toHaveBeenCalledTimes(1)
  resolve(good())
  await Promise.all([a, b])
  await s.ensureAgentStatus()
  expect(fetchApi).toHaveBeenCalledTimes(1)
})
it('invalidates saved generations without accepting superseded results and defers while busy', async () => {
  const s = await import('./status')
  const { agentBusy } = await import('@agent/comfytv/actions')
  let resolve!: (r: Response) => void
  fetchApi.mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const old = s.refreshAgentStatus()
  agentBusy.value = true
  s.invalidateAgentStatus()
  resolve(new Response('{"enabled":false,"providers":[]}'))
  await old
  expect(setEnabled).not.toHaveBeenCalled()
  expect(s.agentStatusDeferred.value).toBe(true)
  expect(fetchApi).toHaveBeenCalledTimes(1)
  fetchApi.mockResolvedValueOnce(good())
  agentBusy.value = false
  await (await import('vue')).nextTick()
  await s.ensureAgentStatus()
  expect(fetchApi).toHaveBeenCalledTimes(2)
  expect(s.agentEnabled.value).toBe(true)
})
it('refreshes Hermes only, retaining other providers and coalescing explicit clicks', async () => {
  const s = await import('./status')
  s.agentProviders.value = [{ ...provider, id: 'codex' }]
  fetchApi.mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true, provider })))
  await Promise.all([s.refreshHermesHealth(), s.refreshHermesHealth()])
  expect(fetchApi).toHaveBeenCalledTimes(1)
  expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/bot/providers/hermes/health')
  expect(s.agentProviders.value.map(p => p.id)).toEqual(['codex', 'hermes'])
})
it('falls back from old-server 404 at most once through shared status', async () => {
  const s = await import('./status')
  fetchApi.mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(good())
  await s.refreshHermesHealth()
  await s.refreshHermesHealth()
  expect(fetchApi).toHaveBeenCalledTimes(2)
  expect(s.agentEnabled.value).toBe(true)
})
it('keeps a saved-config all-provider invalidation when explicit health refresh races the idle transition', async () => {
  const s = await import('./status')
  const { agentBusy } = await import('@agent/comfytv/actions')
  agentBusy.value = true
  await s.invalidateAgentStatus()
  expect(fetchApi).not.toHaveBeenCalled()
  agentBusy.value = false
  fetchApi.mockResolvedValueOnce(good())
  await s.refreshHermesHealth()
  expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/bot/status')
})
it('retains established dock and snapshot after transport or invalid schema failures', async () => {
  const s = await import('./status')
  fetchApi.mockResolvedValueOnce(good())
  await s.refreshAgentStatus()
  fetchApi.mockRejectedValueOnce(new Error('SECRET'))
  await s.refreshAgentStatus()
  expect(s.agentEnabled.value).toBe(true)
  expect(s.agentProviders.value).toHaveLength(1)
  expect(setEnabled).not.toHaveBeenCalledWith(false)
  fetchApi.mockResolvedValueOnce(new Response('{}'))
  await s.refreshAgentStatus()
  expect(s.agentEnabled.value).toBe(true)
  fetchApi.mockResolvedValueOnce(new Response('{"enabled":false,"providers":[]}'))
  await s.refreshAgentStatus()
  expect(s.agentEnabled.value).toBe(false)
  expect(setEnabled).toHaveBeenLastCalledWith(false)
})

it('superseded 404 cannot poison the next saved generation compatibility state', async () => {
  const s = await import('./status')
  const { agentBusy } = await import('@agent/comfytv/actions')
  agentBusy.value = false
  let resolve!: (r: Response) => void
  fetchApi.mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const old = s.refreshHermesHealth()
  fetchApi.mockResolvedValueOnce(good())
  void s.invalidateAgentStatus()
  resolve(new Response('', { status: 404 }))
  await old
  await (await import('@vue/test-utils')).flushPromises()
  fetchApi.mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true, provider })))
  await s.refreshHermesHealth()
  expect(fetchApi.mock.calls.map(c => c[0])).toEqual(['/comfytv/bot/providers/hermes/health', '/comfytv/bot/status', '/comfytv/bot/providers/hermes/health'])
  expect(s.agentStatusError.value).toBeNull()
})
it('successful save resets an established legacy fallback for the new generation', async () => {
  const s = await import('./status')
  fetchApi.mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(good())
  await s.refreshHermesHealth()
  expect(s.agentStatusError.value).toBe('unsupported')
  fetchApi.mockResolvedValueOnce(good())
  await s.invalidateAgentStatus()
  fetchApi.mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true, provider })))
  await s.refreshHermesHealth()
  expect(fetchApi).toHaveBeenCalledTimes(4)
  expect(s.agentStatusError.value).toBeNull()
})

it('404 arriving after busy starts schedules one shared fallback only once idle', async () => {
  const s = await import('./status')
  const { agentBusy } = await import('@agent/comfytv/actions')
  agentBusy.value = false
  fetchApi.mockResolvedValueOnce(good())
  await s.refreshAgentStatus()
  let resolve!: (r: Response) => void
  fetchApi.mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const old = s.refreshHermesHealth()
  agentBusy.value = true
  resolve(new Response('', { status: 404 }))
  await old
  expect(fetchApi).toHaveBeenCalledTimes(2)
  expect(s.agentStatusDeferred.value).toBe(true)
  expect(s.agentEnabled.value).toBe(true)
  fetchApi.mockResolvedValueOnce(good())
  await s.refreshHermesHealth()
  expect(fetchApi).toHaveBeenCalledTimes(2)
  agentBusy.value = false
  await (await import('@vue/test-utils')).flushPromises()
  expect(fetchApi.mock.calls.map(c => c[0])).toEqual(['/comfytv/bot/status', '/comfytv/bot/providers/hermes/health', '/comfytv/bot/status'])
  expect(s.agentStatusDeferred.value).toBe(false)
  expect(s.agentStatusError.value).toBe('unsupported')
  expect(setEnabled).not.toHaveBeenCalledWith(false)
})
