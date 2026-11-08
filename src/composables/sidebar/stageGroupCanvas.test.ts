import { beforeEach, describe, expect, it, vi } from 'vitest'

const canvas: any = vi.hoisted(() => ({}))
vi.mock('@/lib/comfyApp', () => ({ app: { canvas } }))

import { insertStageGroup, serializeSelectedStages } from './stageGroupCanvas'

describe('stageGroupCanvas', () => {
  beforeEach(() => {
    canvas.selectedItems = new Set([{}])
    canvas._serializeItems = () => ({
      nodes: [{ id: 1, type: 'ComfyTV.TextStage', properties: { comfytv_stage_uid: 'u1', comfytv_stage_uid_at: 't', comfytv_media: {} } }],
      links: [],
    })
    canvas._deserializeItems = vi.fn()
    canvas.setDirty = vi.fn()
  })

  it('strips stage identity from the saved selection', () => {
    const data: any = serializeSelectedStages()
    expect(data.nodes[0].properties).toEqual({ comfytv_media: {} })
  })

  it('returns null without a selection', () => {
    canvas.selectedItems = new Set()
    expect(serializeSelectedStages()).toBeNull()
  })

  it('pastes a copy of the group at the given position', () => {
    const data = { nodes: [{ id: 1 }], links: [] }
    insertStageGroup(data, [10, 20])
    const [items, opts] = canvas._deserializeItems.mock.calls[0]
    expect(items).toEqual(data)
    expect(items).not.toBe(data)
    expect(opts).toEqual({ position: [10, 20] })
  })
})
