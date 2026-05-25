import { describe, it, expect, vi, beforeEach } from 'vitest'

async function loadModuleWithInfo(workflowInfo: any) {
  vi.resetModules()
  ;(global as any).fetch = vi.fn(async () => ({
    ok: true,
    json: async () => workflowInfo,
  }))
  return await import('./useWorkflowValidator')
}

const makeNode = (overrides: any = {}) => ({
  id: 1,
  comfyClass: 'ComfyTV.ImageStage',
  inputs: [],
  widgets: [],
  ...overrides,
})

const info = {
  image: {
    'Z-Image Turbo': {
      uses: { image: false, video: false, audio: false, text: true },
      requires: { image: false, video: false, audio: false, text: false },
      max_inputs: { image: 0, video: 0, audio: 0, text: null },
    },
    'SD1.5 I2I': {
      uses: { image: true, video: false, audio: false, text: true },
      requires: { image: true, video: false, audio: false, text: false },
      max_inputs: { image: 1, video: 0, audio: 0, text: null },
    },
    'Qwen Multi-Ref': {
      uses: { image: true, video: false, audio: false, text: true },
      requires: { image: true, video: false, audio: false, text: false },
      max_inputs: { image: 3, video: 0, audio: 0, text: null },
    },
    'Relight (with reference)': {
      // Needs 2 image inputs wired (subject + light reference)
      uses: { image: true, video: false, audio: false, text: true },
      requires: { image: true, video: false, audio: false, text: false },
      requires_count: { image: 2, video: 0, audio: 0, text: 0 },
      max_inputs: { image: 2, video: 0, audio: 0, text: null },
    },
  },
}

describe('validateNode', () => {
  beforeEach(() => vi.resetModules())

  it('returns empty when no workflow widget', async () => {
    const { validateNode } = await loadModuleWithInfo(info)
    const node = makeNode({
      inputs: [{ name: 'image', type: 'COMFYTV_IMAGE', link: 1 }],
    })
    expect(await validateNode(node, 'image')).toEqual({})
  })

  it('flags image wired into text-to-image workflow', async () => {
    const { validateNode } = await loadModuleWithInfo(info)
    const node = makeNode({
      widgets: [{ name: 'workflow', value: 'Z-Image Turbo' }],
      inputs: [{ name: 'image', type: 'COMFYTV_IMAGE', link: 1 }],
    })
    const w = await validateNode(node, 'image')
    expect(w.image?.status).toBe('wired_but_unused')
  })

  it('flags missing required image input', async () => {
    const { validateNode } = await loadModuleWithInfo(info)
    const node = makeNode({
      widgets: [{ name: 'workflow', value: 'SD1.5 I2I' }],
      inputs: [
        { name: 'image', type: 'COMFYTV_IMAGE', link: null },
      ],
    })
    const w = await validateNode(node, 'image')
    expect(w.image?.status).toBe('required_but_missing')
  })

  it('does not flag when image is wired and required', async () => {
    const { validateNode } = await loadModuleWithInfo(info)
    const node = makeNode({
      widgets: [{ name: 'workflow', value: 'SD1.5 I2I' }],
      inputs: [{ name: 'image', type: 'COMFYTV_IMAGE', link: 5 }],
    })
    expect(await validateNode(node, 'image')).toEqual({})
  })

  it('flags extra image slot when wired beyond max', async () => {
    const { validateNode } = await loadModuleWithInfo(info)

    const node = makeNode({
      widgets: [{ name: 'workflow', value: 'SD1.5 I2I' }],
      inputs: [
        { name: 'image',  type: 'COMFYTV_IMAGE', link: 1 },
        { name: 'image2', type: 'COMFYTV_IMAGE', link: 2 },
      ],
    })
    const w = await validateNode(node, 'image')

    expect(w.image2?.status).toBe('wired_but_unused')
    expect(w.image).toBeUndefined()
  })

  it('no flag when wired count matches max', async () => {
    const { validateNode } = await loadModuleWithInfo(info)
    const node = makeNode({
      widgets: [{ name: 'workflow', value: 'Qwen Multi-Ref' }],
      inputs: [
        { name: 'image1', type: 'COMFYTV_IMAGE', link: 1 },
        { name: 'image2', type: 'COMFYTV_IMAGE', link: 2 },
        { name: 'image3', type: 'COMFYTV_IMAGE', link: 3 },
      ],
    })
    expect(await validateNode(node, 'image')).toEqual({})
  })

  it('flags 2nd autogrow slot when only 1 wired but workflow needs 2', async () => {
    const { validateNode } = await loadModuleWithInfo(info)
    const node = makeNode({
      widgets: [{ name: 'workflow', value: 'Relight (with reference)' }],
      inputs: [
        { name: 'images.image0', type: 'COMFYTV_IMAGE', link: 1 },
        { name: 'images.image1', type: 'COMFYTV_IMAGE', link: null },
      ],
    })
    const w = await validateNode(node, 'image')
    expect(w['images.image1']?.status).toBe('required_but_missing')
    expect(w['images.image1']?.message).toContain('2 image inputs')
    expect(w['images.image1']?.message).toContain('1/2')
    expect(w['images.image0']).toBeUndefined()
  })

  it('no flag when both required slots are wired', async () => {
    const { validateNode } = await loadModuleWithInfo(info)
    const node = makeNode({
      widgets: [{ name: 'workflow', value: 'Relight (with reference)' }],
      inputs: [
        { name: 'images.image0', type: 'COMFYTV_IMAGE', link: 1 },
        { name: 'images.image1', type: 'COMFYTV_IMAGE', link: 2 },
      ],
    })
    expect(await validateNode(node, 'image')).toEqual({})
  })

  it('unknown workflow label returns empty', async () => {
    const { validateNode } = await loadModuleWithInfo(info)
    const node = makeNode({
      widgets: [{ name: 'workflow', value: 'Mystery' }],
      inputs: [{ name: 'image', type: 'COMFYTV_IMAGE', link: 1 }],
    })
    expect(await validateNode(node, 'image')).toEqual({})
  })

  it('ignores empty workflow label', async () => {
    const { validateNode } = await loadModuleWithInfo(info)
    const node = makeNode({
      widgets: [{ name: 'workflow', value: '' }],
      inputs: [{ name: 'image', type: 'COMFYTV_IMAGE', link: 1 }],
    })
    expect(await validateNode(node, 'image')).toEqual({})
  })

  it('unknown socket type is ignored', async () => {
    const { validateNode } = await loadModuleWithInfo(info)
    const node = makeNode({
      widgets: [{ name: 'workflow', value: 'Z-Image Turbo' }],
      inputs: [{ name: 'thing', type: 'WEIRD', link: 1 }],
    })
    expect(await validateNode(node, 'image')).toEqual({})
  })
})


