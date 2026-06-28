import { describe, it, expect, vi } from 'vitest'

import {
  isComfyTVClass,
  isOutBridgeClass,
  rewriteGlobalRunOutput,
  installGlobalRunBridge,
} from './globalRunBridge'

describe('isComfyTVClass / isOutBridgeClass', () => {
  it('classifies node class types', () => {
    expect(isComfyTVClass('ComfyTV.ImageStage')).toBe(true)
    expect(isComfyTVClass('ComfyTV.BridgeFromImage')).toBe(true)
    expect(isComfyTVClass('KSampler')).toBe(false)

    expect(isOutBridgeClass('ComfyTV.BridgeFromImage')).toBe(true)
    expect(isOutBridgeClass('ComfyTV.BridgeToImage')).toBe(false)
    expect(isOutBridgeClass('ComfyTV.ImageStage')).toBe(false)
  })
})

describe('rewriteGlobalRunOutput', () => {
  const neverCalled = () => {
    throw new Error('getSnapshot should not be called')
  }

  it('keeps native nodes untouched', () => {
    const output = {
      '1': { class_type: 'KSampler', inputs: { seed: 5 } },
      '2': { class_type: 'SaveImage', inputs: { images: ['1', 0] } },
    }
    const { output: out, missing } = rewriteGlobalRunOutput(output, {
      getSnapshot: neverCalled,
    })
    expect(missing).toEqual([])
    expect(Object.keys(out).sort()).toEqual(['1', '2'])
    expect(out['2'].inputs.images).toEqual(['1', 0])
  })

  it('drops stages and into-bridges but keeps out-bridges', () => {
    const output = {
      '1': { class_type: 'ComfyTV.ImageStage', inputs: {} },
      '2': { class_type: 'ComfyTV.BridgeToImage', inputs: {} },
      '3': { class_type: 'ComfyTV.BridgeFromImage', inputs: { image: ['1', 1] } },
      '4': { class_type: 'PreviewImage', inputs: { images: ['3', 0] } },
    }
    const { output: out, missing } = rewriteGlobalRunOutput(output, {
      getSnapshot: (id, slot) =>
        id === '1' && slot === 1 ? '/view?filename=a.png&type=output' : null,
    })
    expect(missing).toEqual([])
    expect(Object.keys(out).sort()).toEqual(['3', '4'])
    expect(out['3'].inputs.image).toBe('/view?filename=a.png&type=output')
    expect(out['4'].inputs.images).toEqual(['3', 0])
  })

  it('reports out-bridges whose upstream snapshot is missing', () => {
    const output = {
      '1': { class_type: 'ComfyTV.ImageStage', inputs: {} },
      '7': {
        class_type: 'ComfyTV.BridgeFromImage',
        inputs: { image: ['1', 1] },
        _meta: { title: 'My Bridge' },
      },
    }
    const { output: out, missing } = rewriteGlobalRunOutput(output, {
      getSnapshot: () => null,
    })
    expect(missing).toEqual(['My Bridge (#7)'])
    expect(out['7'].inputs.image).toEqual(['1', 1])
  })

  it('does not mutate the original input objects', () => {
    const inputs = { image: ['1', 1] as [string, number] }
    const output = {
      '1': { class_type: 'ComfyTV.ImageStage', inputs: {} },
      '3': { class_type: 'ComfyTV.BridgeFromImage', inputs },
    }
    rewriteGlobalRunOutput(output, { getSnapshot: () => 'snap://x' })
    expect(inputs.image).toEqual(['1', 1])
  })

  it('returns empty output for a pure stage graph (no out-bridge)', () => {
    const output = {
      '1': { class_type: 'ComfyTV.TextStage', inputs: {} },
      '2': { class_type: 'ComfyTV.ImageStage', inputs: {} },
    }
    const { output: out, missing } = rewriteGlobalRunOutput(output, {
      getSnapshot: neverCalled,
    })
    expect(missing).toEqual([])
    expect(Object.keys(out)).toEqual([])
  })
})

