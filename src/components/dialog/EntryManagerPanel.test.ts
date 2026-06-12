import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithPlugins } from '@/__tests__/renderHelpers'
import { app } from '@/lib/comfyApp'

import EntryManagerPanel from './EntryManagerPanel.vue'

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  })

describe('EntryManagerPanel', () => {
  beforeEach(() => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    fetchApi.mockImplementation(async () => jsonResp({ entries: [] }))
  })

  it('renders the @-hint and an empty state when there are no entries', () => {
    renderWithPlugins(EntryManagerPanel, {
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
    renderWithPlugins(EntryManagerPanel, {
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
    const { container } = renderWithPlugins(EntryManagerPanel, {
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
    renderWithPlugins(EntryManagerPanel, {
      stubActions: false,
      initialState: { 'comfytv-project': { currentProjectId: 'default' } },
    })
    await userEvent.click(screen.getByRole('button', { name: /\+ add/i }))
    expect(screen.getByPlaceholderText(/label/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText(/label/i)).not.toBeInTheDocument()
  })

  it('typing an invalid label adds the .invalid class on the new-entry input', async () => {
    const { container } = renderWithPlugins(EntryManagerPanel, {
      stubActions: false,
      initialState: { 'comfytv-project': { currentProjectId: 'default' } },
    })
    await userEvent.click(screen.getByRole('button', { name: /\+ add/i }))
    const labelInput = container.querySelector('.create-row .label-input') as HTMLInputElement
    await userEvent.type(labelInput, '!bad')
    expect(labelInput.classList.contains('invalid')).toBe(true)
  })
})
