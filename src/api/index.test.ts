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
    const fetchApi = vi.fn(async () => json({ ok: true }))
    const { apiSend } = await loadWithFetch(fetchApi)
    const Schema = z.object({ ok: z.literal(true) })
    await apiSend('/x', 'POST', Schema, { foo: 'bar' })
    const [, init] = fetchApi.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ foo: 'bar' })
  })

  it('omits body and Content-Type when undefined', async () => {
    const fetchApi = vi.fn(async () => json({ ok: true }))
    const { apiSend } = await loadWithFetch(fetchApi)
    const Schema = z.object({ ok: z.literal(true) })
    await apiSend('/x', 'DELETE', Schema)
    const [, init] = fetchApi.mock.calls[0]
    expect(init.body).toBeUndefined()
    expect(init.headers).toBeUndefined()
  })
})