describe('installGlobalRunBridge (end-to-end via api.queuePrompt)', () => {
  const SNAP = '/view?filename=stage.png&subfolder=&type=output'

  function makeApp() {
    const origQueue = vi.fn().mockResolvedValue({ prompt_id: 'p-123', node_errors: {} })
    const stageNode = { id: 1 }
    const graphNodes: Record<string, any> = { '1': stageNode }
    const stageState = { output: null as string | null, outputs: [null, SNAP] as (string | null)[] }
    const app: any = {
      api: { queuePrompt: origQueue },
      graph: { getNodeById: (id: any) => graphNodes[String(id)] },
    }
    const store = {
      getStage: (n: any) => (n === stageNode ? stageState : undefined),
    }
    const toast = vi.fn()
    return { app, origQueue, store, toast, stageState }
  }

  const deps = (store: any, toast: any) => ({
    resolveStore: () => store,
    toast,
    t: (k: string, p?: Record<string, unknown>) => (p ? `${k}:${JSON.stringify(p)}` : k),
  })

  function bridgeGraph() {
    return {
      output: {
        '1': { class_type: 'ComfyTV.ImageStage', inputs: { main_prompt: 'a cat' } },
        '3': {
          class_type: 'ComfyTV.BridgeFromImage',
          inputs: { image: ['1', 1] },
          _meta: { title: '← ComfyTV Image' },
        },
        '4': { class_type: 'PreviewImage', inputs: { images: ['3', 0] } },
      },
      workflow: { nodes: [], links: [], version: 0.4 },
    }
  }

  it('global Run: keeps out-bridge + native, inlines the stage snapshot, drops the stage', async () => {
    const { app, origQueue, store, toast } = makeApp()
    expect(installGlobalRunBridge(app, deps(store, toast))).toBe(true)

    const res = await app.api.queuePrompt(0, bridgeGraph(), {})

    expect(res.prompt_id).toBe('p-123')
    expect(origQueue).toHaveBeenCalledTimes(1)
    const sent = origQueue.mock.calls[0][1].output
    expect(Object.keys(sent).sort()).toEqual(['3', '4'])
    expect(sent['3'].inputs.image).toBe(SNAP)
    expect(sent['4'].inputs.images).toEqual(['3', 0])
    expect(toast).not.toHaveBeenCalled()
  })

  it('per-node Run (partialExecutionTargets) passes through untouched', async () => {
    const { app, origQueue, store, toast } = makeApp()
    installGlobalRunBridge(app, deps(store, toast))

    const data = bridgeGraph()
    await app.api.queuePrompt(0, data, { partialExecutionTargets: ['1'] })

    expect(origQueue.mock.calls[0][1]).toBe(data)
    expect(Object.keys(origQueue.mock.calls[0][1].output).sort()).toEqual(['1', '3', '4'])
    expect(toast).not.toHaveBeenCalled()
  })

  it('global Run with no snapshot yet warns and does not queue', async () => {
    const { app, origQueue, store, toast, stageState } = makeApp()
    stageState.outputs = [null, null]
    installGlobalRunBridge(app, deps(store, toast))

    const res = await app.api.queuePrompt(0, bridgeGraph(), {})

    expect(origQueue).not.toHaveBeenCalled()
    expect(res.prompt_id).toBe('')
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0].severity).toBe('warn')
    expect(toast.mock.calls[0][0].detail).toContain('← ComfyTV Image (#3)')
  })

  it('own-run marker passes through even when options are stripped by another hijacker', async () => {
    const { app, origQueue, store, toast } = makeApp()
    installGlobalRunBridge(app, deps(store, toast))

    const data: any = {
      output: { '1': { class_type: 'ComfyTV.ImageStage', inputs: {} } },
      workflow: {},
      __comfytvOwnRun: true,
    }
    const res = await app.api.queuePrompt(0, data, undefined)

    expect(origQueue).toHaveBeenCalledTimes(1)
    expect(res.prompt_id).toBe('p-123')
    expect(toast).not.toHaveBeenCalled()
    expect('__comfytvOwnRun' in origQueue.mock.calls[0][1]).toBe(false)
  })

  it('global Run on a pure stage graph informs and does not queue', async () => {
    const { app, origQueue, store, toast } = makeApp()
    installGlobalRunBridge(app, deps(store, toast))

    const res = await app.api.queuePrompt(0, {
      output: { '1': { class_type: 'ComfyTV.ImageStage', inputs: {} } },
      workflow: {},
    }, {})

    expect(origQueue).not.toHaveBeenCalled()
    expect(res.prompt_id).toBe('')
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast.mock.calls[0][0].detail).toBe('run.stagesRunPerNode')
  })

  it('is idempotent — second install is a no-op', () => {
    const { app, store, toast } = makeApp()
    const first = app.api.queuePrompt
    expect(installGlobalRunBridge(app, deps(store, toast))).toBe(true)
    const wrapped = app.api.queuePrompt
    expect(wrapped).not.toBe(first)
    expect(installGlobalRunBridge(app, deps(store, toast))).toBe(false)
    expect(app.api.queuePrompt).toBe(wrapped)
  })
})
