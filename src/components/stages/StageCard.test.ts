import { screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { renderWithPlugins } from '@/__tests__/renderHelpers'
import { clearStageDefaultsCache } from '@/composables/stages/useStagePresets'
import type { StageState } from '@/stores/stageStore'

vi.mock('./MainPromptInput.vue', () => ({
  default: defineComponent({ render: () => h('div', { class: 'stub-main-prompt' }) }),
}))

const fetchStageDefaults = vi.fn()
const listStagePresets = vi.fn()
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return {
    ...actual,
    fetchStageDefaults: (...a: unknown[]) => fetchStageDefaults(...a),
    listStagePresets: (...a: unknown[]) => listStagePresets(...a),
  }
})

function makeState(over: Partial<StageState> = {}): StageState {
  return {
    kind: 'image',
    variant: 'generator',
    outputType: 'COMFYTV_IMAGE',
    output: null,
    outputs: [null],
    running: false,
    inputs: [],
    mainPrompt: '',
    ...over,
  } as StageState
}

function renderCard(state: StageState, extraProps: Record<string, unknown> = {}) {
  return renderWithPlugins(StageCard, {
    stubActions: false,
    props: {
      state,
      node: { widgets: [] },
      onRunRequest: vi.fn(),
      onCancelRequest: vi.fn(),
      onDisconnect: vi.fn(),
      onAction: vi.fn(),
      ...extraProps,
    },
  })
}

const { default: StageCard } = await import('./StageCard.vue')

describe('StageCard — base states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearStageDefaultsCache()
    fetchStageDefaults.mockResolvedValue({ defaults: {} })
    listStagePresets.mockResolvedValue({ presets: [] })
  })

  it('renders an enabled run button even when the stage has no prompt and no inputs', () => {
    renderCard(makeState())
    const btn = document.querySelector('.run-btn') as HTMLButtonElement
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
  })

  it('disables the run button while the workflow is preparing', () => {
    renderCard(makeState({ preparingWorkflow: true }))
    const btn = document.querySelector('.run-btn') as HTMLButtonElement
    expect(btn).toBeDisabled()
  })

  it('enables the run button once a prompt is set', () => {
    renderCard(makeState({ mainPrompt: 'a cat' }))
    const btn = document.querySelector('.run-btn') as HTMLButtonElement
    expect(btn).not.toBeDisabled()
  })

  it('shows the cancel button while running', () => {
    renderCard(makeState({ running: true }))
    expect(screen.getByText(/cancel|⏹/i)).toBeInTheDocument()
  })

  it('shows the "preparing workflow" label when state.preparingWorkflow is set', () => {
    renderCard(makeState({ preparingWorkflow: true }))
    expect(screen.getByText(/preparing|⏳/i)).toBeInTheDocument()
  })

  it('shows the rerun label when state already has an output', () => {
    const { container } = renderCard(makeState({ output: '/view?filename=x.png' }))
    expect(screen.getByText(/re-?run/i)).toBeInTheDocument()
    expect(container.querySelector('.run-btn .pi-refresh')).toBeInTheDocument()
  })

  it('renders an error banner when state.error is set', () => {
    const { container } = renderCard(makeState({
      error: { message: 'boom', type: 'BackendCrash' },
    }))
    expect(container.querySelector('.error-row')).toBeInTheDocument()
    expect(screen.getByText(/boom/)).toBeInTheDocument()
    expect(screen.getByText(/BackendCrash:/)).toBeInTheDocument()
  })

  it('shows a Cancelled banner with the dedicated styling', () => {
    const { container } = renderCard(makeState({
      error: { message: 'user cancelled', type: 'Cancelled' },
    }))
    const banner = container.querySelector('.error-row.is-cancel-banner')
    expect(banner).toBeInTheDocument()
    expect(banner?.querySelector('.pi-stop-circle')).toBeInTheDocument()
  })

  it('hides the run button for loader stages', () => {
    renderCard(makeState({ variant: 'loader', kind: 'image' }))
    const runBtns = document.querySelectorAll('.run-btn')
    expect(runBtns).toHaveLength(0)
  })

  it('hides the run button for image-picker kind', () => {
    renderCard(makeState({ kind: 'image-picker' }))
    const runBtns = document.querySelectorAll('.run-btn')
    expect(runBtns).toHaveLength(0)
  })

  it('fires onRunRequest when the run button is clicked (prompt makes it runnable)', async () => {
    const onRunRequest = vi.fn()
    renderCard(makeState({ mainPrompt: 'a cat' }), { onRunRequest })
    await userEvent.click(document.querySelector('.run-btn') as HTMLButtonElement)
    expect(onRunRequest).toHaveBeenCalledTimes(1)
  })

  it('fires onCancelRequest when the cancel button is clicked while running', async () => {
    const onCancelRequest = vi.fn()
    renderCard(makeState({ running: true }), { onCancelRequest })
    await userEvent.click(document.querySelector('.run-btn.is-cancel') as HTMLButtonElement)
    expect(onCancelRequest).toHaveBeenCalledTimes(1)
  })

  it('shows a progress bar with the right fill % while running', () => {
    const { container } = renderCard(makeState({
      running: true,
      progress: { value: 3, max: 10, text: 'step 3 / 10' },
    }))
    const fill = container.querySelector('.progress-fill') as HTMLElement
    expect(fill.style.width).toBe('30%')
    expect(screen.getByText('step 3 / 10')).toBeInTheDocument()
  })

  it('renders the action toolbar only after an output exists', () => {
    const { container, rerender } = renderCard(makeState({ kind: 'image' }))
    expect(container.querySelector('.action-list')).toBeNull()

    void rerender({
      state: makeState({ kind: 'image', output: '/view?x=1' }),
      node: { widgets: [] },
      onRunRequest: vi.fn(),
      onCancelRequest: vi.fn(),
      onDisconnect: vi.fn(),
      onAction: vi.fn(),
    })
    return Promise.resolve().then(() => {
      expect(container.querySelector('.action-list')).toBeInTheDocument()
    })
  })

  it('hideOutput=true suppresses the output section', () => {
    const { container } = renderCard(makeState({ output: 'foo' }), { hideOutput: true })
    expect(container.querySelector('.output')).toBeNull()
  })
})

