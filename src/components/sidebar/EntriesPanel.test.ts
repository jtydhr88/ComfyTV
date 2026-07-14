import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithPlugins } from '@/__tests__/renderHelpers'
import { app } from '@/lib/comfyApp'

import EntriesPanel from './EntriesPanel.vue'

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  })

describe('EntriesPanel', () => {
  beforeEach(() => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    fetchApi.mockImplementation(async () => jsonResp({ entries: [] }))
  })

  it('renders the @-hint and an empty state when there are no entries', () => {
    renderWithPlugins(EntriesPanel, {
      stubActions: false,
      initialState: {
        'comfytv-project': { currentProjectId: 'default' },
      },
    })

    expect(screen.getByText(/reference any entry/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\+ add/i })).toBeInTheDocument()
    expect(screen.getByText(/no fragments yet/i)).toBeInTheDocument()
  })

  it('clicking + Add reveals a create-row with focused label input', async () => {
    renderWithPlugins(EntriesPanel, {
      stubActions: false,
      initialState: { 'comfytv-project': { currentProjectId: 'default' } },
    })
    const addBtn = screen.getByRole('button', { name: /\+ add/i })
    await userEvent.click(addBtn)
    expect(screen.getByPlaceholderText(/label/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('Save button stays disabled until label + content are both valid', async () => {
    const { container } = renderWithPlugins(EntriesPanel, {
      stubActions: false,
      initialState: { 'comfytv-project': { currentProjectId: 'default' } },
    })
    await userEvent.click(screen.getByRole('button', { name: /\+ add/i }))

    const saveBtn = screen.getByRole('button', { name: /save/i }) as HTMLButtonElement
    expect(saveBtn).toBeDisabled()

    const labelInput = container.querySelector('.create-row .label-input') as HTMLInputElement
    const contentArea = container.querySelector('.create-row .content-textarea') as HTMLTextAreaElement
    await userEvent.type(labelInput, '!bad-name!')
    expect(saveBtn).toBeDisabled()

    await userEvent.clear(labelInput)
    await userEvent.type(labelInput, 'good_label')
    await userEvent.type(contentArea, 'some content')
    expect(saveBtn).not.toBeDisabled()
  })

  it('Cancel button hides the create-row again', async () => {
    renderWithPlugins(EntriesPanel, {
      stubActions: false,
      initialState: { 'comfytv-project': { currentProjectId: 'default' } },
    })
    await userEvent.click(screen.getByRole('button', { name: /\+ add/i }))
    expect(screen.getByPlaceholderText(/label/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText(/label/i)).not.toBeInTheDocument()
  })

  it('typing an invalid label adds the .invalid class on the new-entry input', async () => {
    const { container } = renderWithPlugins(EntriesPanel, {
      stubActions: false,
      initialState: { 'comfytv-project': { currentProjectId: 'default' } },
    })
    await userEvent.click(screen.getByRole('button', { name: /\+ add/i }))
    const labelInput = container.querySelector('.create-row .label-input') as HTMLInputElement
    await userEvent.type(labelInput, '!bad')
    expect(labelInput.classList.contains('invalid')).toBe(true)
  })

  it('import appends valid rows, never updates, and re-import is idempotent', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    let nextId = 1
    fetchApi.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        return jsonResp({
          ok: true,
          entry: { id: nextId++, kind: body.kind, label: body.label, content: body.content, metadata: body.metadata ?? {} },
        })
      }
      return jsonResp({ entries: [] })
    })

    const { container } = renderWithPlugins(EntriesPanel, {
      stubActions: false,
      initialState: { 'comfytv-project': { currentProjectId: 'default' } },
    })

    const file = new File([JSON.stringify({
      comfytv_entries: 1,
      entries: [
        { kind: 'fragment', label: 'good_one', content: 'hello' },
        { kind: 'fragment', label: 'good_one', content: 'same label, other content' },
        { kind: 'fragment', label: '!bad!', content: 'nope' },
        { kind: 'fragment', label: 'no_content', content: '   ' },
      ],
    })], 'backup.json', { type: 'application/json' })

    const picker = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(picker, file)

    expect(await screen.findByText(/imported 2 new, skipped 0 duplicate and 2 invalid/i)).toBeInTheDocument()
    let postCalls = fetchApi.mock.calls.filter(([, init]: any[]) => init?.method === 'POST')
    expect(postCalls).toHaveLength(2)
    expect(postCalls.every(([, init]: any[]) => !('id' in JSON.parse(String(init.body))))).toBe(true)

    await userEvent.upload(picker, file)
    expect(await screen.findByText(/imported 0 new, skipped 2 duplicate and 2 invalid/i)).toBeInTheDocument()
    postCalls = fetchApi.mock.calls.filter(([, init]: any[]) => init?.method === 'POST')
    expect(postCalls).toHaveLength(2)
  })

  it('importing an invalid file shows the import error', async () => {
    const { container } = renderWithPlugins(EntriesPanel, {
      stubActions: false,
      initialState: { 'comfytv-project': { currentProjectId: 'default' } },
    })
    const file = new File(['not json at all'], 'broken.json', { type: 'application/json' })
    const picker = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(picker, file)
    expect(await screen.findByText(/import failed/i)).toBeInTheDocument()
  })
})