describe('invalidateWorkflowInfo', () => {
  it('clears cached info so next call refetches', async () => {
    const { loadWorkflowInfo, invalidateWorkflowInfo } = await loadModuleWithInfo(info)
    await loadWorkflowInfo()
    expect((global as any).fetch).toHaveBeenCalledTimes(1)
    await loadWorkflowInfo()
    expect((global as any).fetch).toHaveBeenCalledTimes(1)  // cached
    invalidateWorkflowInfo()
    await loadWorkflowInfo()
    expect((global as any).fetch).toHaveBeenCalledTimes(2)
  })
})


describe('applySlotWarnings', () => {
  beforeEach(() => vi.resetModules())

  it('sets hasErrors + tooltip on flagged inputs', async () => {
    const { applySlotWarnings } = await loadModuleWithInfo(info)
    const node = makeNode({
      _comfytvSlotWarnings: {
        image: { status: 'wired_but_unused', message: 'oops' },
      },
      inputs: [
        { name: 'image', type: 'COMFYTV_IMAGE', link: 1 },
        { name: 'text',  type: 'COMFYTV_TEXT',  link: null },
      ],
    })
    applySlotWarnings(node)
    expect(node.inputs[0].hasErrors).toBe(true)
    expect(node.inputs[0].tooltip).toBe('oops')
    expect(node.inputs[1].hasErrors).toBe(false)
  })

  it('strips legacy ⚠ prefix on labels', async () => {
    const { applySlotWarnings } = await loadModuleWithInfo(info)
    const node = makeNode({
      _comfytvSlotWarnings: {},
      inputs: [{ name: 'image', label: '⚠ image', link: 1 }],
    })
    applySlotWarnings(node)
    expect(node.inputs[0].label).toBeUndefined()
  })

  it('strips legacy warn colors', async () => {
    const { applySlotWarnings } = await loadModuleWithInfo(info)
    const node = makeNode({
      _comfytvSlotWarnings: {},
      inputs: [{ name: 'image', color_off: '#ff6b6b', color_on: '#ffb84d' }],
    })
    applySlotWarnings(node)
    expect(node.inputs[0].color_off).toBeUndefined()
    expect(node.inputs[0].color_on).toBeUndefined()
  })

  it('clears prior tooltip when no longer warned', async () => {
    const { applySlotWarnings } = await loadModuleWithInfo(info)
    const node = makeNode({
      _comfytvSlotWarnings: {},
      inputs: [{ name: 'image', tooltip: 'previous', hasErrors: true }],
    })
    applySlotWarnings(node)
    expect(node.inputs[0].tooltip).toBeUndefined()
    expect(node.inputs[0].hasErrors).toBe(false)
  })
})
