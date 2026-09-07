import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const project = vi.hoisted(() => ({
  currentProjectId: 'p1',
  fetchLatestOutput: vi.fn(),
  adoptOutputs: vi.fn(),
  tagOutputStageUid: vi.fn(),
}))
vi.mock('@/stores/projectStore', () => ({ useProjectStore: () => project }))
const store: any = {
  setOutputSlot: (state: any, slot: number, value: any) => {
    state.outputs[slot] = value
    if (slot === 0) state.output = value
  },
}

import { bindOutputRestore } from './stageRestore'

function makeState() {
  return reactive({ outputId: null as number | null, output: null as string | null, outputs: [null, null] as any[], durationMs: null, pickedIndex: 1, inputs: [] })
}

function makeNode(fromSave = true) {
  return {
    id: 5,
    comfyClass: 'ComfyTV.ImageStage',
    widgets: [{ name: 'project_id', value: '' }],
    properties: { comfytv_stage_uid: 'uid-5' },
    __comfytvFromSave: fromSave,
  }
}

async function flush() {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0))
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('restoreLatestOutput', () => {
  it('prefers a newer untagged run over the older uid-tagged output', async () => {
    project.fetchLatestOutput.mockResolvedValue({ id: 1745, payload_url: '/old' })
    project.adoptOutputs.mockResolvedValue({ id: 1750, payload_url: '/newest' })
    const state = makeState()
    bindOutputRestore({ node: makeNode(), state, store, kind: 'image', variant: 'generator' })
    await flush()
    expect(project.adoptOutputs.mock.calls[0].slice(0, 4)).toEqual(['p1', '5', 'ImageStage', 'uid-5'])
    expect(project.adoptOutputs.mock.calls[0][5]).toBeNull()
    expect(state.outputId).toBe(1750)
    expect(state.output).toBe('/newest')
  })

  it('keeps the uid-tagged output when the adoptable orphan is older', async () => {
    project.fetchLatestOutput.mockResolvedValue({ id: 1760, payload_url: '/tagged-latest' })
    project.adoptOutputs.mockResolvedValue({ id: 1750, payload_url: '/older-orphan' })
    const state = makeState()
    bindOutputRestore({ node: makeNode(), state, store, kind: 'image', variant: 'generator' })
    await flush()
    expect(state.outputId).toBe(1760)
  })

  it('passes the recorded claim time as since when the node has one', async () => {
    project.fetchLatestOutput.mockResolvedValue(null)
    project.adoptOutputs.mockResolvedValue(null)
    const node: any = makeNode()
    node.properties.comfytv_stage_uid_at = '2026-09-06T10:00:00.000Z'
    bindOutputRestore({ node, state: makeState(), store, kind: 'image', variant: 'generator' })
    await flush()
    expect(project.adoptOutputs.mock.calls[0][5]).toBe('2026-09-06T10:00:00.000Z')
  })

  it('does not adopt for freshly created stages', async () => {
    project.fetchLatestOutput.mockResolvedValue(null)
    bindOutputRestore({ node: makeNode(false), state: makeState(), store, kind: 'image', variant: 'generator' })
    await flush()
    expect(project.adoptOutputs).not.toHaveBeenCalled()
  })
})
