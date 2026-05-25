import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useProjectStore } from './projectStore'

vi.mock('@/api', () => {
  return {
    apiFetch: vi.fn(),
    apiSend: vi.fn(),
  }
})

import { apiFetch, apiSend } from '@/api'

const mockFetch = apiFetch as any
const mockSend  = apiSend  as any


describe('projectStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch.mockReset()
    mockSend.mockReset()
  })

  it('starts with default project id', () => {
    const store = useProjectStore()
    expect(store.currentProjectId).toBe('default')
    expect(store.loaded).toBe(false)
    expect(store.projects).toEqual([])
  })

  it('refresh loads list and flips loaded', async () => {
    mockFetch.mockResolvedValueOnce({
      projects: [
        { id: 'default', name: 'Default' },
        { id: 'p1', name: 'Other' },
      ],
    })
    const store = useProjectStore()
    await store.refresh()
    expect(store.loaded).toBe(true)
    expect(store.projects.length).toBe(2)
  })

  it('refresh resets currentProjectId when stale', async () => {
    const store = useProjectStore()
    store.setCurrent('p1')
    mockFetch.mockResolvedValueOnce({
      projects: [{ id: 'default', name: 'Default' }],
    })
    await store.refresh()
    expect(store.currentProjectId).toBe('default')
  })

  it('current returns the matching project', async () => {
    mockFetch.mockResolvedValueOnce({
      projects: [
        { id: 'default', name: 'Default' },
        { id: 'p2', name: 'Two' },
      ],
    })
    const store = useProjectStore()
    await store.refresh()
    store.setCurrent('p2')
    expect(store.current?.name).toBe('Two')
  })

  it('current is null when no match', () => {
    const store = useProjectStore()
    expect(store.current).toBeNull()
  })

  it('createProject prepends and switches', async () => {
    const store = useProjectStore()
    mockSend.mockResolvedValueOnce({ project: { id: 'new', name: 'New' } })
    const result = await store.createProject('New')
    expect(result?.id).toBe('new')
    expect(store.projects[0]?.id).toBe('new')
    expect(store.currentProjectId).toBe('new')
  })

  it('createProject returns null when backend gives no project', async () => {
    const store = useProjectStore()
    mockSend.mockResolvedValueOnce({})
    const result = await store.createProject('X')
    expect(result).toBeNull()
  })

  it('rename updates row in place', async () => {
    mockFetch.mockResolvedValueOnce({
      projects: [{ id: 'p1', name: 'Orig' }],
    })
    const store = useProjectStore()
    await store.refresh()
    mockSend.mockResolvedValueOnce({ project: { id: 'p1', name: 'Renamed' } })
    const result = await store.rename('p1', 'Renamed')
    expect(result?.name).toBe('Renamed')
    expect(store.projects[0].name).toBe('Renamed')
  })

  it('rename returns null if backend gives nothing', async () => {
    mockSend.mockResolvedValueOnce({})
    const store = useProjectStore()
    expect(await store.rename('p1', 'X')).toBeNull()
  })

  it('remove drops the row and falls back to default if current', async () => {
    mockFetch.mockResolvedValueOnce({
      projects: [
        { id: 'p1', name: 'P1' },
        { id: 'default', name: 'Default' },
      ],
    })
    const store = useProjectStore()
    await store.refresh()
    store.setCurrent('p1')
    mockSend.mockResolvedValueOnce({ ok: true })
    await store.remove('p1')
    expect(store.projects.map(p => p.id)).toEqual(['default'])
    expect(store.currentProjectId).toBe('default')
  })

  it('setCurrent falls back to default for blank id', () => {
    const store = useProjectStore()
    store.setCurrent('')
    expect(store.currentProjectId).toBe('default')
  })

  it('fetchLatestOutput returns the output row', async () => {
    mockFetch.mockResolvedValueOnce({ output: { id: 1, project_id: 'p1' } })
    const store = useProjectStore()
    const row = await store.fetchLatestOutput('p1', '42')
    expect(row).toEqual({ id: 1, project_id: 'p1' })
  })

  it('fetchLatestOutput returns null on empty args', async () => {
    const store = useProjectStore()
    expect(await store.fetchLatestOutput('', '1')).toBeNull()
    expect(await store.fetchLatestOutput('p1', '')).toBeNull()
  })

  it('fetchLatestOutput returns null on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'))
    const store = useProjectStore()
    expect(await store.fetchLatestOutput('p1', '42')).toBeNull()
  })
})
