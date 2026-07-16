import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

async function loadWithFetch(fetchImpl: any) {
  vi.resetModules()
  vi.doMock('@/lib/comfyApp', () => ({
    app: { api: { fetchApi: fetchImpl } },
  }))
  return await import('./index')
}

const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
})

describe('apiFetch', () => {
  beforeEach(() => vi.resetModules())

  it('validates response against schema', async () => {
    const fetchApi = vi.fn(async () => json({ name: 'X', age: 7 }))
    const { apiFetch } = await loadWithFetch(fetchApi)
    const Schema = z.object({ name: z.string(), age: z.number() })
    const result = await apiFetch('/x', Schema)
    expect(result).toEqual({ name: 'X', age: 7 })
  })

  it('throws ApiError on non-ok status', async () => {
    const fetchApi = vi.fn(async () => new Response('boom', { status: 500, statusText: 'Server Error' }))
    const { apiFetch, ApiError } = await loadWithFetch(fetchApi)
    const Schema = z.object({})
    await expect(apiFetch('/x', Schema)).rejects.toBeInstanceOf(ApiError)
  })

  it('ApiError carries path + status + message', async () => {
    const fetchApi = vi.fn(async () => new Response('detail', { status: 404, statusText: 'Not Found' }))
    const { apiFetch, ApiError } = await loadWithFetch(fetchApi)
    const Schema = z.object({})
    try {
      await apiFetch('/x', Schema)
      throw new Error('expected throw')
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError)
      expect(e.path).toBe('/x')
      expect(e.status).toBe(404)
      expect(e.message).toContain('detail')
    }
  })

  it('throws ApiValidationError when shape mismatches', async () => {
    const fetchApi = vi.fn(async () => json({ name: 42 }))
    const { apiFetch, ApiValidationError } = await loadWithFetch(fetchApi)
    const Schema = z.object({ name: z.string() })
    await expect(apiFetch('/x', Schema)).rejects.toBeInstanceOf(ApiValidationError)
  })

  it('forwards init args to fetchApi', async () => {
    const fetchApi = vi.fn(async () => json({}))
    const { apiFetch } = await loadWithFetch(fetchApi)
    const Schema = z.object({})
    await apiFetch('/x', Schema, { method: 'POST' })
    expect(fetchApi).toHaveBeenCalledWith('/x', { method: 'POST' })
  })
})


describe('apiSend', () => {
  beforeEach(() => vi.resetModules())

  it('serializes body as JSON', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true }))
    const { apiSend } = await loadWithFetch(fetchApi)
    const Schema = z.object({ ok: z.literal(true) })
    await apiSend('/x', 'POST', Schema, { foo: 'bar' })
    const [, init] = fetchApi.mock.calls[0]!
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ foo: 'bar' })
  })

  it('omits body and Content-Type when undefined', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true }))
    const { apiSend } = await loadWithFetch(fetchApi)
    const Schema = z.object({ ok: z.literal(true) })
    await apiSend('/x', 'DELETE', Schema)
    const [, init] = fetchApi.mock.calls[0]!
    expect(init.body).toBeUndefined()
    expect(init.headers).toBeUndefined()
  })
})


describe('workflow link api', () => {
  beforeEach(() => vi.resetModules())

  it('listNativeWorkflows returns the array and passes kind', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({
      workflows: [{ path: 'a.json', name: 'a', mtime: 1, size: 2, is_linked: false, linked_id: null }],
    }))
    const { listNativeWorkflows } = await loadWithFetch(fetchApi)
    const res = await listNativeWorkflows('image')
    expect(res).toHaveLength(1)
    expect(res[0]!.name).toBe('a')
    expect(fetchApi.mock.calls[0]![0]).toContain('kind=image')
  })

  it('listNativeWorkflows omits the kind query when not given', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ workflows: [] }))
    const { listNativeWorkflows } = await loadWithFetch(fetchApi)
    await listNativeWorkflows()
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/workflows/native')
  })

  it('linkWorkflow posts kind/path/label', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true, kind: 'image', label: 'A', id: 5 }))
    const { linkWorkflow } = await loadWithFetch(fetchApi)
    const res = await linkWorkflow('image', 'a.json', 'A')
    expect(res.id).toBe(5)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/workflows/link')
    expect(JSON.parse(init.body)).toEqual({ kind: 'image', path: 'a.json', label: 'A' })
  })

  it('unlinkWorkflow posts to the unlink route', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true, kind: 'image', label: 'A' }))
    const { unlinkWorkflow } = await loadWithFetch(fetchApi)
    const res = await unlinkWorkflow(5)
    expect(res.ok).toBe(true)
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/workflows/5/unlink')
  })
})


