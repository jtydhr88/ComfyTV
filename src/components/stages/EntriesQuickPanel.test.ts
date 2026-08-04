import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: () => ({ currentProjectId: 'p1' }),
}))

import { makeI18n } from '@/__tests__/renderHelpers'
import { app } from '@/lib/comfyApp'

import EntriesQuickPanel from './EntriesQuickPanel.vue'

const pinia = () => {
  const p = createPinia()
  setActivePinia(p)
  return p
}

const jsonResp = (data: any) =>
  new Response(JSON.stringify(data), {
    status: 200, headers: { 'content-type': 'application/json' },
  })

function seed(rows: any[]) {
  const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
  fetchApi.mockImplementation(async () => jsonResp({ entries: rows }))
}

describe('EntriesQuickPanel', () => {
  let activePinia: ReturnType<typeof pinia>

  beforeEach(() => {
    activePinia = pinia()
    vi.clearAllMocks()
  })

  function mountPanel() {
    return mount(EntriesQuickPanel, {
      global: {
        plugins: [activePinia, makeI18n()],
        mocks: { },
      },
    })
  }

  it('renders one row per entry with a badge on prompt entries', async () => {
    seed([
      { id: 1, kind: 'fragment', label: 'style', content: 'oil painting', metadata: {}, updated_at: null },
      { id: 2, kind: 'prompt', label: 'opening', content: 'shot of @image_0', metadata: {}, updated_at: null },
    ])
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('button')
    expect(rows).toHaveLength(2)
    expect(w.text()).toContain('@style')
    expect(w.text()).toContain('@opening')
    expect(w.findAll('.pi-file-import')).toHaveLength(1)
  })

  it('emits insert with the clicked entry', async () => {
    seed([
      { id: 1, kind: 'fragment', label: 'style', content: 'oil painting', metadata: {}, updated_at: null },
    ])
    const w = mountPanel()
    await flushPromises()
    await w.find('button').trigger('click')
    const emitted = w.emitted('insert')!
    expect(emitted).toHaveLength(1)
    expect((emitted[0][0] as any).label).toBe('style')
  })

  it('search filters by label and by content', async () => {
    seed([
      { id: 1, kind: 'fragment', label: 'style', content: 'oil painting', metadata: {}, updated_at: null },
      { id: 2, kind: 'prompt', label: 'opening', content: 'night courtyard with @image_0', metadata: {}, updated_at: null },
    ])
    const w = mountPanel()
    await flushPromises()

    await w.find('input').setValue('sty')
    expect(w.findAll('button')).toHaveLength(1)
    expect(w.text()).toContain('@style')

    await w.find('input').setValue('courtyard')
    expect(w.findAll('button')).toHaveLength(1)
    expect(w.text()).toContain('@opening')

    await w.find('input').setValue('zzz')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('shows the empty hint without entries', async () => {
    seed([])
    const w = mountPanel()
    await flushPromises()
    expect(w.find('button').exists()).toBe(false)
    expect(w.text()).not.toBe('')
  })
})
