import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import { app } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const downloadFile = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => {}))
vi.mock('@/utils/download', () => ({
  downloadFile: (...a: unknown[]) => downloadFile(...(a as [string]))
}))

import { fmtCount, useMeshOp } from './useMeshOp'

function makeWidget(name: string, value: unknown) {
  return { name, value, callback: vi.fn() }
}

function makeNode(type: string, widgets: Array<{ name: string; value: unknown }> = []) {
  return {
    id: 1,
    type,
    widgets: widgets.map((w) => makeWidget(w.name, w.value)),
    onConfigure: null as unknown
  } as any
}

function makeState() {
  return reactive({
    inputs: [] as Array<{ slot: string; source: string; content: string | null }>,
    output: null as string | null,
    outputs: [null, null] as (string | null)[]
  }) as unknown as StageState
}

function meshOpSetup(operation = 'decimate') {
  const node = makeNode('ComfyTV.MeshOpStage', [
    { name: 'operation', value: operation },
    { name: 'target_face_count', value: 5000 },
    { name: 'placement_mode', value: 'midpoint' }
  ])
  const state = makeState()
  return { node, state, api: useMeshOp(node, state) }
}

describe('fmtCount', () => {
  it('formats plain, K and M counts', () => {
    expect(fmtCount(999)).toBe('999')
    expect(fmtCount(1500)).toBe('1.5K')
    expect(fmtCount(2000)).toBe('2K')
    expect(fmtCount(1_250_000)).toBe('1.25M')
    expect(fmtCount(3_000_000)).toBe('3M')
  })
})

describe('useMeshOp: variants', () => {
  it('detects the mesh-op variant and seeds operation', () => {
    const { api } = meshOpSetup('remesh')
    expect(api.isMeshOp).toBe(true)
    expect(api.isBake).toBe(false)
    expect(api.isPrimitive).toBe(false)
    expect(api.operation.value).toBe('remesh')
  })

  it('exposes no useMeshOp controls for the primitive (it has its own rich card now)', () => {
    const prim = useMeshOp(makeNode('ComfyTV.MeshPrimitiveStage'), makeState())
    expect(prim.isPrimitive).toBe(true)
    expect(prim.operation.value).toBe('')
    expect(prim.visibleControls.value).toEqual([])
  })

  it('uses static controls for the bake variant', () => {
    const bake = useMeshOp(makeNode('ComfyTV.MeshBakeMapsStage'), makeState())
    expect(bake.isBake).toBe(true)
    expect(bake.hasMapsPanel.value).toBe(true)
  })

  it('falls back to comfyClass when type is missing', () => {
    const node = makeNode('', [])
    delete node.type
    node.comfyClass = 'ComfyTV.MeshPrimitiveStage'
    const api = useMeshOp(node, makeState())
    expect(api.isPrimitive).toBe(true)
  })
})

describe('useMeshOp: operation + controls', () => {
  it('setOperation writes the widget and switches visible controls', () => {
    const { api, node } = meshOpSetup()
    expect(api.visibleControls.value.map((c) => c.widget)).toEqual([
      'target_face_count', 'placement_mode'
    ])
    api.setOperation('weld')
    expect(widget(node, 'operation').value).toBe('weld')
    expect(api.visibleControls.value.map((c) => c.widget)).toEqual(['epsilon_rel'])
  })

  it('reveals showIf-gated controls when the guard matches', () => {
    const { api } = meshOpSetup()
    const placement = api.allControls.find((c) => c.widget === 'placement_mode')!
    api.setValue(placement, 'qem')
    expect(api.visibleControls.value.map((c) => c.widget)).toContain(
      'feature_edge_quadric_weight'
    )
  })

  it('external operation callback updates state', () => {
    const { api, node } = meshOpSetup()
    widget(node, 'operation').callback('unwrap')
    expect(api.operation.value).toBe('unwrap')
    expect(api.isUnwrap.value).toBe(true)
  })

  it('seeds values from widgets with typed fallbacks', () => {
    const { api } = meshOpSetup()
    expect(api.values.target_face_count).toBe(5000)
    expect(api.values.placement_mode).toBe('midpoint')
    expect(api.values.sign_mode).toBe('udf')
    expect(api.values.resolution).toBe(32)
  })

  it('setValue clamps, rounds ints, and rejects junk', () => {
    const { api, node } = meshOpSetup()
    const faces = api.allControls.find((c) => c.widget === 'target_face_count')!
    api.setValue(faces, '50')
    expect(api.values.target_face_count).toBe(100)
    api.setValue(faces, 2_000_000)
    expect(api.values.target_face_count).toBe(1_000_000)
    api.setValue(faces, '1234.6')
    expect(api.values.target_face_count).toBe(1235)
    expect(widget(node, 'target_face_count').value).toBe(1235)
    api.setValue(faces, 'junk')
    expect(api.values.target_face_count).toBe(1235)
  })

  it('setValue coerces bool controls', () => {
    const api = useMeshOp(makeNode('ComfyTV.MeshBakeMapsStage'), makeState())
    const bakeAo = api.allControls.find((c) => c.widget === 'bake_ao')!
    api.setValue(bakeAo, false)
    expect(api.values.bake_ao).toBe(false)
    expect(api.visibleControls.value.map((c) => c.widget)).not.toContain('ao_samples')
  })

  it('restores values and operation on node configure', () => {
    const { api, node } = meshOpSetup()
    widget(node, 'operation').value = 'subdivide'
    widget(node, 'target_face_count').value = 777
    node.onConfigure({})
    expect(api.operation.value).toBe('subdivide')
    expect(api.values.target_face_count).toBe(777)
  })
})