describe('StageCard — preset bar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearStageDefaultsCache()
    fetchStageDefaults.mockResolvedValue({ defaults: {} })
    listStagePresets.mockResolvedValue({ presets: [] })
  })

  it('renders the preset bar for nodes with hidden config widgets', async () => {
    fetchStageDefaults.mockResolvedValue({ defaults: { exposure: 0, temperature: 6500 } })
    listStagePresets.mockResolvedValue({ presets: [
      { id: 1, kind: 'ComfyTV.VideoColorStage', name: 'warm', config: { exposure: 0.5 }, created_at: null },
    ] })
    const { container } = renderCard(makeState(), {
      node: {
        comfyClass: 'ComfyTV.VideoColorStage',
        widgets: [{ name: 'exposure', value: 0 }, { name: 'temperature', value: 6500 }],
      },
    })
    await waitFor(() => {
      expect(container.querySelector('.ctv-preset-bar')).toBeInTheDocument()
    })
    expect(fetchStageDefaults).toHaveBeenCalledWith('ComfyTV.VideoColorStage')
    expect(container.querySelector('.ctv-preset-save')).toBeInTheDocument()
    expect(container.querySelector('.ctv-preset-reset')).toBeInTheDocument()
    expect(container.querySelector('.ctv-preset-delete')).toBeNull()
    expect(container.querySelector('.ctv-preset-bar')!.textContent).toContain('Custom')
  })

  it('hides the preset bar when the node type has no config widgets', async () => {
    const { container } = renderCard(makeState(), {
      node: { comfyClass: 'ComfyTV.ImagePickerStage', widgets: [] },
    })
    await waitFor(() => {
      expect(fetchStageDefaults).toHaveBeenCalledWith('ComfyTV.ImagePickerStage')
    })
    expect(container.querySelector('.ctv-preset-bar')).toBeNull()
  })

  it('hides the preset bar when there is no node', () => {
    const { container } = renderCard(makeState(), { node: undefined })
    expect(container.querySelector('.ctv-preset-bar')).toBeNull()
    expect(fetchStageDefaults).not.toHaveBeenCalled()
  })
})
