import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  it('listServerNativeWorkflows hits the server proxy route with the kind', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({
      workflows: [{
        path: 'a.json', name: 'a', mtime: 1, size: 2,
        is_linked: false, linked_id: null, pulled: true, pulled_label: 'A',
      }],
    }))
    const { listServerNativeWorkflows } = await loadWithFetch(fetchApi)
    const res = await listServerNativeWorkflows(3, 'image')
    expect(res).toHaveLength(1)
    expect(res[0]!.pulled).toBe(true)
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/servers/3/native_workflows?kind=image')
  })

  it('pullServerWorkflow posts kind/path to the pull route', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ ok: true, kind: 'image', label: 'A', file_path: 'x' }))
    const { pullServerWorkflow } = await loadWithFetch(fetchApi)
    const res = await pullServerWorkflow(3, 'image', 'sub/a.json')
    expect(res.label).toBe('A')
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/servers/3/pull_workflow')
    expect(JSON.parse(init.body)).toEqual({ kind: 'image', path: 'sub/a.json' })
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


describe('workflow default + score editor api', () => {
  beforeEach(() => vi.resetModules())

  it('setDefaultWorkflow posts the default flag', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ ok: true, kind: 'image', label: 'L', is_default: true }))
    const { setDefaultWorkflow } = await loadWithFetch(fetchApi)
    const res = await setDefaultWorkflow(3, true)
    expect(res.is_default).toBe(true)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/workflows/3/set_default')
    expect(JSON.parse(init.body)).toEqual({ default: true })
  })

  it('importScoreEditor posts the musicxml payload', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({
      tempo: 120, beats_per_bar: 4, beat_type: 4,
      parts: [{ name: 'Piano', notes: [{ midi: 60, start: 0, dur: 1 }] }],
    }))
    const { importScoreEditor } = await loadWithFetch(fetchApi)
    const res = await importScoreEditor('<score/>')
    expect(res.parts[0]!.notes).toHaveLength(1)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/score_editor/import')
    expect(JSON.parse(init.body)).toEqual({ musicxml: '<score/>' })
  })

  it('fetchStageDefaults URL-encodes the node id', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({ defaults: { steps: 20 } }))
    const { fetchStageDefaults } = await loadWithFetch(fetchApi)
    const res = await fetchStageDefaults('9:1')
    expect(res.defaults.steps).toBe(20)
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/stage_defaults?node_id=9%3A1')
  })
})


