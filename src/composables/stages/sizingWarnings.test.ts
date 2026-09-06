import { describe, expect, it, vi } from 'vitest'

const infoMock = vi.hoisted(() => ({ info: {} as any }))
vi.mock('@/composables/stages/useWorkflowValidator', () => ({
  loadWorkflowInfo: vi.fn(async () => infoMock.info),
}))
vi.mock('@/composables/stages/stageMeta', () => ({
  getStageMeta: (cls: string) => (cls === 'ComfyTV.ImageStage' ? { workflow_kind: 'image' } : undefined),
}))

import { sizingWarnings } from './sizingWarnings'

function node(label = 'I2I') {
  return { comfyClass: 'ComfyTV.ImageStage', widgets: [{ name: 'workflow', value: label }] }
}

describe('sizingWarnings', () => {
  it('warns when the workflow binds no computed size', async () => {
    infoMock.info = { image: { I2I: { uses_computed: { width: false, height: false, length: false } } } }
    const out = await sizingWarnings(node(), { resolution: '480P', aspect_ratio: '1:1' })
    expect(out).toHaveLength(1)
    expect(out[0]).toContain("resolution/aspect_ratio will not affect workflow 'I2I'")
  })

  it('stays quiet when computed:width or height is bound, or nothing sizing-related was set', async () => {
    infoMock.info = { image: { I2I: { uses_computed: { width: true, height: true, length: false } } } }
    expect(await sizingWarnings(node(), { resolution: '480P' })).toEqual([])
    infoMock.info = { image: { I2I: { uses_computed: { width: false, height: false } } } }
    expect(await sizingWarnings(node(), { batch_size: 2 })).toEqual([])
    expect(await sizingWarnings(node(), undefined)).toEqual([])
  })

  it('stays quiet when the server does not report computed usage', async () => {
    infoMock.info = { image: { I2I: { uses: {}, requires: {}, max_inputs: {} } } }
    expect(await sizingWarnings(node(), { resolution: '480P' })).toEqual([])
  })
})