describe('workflow catalog api', () => {
  beforeEach(() => vi.resetModules())

  const emptyCaps = { upstream_kinds: [], option_keys: [], computed_keys: [] }

  it('fetchCaps hits /comfytv/caps and validates the payload', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({
      caps_by_kind: { image: emptyCaps },
      fallback_caps: emptyCaps,
      option_labels: { foo: 'Foo' },
    }))
    const { fetchCaps } = await loadWithFetch(fetchApi)
    const res = await fetchCaps()
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/caps')
    expect(res.caps_by_kind.image).toEqual(emptyCaps)
    expect(res.option_labels.foo).toBe('Foo')
  })

  it('importWorkflow posts kind/filename/content', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true, kind: 'image', label: 'wf' }))
    const { importWorkflow } = await loadWithFetch(fetchApi)
    const res = await importWorkflow('image', 'wf.json', '{"nodes":[]}')
    expect(res.label).toBe('wf')
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/workflows/import')
    expect(JSON.parse(init.body)).toEqual({ kind: 'image', filename: 'wf.json', content: '{"nodes":[]}' })
  })

  it('uploadApiSidecar posts kind/label/content', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ ok: true, label: 'wf', node_count: 3, sidecar: 'wf.api.json' }))
    const { uploadApiSidecar } = await loadWithFetch(fetchApi)
    const res = await uploadApiSidecar('image', 'wf', '{}')
    expect(res.node_count).toBe(3)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/workflows/api_sidecar')
    expect(JSON.parse(init.body)).toEqual({ kind: 'image', label: 'wf', content: '{}' })
  })

  it('listWorkflowOverview passes the kind query when given', async () => {
    const overview = {
      id: 1, kind: 'image', label: 'L', order: 0,
      link_type: 0, file_path: 'p.json', file_exists: true, has_api: true,
    }
    const fetchApi = vi.fn(async (_url: string) => json({ kinds: ['image'], workflows: [overview] }))
    const { listWorkflowOverview } = await loadWithFetch(fetchApi)
    const res = await listWorkflowOverview('image')
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/workflows?kind=image')
    expect(res.workflows).toHaveLength(1)
    expect(res.recent_added).toEqual([])
  })

  it('listWorkflowOverview omits the query without kind', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({ kinds: [], workflows: [] }))
    const { listWorkflowOverview } = await loadWithFetch(fetchApi)
    await listWorkflowOverview()
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/workflows')
  })

  it('rescanWorkflows posts to the rescan route', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ ok: true, added: [{ kind: 'image', label: 'x' }], pruned: 1, total: 4 }))
    const { rescanWorkflows } = await loadWithFetch(fetchApi)
    const res = await rescanWorkflows()
    expect(res.added).toHaveLength(1)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/workflows/rescan')
    expect(init.method).toBe('POST')
  })
})


describe('server api', () => {
  beforeEach(() => vi.resetModules())

  const server = { id: 1, label: 'A', host: 'localhost', port: 8188, enabled: true }

  it('listServers fetches /comfytv/servers', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({ servers: [server] }))
    const { listServers } = await loadWithFetch(fetchApi)
    const res = await listServers()
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/servers')
    expect(res.servers[0]!.label).toBe('A')
  })

  it('listServerStatus fetches /comfytv/servers/status', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({
      statuses: [{ id: 1, online: true, running: 0, pending: 2 }],
    }))
    const { listServerStatus } = await loadWithFetch(fetchApi)
    const res = await listServerStatus()
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/servers/status')
    expect(res.statuses[0]!.pending).toBe(2)
  })

  it('createServer posts the new server payload', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ server }))
    const { createServer } = await loadWithFetch(fetchApi)
    const res = await createServer({ label: 'A', host: 'localhost', port: 8188 })
    expect(res.server.id).toBe(1)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/servers')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ label: 'A', host: 'localhost', port: 8188 })
  })

  it('updateServer patches the addressed server', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ server: { ...server, enabled: false } }))
    const { updateServer } = await loadWithFetch(fetchApi)
    const res = await updateServer(1, { enabled: false })
    expect(res.server.enabled).toBe(false)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/servers/1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ enabled: false })
  })

  it('deleteServer sends DELETE to the addressed server', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true }))
    const { deleteServer } = await loadWithFetch(fetchApi)
    const res = await deleteServer(7)
    expect(res.ok).toBe(true)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/servers/7')
    expect(init.method).toBe('DELETE')
  })

  it('testServer posts host/port and returns probe details', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ ok: true, version: '0.28.0', os: 'nt', devices: ['cuda:0'] }))
    const { testServer } = await loadWithFetch(fetchApi)
    const res = await testServer({ host: 'h', port: 1234 })
    expect(res.version).toBe('0.28.0')
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/servers/test')
    expect(JSON.parse(init.body)).toEqual({ host: 'h', port: 1234 })
  })
})


describe('remote job api', () => {
  beforeEach(() => vi.resetModules())

  it('remoteRun posts the full run payload', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ job_id: 'j1' }))
    const { remoteRun } = await loadWithFetch(fetchApi)
    const input = {
      server_id: 2,
      prompt: { '1': { class_type: 'X' } },
      target_node_id: '9',
      project_id: 'default',
      stage_uid: 'uid-1',
    }
    const res = await remoteRun(input)
    expect(res.job_id).toBe('j1')
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/remote_run')
    expect(JSON.parse(init.body)).toEqual(input)
  })

  it('listRemoteJobs passes the status filter', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({
      jobs: [{
        id: 'j1', server_label: 'A', project_id: 'default',
        stage_node_id: '9', status: 'running',
      }],
    }))
    const { listRemoteJobs } = await loadWithFetch(fetchApi)
    const res = await listRemoteJobs('running')
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/remote_jobs?status=running')
    expect(res.jobs[0]!.status).toBe('running')
  })

  it('listRemoteJobs omits the query without a status', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({ jobs: [] }))
    const { listRemoteJobs } = await loadWithFetch(fetchApi)
    await listRemoteJobs()
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/remote_jobs')
  })

  it('cancelRemoteJob URL-encodes the job id', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true }))
    const { cancelRemoteJob } = await loadWithFetch(fetchApi)
    await cancelRemoteJob('job/1')
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/remote_jobs/job%2F1/cancel')
  })
})