describe('capabilities api', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  const caps = {
    version: '1.0',
    node_ids: ['ComfyTVImageStage'],
    resources: { lut: [{ filename: 'a.cube' }] },
  }

  it('fetchLocalCapabilities fetches /comfytv/capabilities', async () => {
    const fetchApi = vi.fn(async (_url: string) => json(caps))
    const { fetchLocalCapabilities } = await loadWithFetch(fetchApi)
    const res = await fetchLocalCapabilities()
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/capabilities')
    expect(res.node_ids).toEqual(['ComfyTVImageStage'])
    expect(res.resource_fields).toEqual({})
  })

  it('fetchRemoteCapabilities probes through the local backend', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ installed: true, capabilities: caps }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const res = await fetchRemoteCapabilities('box', 8188)
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/servers/probe_capabilities')
    expect(fetchApi.mock.calls[0]![1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ host: 'box', port: 8188 }),
    })
    expect(res.installed).toBe(true)
    if (res.installed) expect(res.capabilities.version).toBe('1.0')
  })

  it('fetchRemoteCapabilities reports HTTP failures from the local backend', async () => {
    const fetchApi = vi.fn(async () => new Response('nope', { status: 500 }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const res = await fetchRemoteCapabilities('box', 8188)
    expect(res).toEqual({ installed: false, error: 'HTTP 500' })
  })

  it('fetchRemoteCapabilities relays probe errors', async () => {
    const fetchApi = vi.fn(async () => json({ installed: false, error: 'HTTP 404' }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const res = await fetchRemoteCapabilities('box', 8188)
    expect(res).toEqual({ installed: false, error: 'HTTP 404' })
  })

  it('fetchRemoteCapabilities reports unrecognized payloads', async () => {
    const fetchApi = vi.fn(async () => json({ installed: true, capabilities: { hello: 'world' } }))
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const res = await fetchRemoteCapabilities('box', 8188)
    expect(res).toEqual({ installed: false, error: 'unrecognized capabilities payload' })
  })

  it('fetchRemoteCapabilities surfaces network errors', async () => {
    const fetchApi = vi.fn(async () => { throw new Error('ECONNREFUSED') })
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const res = await fetchRemoteCapabilities('box', 8188)
    expect(res).toEqual({ installed: false, error: 'ECONNREFUSED' })
  })

  it('fetchRemoteCapabilities stringifies non-Error throws', async () => {
    const fetchApi = vi.fn(async () => { throw 'boom' })
    const { fetchRemoteCapabilities } = await loadWithFetch(fetchApi)
    const res = await fetchRemoteCapabilities('box', 8188)
    expect(res).toEqual({ installed: false, error: 'boom' })
  })
})


describe('resource api', () => {
  beforeEach(() => vi.resetModules())

  const resource = {
    id: 3, kind: 'lut', name: 'Warm', filename: 'warm.cube', subfolder: 'luts', url: '/r/warm.cube',
  }

  it('listResources passes the kind query when given', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({ resources: [resource] }))
    const { listResources } = await loadWithFetch(fetchApi)
    const res = await listResources('lut')
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/resources?kind=lut')
    expect(res.resources[0]!.missing).toBe(false)
  })

  it('listResources omits the query without kind', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({ resources: [] }))
    const { listResources } = await loadWithFetch(fetchApi)
    await listResources()
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/resources')
  })

  it('uploadResource posts multipart form data', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true, resource }))
    const { uploadResource } = await loadWithFetch(fetchApi)
    const file = new File(['x'], 'warm.cube')
    const res = await uploadResource('lut', file)
    expect(res.resource.id).toBe(3)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/resources')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.body.get('kind')).toBe('lut')
    expect(init.body.get('file')).toBe(file)
  })

  it('renameResource patches the addressed resource', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ ok: true, resource: { ...resource, name: 'Cool' } }))
    const { renameResource } = await loadWithFetch(fetchApi)
    const res = await renameResource(3, 'Cool')
    expect(res.resource.name).toBe('Cool')
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/resources/3')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ name: 'Cool' })
  })

  it('deleteResource sends DELETE to the addressed resource', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true }))
    const { deleteResource } = await loadWithFetch(fetchApi)
    const res = await deleteResource(3)
    expect(res.ok).toBe(true)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/resources/3')
    expect(init.method).toBe('DELETE')
  })
})


describe('settings api', () => {
  beforeEach(() => vi.resetModules())

  const row = { key: 'auto_backup', type: 'boolean', value: true, default: false }

  it('fetchSettings fetches /comfytv/settings', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({ settings: [row] }))
    const { fetchSettings } = await loadWithFetch(fetchApi)
    const res = await fetchSettings()
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/settings')
    expect(res.settings[0]!.key).toBe('auto_backup')
  })

  it('saveSettings PUTs the value map', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true, settings: [row] }))
    const { saveSettings } = await loadWithFetch(fetchApi)
    const res = await saveSettings({ auto_backup: true })
    expect(res.ok).toBe(true)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/settings')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ values: { auto_backup: true } })
  })

  it('runDbBackup posts to the backup route', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ ok: true, path: 'db-backup/20260809', snapshot: 'snap' }))
    const { runDbBackup } = await loadWithFetch(fetchApi)
    const res = await runDbBackup()
    expect(res.path).toBe('db-backup/20260809')
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/settings/backup')
    expect(init.method).toBe('POST')
  })
})


describe('stage preset api', () => {
  beforeEach(() => vi.resetModules())

  const preset = { id: 2, kind: 'video_color', name: 'Teal' }

  it('listStagePresets passes the kind query and applies defaults', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({ presets: [preset] }))
    const { listStagePresets } = await loadWithFetch(fetchApi)
    const res = await listStagePresets('video_color')
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/presets?kind=video_color')
    expect(res.presets[0]!.config).toEqual({})
    expect(res.presets[0]!.builtin).toBe(false)
  })

  it('listStagePresets omits the query without kind', async () => {
    const fetchApi = vi.fn(async (_url: string) => json({ presets: [] }))
    const { listStagePresets } = await loadWithFetch(fetchApi)
    await listStagePresets()
    expect(fetchApi.mock.calls[0]![0]).toBe('/comfytv/presets')
  })

  it('saveStagePreset posts the preset payload', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true, preset }))
    const { saveStagePreset } = await loadWithFetch(fetchApi)
    const input = { kind: 'video_color', name: 'Teal', config: { gain: 1.2 } }
    const res = await saveStagePreset(input)
    expect(res.preset.name).toBe('Teal')
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/presets')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(input)
  })

  it('updateStagePreset patches the addressed preset', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ ok: true, preset: { ...preset, name: 'Orange' } }))
    const { updateStagePreset } = await loadWithFetch(fetchApi)
    const res = await updateStagePreset(2, { name: 'Orange' })
    expect(res.preset.name).toBe('Orange')
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/presets/2')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ name: 'Orange' })
  })

  it('deleteStagePreset sends DELETE to the addressed preset', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ ok: true }))
    const { deleteStagePreset } = await loadWithFetch(fetchApi)
    const res = await deleteStagePreset(2)
    expect(res.ok).toBe(true)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/presets/2')
    expect(init.method).toBe('DELETE')
  })
})