describe('useMeshOp: channels + preview', () => {
  it('adds the uv channel for unwrap and resets on leave', async () => {
    const { api } = meshOpSetup()
    api.setOperation('unwrap')
    expect(api.channels.value).toContain('uv')
    api.channel.value = 'uv'
    api.setOperation('decimate')
    await nextTick()
    expect(api.channels.value).not.toContain('uv')
    expect(api.channel.value).toBe('material')
  })

  it('previews the result when available, source otherwise', async () => {
    const { api, state } = meshOpSetup()
    ;(state as any).inputs = [
      { slot: 'model', source: 'upstream', content: '/view/src.glb' }
    ]
    expect(api.previewSrc.value).toBe('/view/src.glb')
    ;(state as any).output = '/view/out.glb'
    await nextTick()
    expect(api.showResult.value).toBe(true)
    expect(api.previewSrc.value).toBe('/view/out.glb')
    api.showResult.value = false
    expect(api.previewSrc.value).toBe('/view/src.glb')
  })

  it('export mode always previews the source', () => {
    const { api, state } = meshOpSetup('export')
    ;(state as any).inputs = [
      { slot: 'model', source: 'upstream', content: '/view/src.glb' }
    ]
    ;(state as any).output = '/view/out.glb'
    expect(api.isExport.value).toBe(true)
    expect(api.previewSrc.value).toBe('/view/src.glb')
  })

  it('exposes the maps url only for maps-panel variants', () => {
    const state = makeState()
    ;(state as any).outputs = [null, '/view/atlas.png']
    const bake = useMeshOp(makeNode('ComfyTV.MeshBakeMapsStage'), state)
    expect(bake.mapsUrl.value).toBe('/view/atlas.png')
    const plain = useMeshOp(makeNode('ComfyTV.MeshOpStage', [
      { name: 'operation', value: 'decimate' }
    ]), state)
    expect(plain.mapsUrl.value).toBeNull()
  })
})

describe('useMeshOp: stats', () => {
  it('routes stats to source or result and formats the line', async () => {
    const { api, state } = meshOpSetup()
    ;(state as any).inputs = [
      { slot: 'model', source: 'upstream', content: '/view/src.glb' }
    ]
    await nextTick()
    expect(api.statsLine.value).toBe('')
    api.onModelStats({ vertices: 1200, triangles: 2400 })
    expect(api.sourceStats.value).toEqual({ vertices: 1200, triangles: 2400 })
    expect(api.statsLine.value).toBe('△ 2.4K · 1.2Kv')

    ;(state as any).output = '/view/out.glb'
    await nextTick()
    api.onModelStats({ vertices: 600, triangles: 1200 })
    expect(api.resultStats.value).toEqual({ vertices: 600, triangles: 1200 })
    expect(api.statsLine.value).toBe('△ 2.4K → 1.2K')
  })

  it('clears the matching stats when a url changes', async () => {
    const { api, state } = meshOpSetup()
    ;(state as any).inputs = [
      { slot: 'model', source: 'upstream', content: '/view/src.glb' }
    ]
    api.onModelStats({ vertices: 10, triangles: 20 })
    ;(state as any).inputs = [
      { slot: 'model', source: 'upstream', content: '/view/other.glb' }
    ]
    await nextTick()
    expect(api.sourceStats.value).toBeNull()
  })
})

describe('useMeshOp: download + asset url', () => {
  it('downloads the preview, preferring the export result', async () => {
    const { api, state } = meshOpSetup('export')
    ;(state as any).inputs = [
      { slot: 'model', source: 'upstream', content: '/view/src.glb' }
    ]
    ;(state as any).output = '/view/out.glb'
    await api.onDownloadModel()
    expect(downloadFile).toHaveBeenCalledWith('/view/out.glb')
  })

  it('does nothing without a target and swallows failures', async () => {
    downloadFile.mockClear()
    const { api, state } = meshOpSetup()
    await api.onDownloadModel()
    expect(downloadFile).not.toHaveBeenCalled()
    ;(state as any).inputs = [
      { slot: 'model', source: 'upstream', content: '/view/src.glb' }
    ]
    downloadFile.mockRejectedValueOnce(new Error('nope'))
    await expect(api.onDownloadModel()).resolves.toBeUndefined()
  })

  it('assetUrl uses api.fileURL when available', () => {
    const { api } = meshOpSetup()
    expect(api.assetUrl('/x.png')).toBe('/x.png')
    const holder = app as unknown as { api: Record<string, unknown> }
    holder.api.fileURL = (p: string) => `/api${p}`
    expect(api.assetUrl('/x.png')).toBe('/api/x.png')
    delete holder.api.fileURL
  })
})

function widget(node: any, name: string) {
  return node.widgets.find((w: any) => w.name === name)
}
