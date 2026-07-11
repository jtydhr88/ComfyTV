import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithPlugins } from '@/__tests__/renderHelpers'
import type { StageState } from '@/stores/stageStore'

const mocks = vi.hoisted(() => ({
  uploadBlobNamed: vi.fn(),
}))

vi.mock('@/utils/uploadCanvas', () => ({
  uploadBlobNamed: mocks.uploadBlobNamed,
}))

vi.mock('@/components/widgets/ModelThumb.vue', () => ({
  default: {
    name: 'ModelThumb',
    props: ['src', 'alt'],
    template: '<div class="thumb-stub" :data-src="src"><slot /></div>',
  },
}))

vi.mock('@/components/stages/StageCard.vue', () => ({
  default: {
    name: 'StageCard',
    template: '<div data-testid="stage-card" />',
  },
}))

import ModelLoaderCard from './ModelLoaderCard.vue'

interface FakeWidget {
  name: string
  type?: string
  value?: unknown
  hidden?: boolean
  options?: { values?: string[] }
  callback?: (v: unknown) => void
}

function makeNode(over: { value?: string; values?: string[] } = {}) {
  const widgets: FakeWidget[] = [
    {
      name: 'model',
      type: 'combo',
      value: over.value ?? '',
      options: { values: over.values ?? ['3d/beta.glb', '3d/alpha.glb'] },
      callback: vi.fn(),
    },
    { name: 'choose file', type: 'button' },
    { name: 'project_id', type: 'text', value: '' },
  ]
  return { widgets } as any
}

function makeState(): StageState {
  return {
    kind: 'model',
    variant: 'loader',
    outputType: 'COMFYTV_MODEL',
    output: null,
    outputs: [null],
    running: false,
    inputs: [],
    mainPrompt: '',
  }
}

function renderCard(node = makeNode()) {
  const utils = renderWithPlugins(ModelLoaderCard, {
    props: {
      state: makeState(),
      node,
      onRunRequest: vi.fn(),
      onCancelRequest: vi.fn(),
      onDisconnect: vi.fn(),
      onAction: vi.fn(),
    },
  })
  return { ...utils, node }
}

beforeEach(() => {
  mocks.uploadBlobNamed.mockReset()
})

describe('ModelLoaderCard', () => {
  it('hides the native combo and button widgets', () => {
    const { node } = renderCard()
    const byName = Object.fromEntries(node.widgets.map((w: FakeWidget) => [w.name, w]))
    expect(byName['model'].hidden).toBe(true)
    expect(byName['choose file'].hidden).toBe(true)
    expect(byName['project_id'].hidden).toBeUndefined()
  })

  it('shows the pick hint when nothing is selected', () => {
    renderCard()
    expect(screen.getByText('Select a 3D model…')).toBeInTheDocument()
  })

  it('restores the saved selection and shows its basename', async () => {
    renderCard(makeNode({ value: '3d/saved.glb', values: [] }))
    expect(await screen.findByText('saved.glb')).toBeInTheDocument()
  })

  it('opens the dropdown with the sorted file grid', async () => {
    renderCard()
    await userEvent.click(screen.getByText('Select a 3D model…'))
    const tiles = screen.getAllByTitle(/^3d\//)
    expect(tiles.map((t) => t.getAttribute('title'))).toEqual(['3d/alpha.glb', '3d/beta.glb'])
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('filters files by the search query', async () => {
    renderCard()
    await userEvent.click(screen.getByText('Select a 3D model…'))
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'alpha')
    expect(screen.getByTitle('3d/alpha.glb')).toBeInTheDocument()
    expect(screen.queryByTitle('3d/beta.glb')).toBeNull()
  })

  it('picking a file writes the widget, fires its callback and closes the menu', async () => {
    const { node } = renderCard()
    await userEvent.click(screen.getByText('Select a 3D model…'))
    await userEvent.click(screen.getByTitle('3d/alpha.glb'))

    const w = node.widgets.find((x: FakeWidget) => x.name === 'model')
    expect(w.value).toBe('3d/alpha.glb')
    expect(w.callback).toHaveBeenCalledWith('3d/alpha.glb')
    await waitFor(() => expect(screen.queryByPlaceholderText(/search/i)).toBeNull())
    expect(screen.getByText('alpha.glb')).toBeInTheDocument()
  })

  it('uploads picked files into input/3d, registers and selects them', async () => {
    mocks.uploadBlobNamed.mockResolvedValue({
      name: 'new.glb', subfolder: '3d', type: 'input', url: '/view?filename=new.glb&subfolder=3d&type=input',
    })
    const { node, baseElement } = renderCard()
    await userEvent.click(screen.getByText('Select a 3D model…'))

    const input = baseElement.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['glb'], 'new.glb')
    await userEvent.upload(input, file)

    await waitFor(() => {
      const w = node.widgets.find((x: FakeWidget) => x.name === 'model')
      expect(w.value).toBe('3d/new.glb')
    })
    expect(mocks.uploadBlobNamed).toHaveBeenCalledWith(file, { subfolder: '3d', filename: 'new.glb' })
    const w = node.widgets.find((x: FakeWidget) => x.name === 'model')
    expect(w.options.values).toContain('3d/new.glb')
  })

  it('surfaces upload failures', async () => {
    mocks.uploadBlobNamed.mockRejectedValue(new Error('disk full'))
    const { baseElement } = renderCard()
    await userEvent.click(screen.getByText('Select a 3D model…'))

    const input = baseElement.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, new File(['x'], 'bad.glb'))

    expect(await screen.findByText(/disk full/)).toBeInTheDocument()
  })
})