describe('media + misc api', () => {
  beforeEach(() => vi.resetModules())

  it('adoptAssets posts to the adopt route', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ ok: true, adopted: 2, dir: 'assets' }))
    const { adoptAssets } = await loadWithFetch(fetchApi)
    const res = await adoptAssets()
    expect(res.adopted).toBe(2)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/assets/adopt')
    expect(init.method).toBe('POST')
  })

  it('proxyEnsure posts only the url by default', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({ status: 'original' }))
    const { proxyEnsure } = await loadWithFetch(fetchApi)
    const res = await proxyEnsure('/view?file=a.mp4')
    expect(res.status).toBe('original')
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/proxy/ensure')
    expect(JSON.parse(init.body)).toEqual({ url: '/view?file=a.mp4' })
  })

  it('proxyEnsure forwards create and retry flags', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ status: 'ready', proxy_url: '/p.mp4', width: 640, height: 360 }))
    const { proxyEnsure } = await loadWithFetch(fetchApi)
    const res = await proxyEnsure('/view?file=a.mp4', { create: true, retry: true })
    expect(res.proxy_url).toBe('/p.mp4')
    const [, init] = fetchApi.mock.calls[0]!
    expect(JSON.parse(init.body)).toEqual({ url: '/view?file=a.mp4', create: true, retry: true })
  })

  it('midiEnsure posts the url', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ status: 'ready', url: '/m.mid' }))
    const { midiEnsure } = await loadWithFetch(fetchApi)
    const res = await midiEnsure('/view?file=a.mid')
    expect(res.url).toBe('/m.mid')
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/midi/ensure')
    expect(JSON.parse(init.body)).toEqual({ url: '/view?file=a.mid' })
  })

  it('midiEvents posts the url and returns parsed events', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) => json({
      status: 'ready',
      events: [{ t: 0, dur: 0.5, midi: 60, vel: 100, ch: 0 }],
      duration: 12,
    }))
    const { midiEvents } = await loadWithFetch(fetchApi)
    const res = await midiEvents('/view?file=a.mid')
    expect(res.events).toHaveLength(1)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/midi/events')
    expect(JSON.parse(init.body)).toEqual({ url: '/view?file=a.mid' })
  })

  it('expressionEval posts the expression payload', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ samples: [[0, 1], [0.5, 0.2]] }))
    const { expressionEval } = await loadWithFetch(fetchApi)
    const body = { expression: 'sin(t)', duration: 2, fps: 30, seed: 7 }
    const res = await expressionEval(body)
    expect(res.samples).toHaveLength(2)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/expression_eval')
    expect(JSON.parse(init.body)).toEqual(body)
  })

  it('fxClipPreview posts params and includes window when given', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ url: '/clip.mp4', t0: 1, t1: 2.2 }))
    const { fxClipPreview } = await loadWithFetch(fetchApi)
    const res = await fxClipPreview('12', { strength: 0.5 }, '/v.mp4', 1, 1.2)
    expect(res.t1).toBe(2.2)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/comfytv/fx_preview')
    expect(JSON.parse(init.body)).toEqual({
      node_id: '12', params: { strength: 0.5 }, video: '/v.mp4', t: 1, window: 1.2,
    })
  })

  it('fxClipPreview omits window when not given', async () => {
    const fetchApi = vi.fn(async (_url: string, _init?: any) =>
      json({ url: '/clip.mp4', t0: 0, t1: 1.2 }))
    const { fxClipPreview } = await loadWithFetch(fetchApi)
    await fxClipPreview('12', {}, '/v.mp4', 0)
    const [, init] = fetchApi.mock.calls[0]!
    expect(JSON.parse(init.body)).toEqual({ node_id: '12', params: {}, video: '/v.mp4', t: 0 })
  })
})
