import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

const h = vi.hoisted(() => ({
  persistModelThumbnail: vi.fn(),
  fileURL: vi.fn((p: string) => `/files/${p}`),
}))

vi.mock('@/api/nativeAssets', () => ({
  persistModelThumbnail: h.persistModelThumbnail,
}))

vi.mock('@/lib/comfyApp', () => ({
  app: { get api() { return { fileURL: h.fileURL } } },
}))

import { DEFAULT_MATERIAL, type MaterialParams } from '@/widgets/material/types'
import {
  collectPartMeshes,
  computeModelStats,
  fetchModelBytes,
  modelAssetUrl,
  pickNdc,
  urlFilename,
  useModelPreview,
  type ModelPreviewEmit,
  type ModelPreviewHost,
  type ModelPreviewPartProps,
} from './useModelPreview'

function makeEmit() {
  const events: Record<string, unknown[][]> = {}
  const emit = ((e: string, ...args: unknown[]) => {
    ;(events[e] ??= []).push(args)
  }) as ModelPreviewEmit
  return { emit, events }
}

function makeHost(over: Partial<ModelPreviewHost> = {}): ModelPreviewHost {
  return {
    getCamera: () => null,
    getModelRoot: () => null,
    getCanvasRect: () => null,
    renderThumbnail: () => null,
    ...over,
  }
}

function makeModel() {
  const root = new THREE.Group()
  const material = new THREE.MeshStandardMaterial()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material)
  mesh.name = 'body'
  root.add(mesh)
  root.updateMatrixWorld(true)
  return { root, mesh, material }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('urlFilename', () => {
  it('prefers the filename query parameter', () => {
    expect(urlFilename('/view?filename=a.splat&subfolder=3d')).toBe('a.splat')
  })

  it('falls back to the last path segment', () => {
    expect(urlFilename('/models/sub/mesh.glb')).toBe('mesh.glb')
  })
})

describe('modelAssetUrl', () => {
  it('routes through api.fileURL when available', () => {
    expect(modelAssetUrl('/view?filename=a.glb')).toBe('/files//view?filename=a.glb')
  })
})

describe('fetchModelBytes', () => {
  it('returns the array buffer on success', async () => {
    const buf = new ArrayBuffer(4)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => buf })))
    await expect(fetchModelBytes('/view?filename=a.glb')).resolves.toBe(buf)
  })

  it('throws with the HTTP status on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    await expect(fetchModelBytes('/broken')).rejects.toThrow('HTTP 404')
  })
})

describe('collectPartMeshes', () => {
  it('keys meshes by name, deduplicates with #n and stamps userData', () => {
    const root = new THREE.Group()
    const a = new THREE.Mesh(new THREE.BufferGeometry())
    a.name = 'arm'
    const b = new THREE.Mesh(new THREE.BufferGeometry())
    b.name = 'arm'
    const c = new THREE.Mesh(new THREE.BufferGeometry())
    root.add(a, b, c)
    const map = collectPartMeshes(root)
    expect([...map.keys()]).toEqual(['arm', 'arm#2', 'mesh'])
    expect(a.userData.comfytvPartKey).toBe('arm')
    expect(b.userData.comfytvPartKey).toBe('arm#2')
    expect(c.userData.comfytvPartKey).toBe('mesh')
  })
})

describe('computeModelStats', () => {
  it('counts vertices and triangles for indexed and non-indexed geometry', () => {
    const indexed = new THREE.BufferGeometry()
    indexed.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3))
    indexed.setIndex([0, 1, 2, 0, 2, 3])
    const plain = new THREE.BufferGeometry()
    plain.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3))
    const meshes = [new THREE.Mesh(indexed), new THREE.Mesh(plain)]
    expect(computeModelStats(meshes)).toEqual({ vertices: 7, triangles: 3 })
  })
})

describe('pickNdc', () => {
  it('maps client coordinates to normalized device coordinates', () => {
    const ndc = pickNdc(75, 25, { left: 0, top: 0, width: 100, height: 100 })
    expect(ndc?.x).toBeCloseTo(0.5)
    expect(ndc?.y).toBeCloseTo(0.5)
  })

  it('returns null for a degenerate rect', () => {
    expect(pickNdc(0, 0, { left: 0, top: 0, width: 0, height: 100 })).toBeNull()
  })
})

describe('useModelPreview', () => {
  let props: ModelPreviewPartProps

  beforeEach(() => {
    h.persistModelThumbnail.mockReset().mockResolvedValue(undefined)
    props = reactive<ModelPreviewPartProps>({ pickable: true })
  })

  it('registerParts emits part keys and model stats', () => {
    const { emit, events } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost())
    const { root } = makeModel()
    mp.registerParts(root)
    expect(events['parts-changed']).toEqual([[['body']]])
    expect(events['model-stats'][0][0]).toEqual({ vertices: 24, triangles: 12 })
  })

  it('disposeParts clears bookkeeping and emits an empty part list', () => {
    const { emit, events } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost())
    mp.registerParts(makeModel().root)
    mp.disposeParts()
    expect(events['parts-changed']).toEqual([[['body']], [[]]])
  })

  it('applies bound part materials and restores originals when unbound', async () => {
    const { emit, events } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost())
    const { root, mesh, material } = makeModel()
    mp.registerParts(root)

    props.partMaterials = { body: { ...DEFAULT_MATERIAL, color: '#ff0000' } }
    mp.applyPartMaterials(true)
    expect(mesh.material).toBeInstanceOf(THREE.MeshPhysicalMaterial)
    expect((mesh.material as THREE.MeshPhysicalMaterial).color.getHexString()).toBe('ff0000')
    expect(events['view-changed']).toHaveLength(1)

    props.partMaterials = {}
    await nextTick()
    expect(mesh.material).toBe(material)
    expect(events['view-changed']).toHaveLength(2)
  })

  it('skips re-applying an unchanged material signature', () => {
    const { emit, events } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost())
    mp.registerParts(makeModel().root)
    props.partMaterials = { body: { ...DEFAULT_MATERIAL } as MaterialParams }
    mp.applyPartMaterials()
    mp.applyPartMaterials()
    expect(events['view-changed']).toHaveLength(1)
    mp.applyPartMaterials(true)
    expect(events['view-changed']).toHaveLength(2)
  })

  it('highlights the selected part with an emissive clone and restores it', async () => {
    const { emit } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost())
    const { root, mesh, material } = makeModel()
    mp.registerParts(root)

    props.selectedPart = 'body'
    await nextTick()
    expect(mesh.material).not.toBe(material)
    expect((mesh.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x4ea8ff)
    expect((mesh.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeCloseTo(0.45)

    props.selectedPart = null
    await nextTick()
    expect(mesh.material).toBe(material)
  })

  it('suspendHighlight removes the highlight and the restorer reinstates it', () => {
    const { emit } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost())
    const { root, mesh, material } = makeModel()
    mp.registerParts(root)
    mp.setHighlight('body')
    const highlighted = mesh.material
    expect(highlighted).not.toBe(material)

    const restore = mp.suspendHighlight()
    expect(mesh.material).toBe(material)
    restore()
    expect(mesh.material).not.toBe(material)
  })

  it('does not highlight outside the material channel', () => {
    props.channel = 'clay'
    const { emit } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost())
    const { root, mesh, material } = makeModel()
    mp.registerParts(root)
    mp.setHighlight('body')
    expect(mesh.material).toBe(material)
  })

  it('emits the picked part key on a click hit', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 5)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld(true)
    const { root } = makeModel()
    const { emit, events } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost({
      getCamera: () => camera,
      getModelRoot: () => root,
      getCanvasRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    }))
    mp.registerParts(root)

    mp.onPickDown({ button: 0, clientX: 50, clientY: 50 } as PointerEvent)
    mp.onPickUp({ clientX: 50, clientY: 50 } as PointerEvent)
    expect(events['part-pick']).toEqual([['body']])

    mp.onPickDown({ button: 0, clientX: 2, clientY: 2 } as PointerEvent)
    mp.onPickUp({ clientX: 2, clientY: 2 } as PointerEvent)
    expect(events['part-pick']).toEqual([['body'], [null]])
  })

  it('ignores drags beyond the click threshold and non-pickable hosts', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 5)
    camera.updateMatrixWorld(true)
    const { root } = makeModel()
    const { emit, events } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost({
      getCamera: () => camera,
      getModelRoot: () => root,
      getCanvasRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    }))
    mp.registerParts(root)

    mp.onPickDown({ button: 0, clientX: 50, clientY: 50 } as PointerEvent)
    mp.onPickUp({ clientX: 60, clientY: 50 } as PointerEvent)
    expect(events['part-pick']).toBeUndefined()

    props.pickable = false
    mp.onPickDown({ button: 0, clientX: 50, clientY: 50 } as PointerEvent)
    mp.onPickUp({ clientX: 50, clientY: 50 } as PointerEvent)
    expect(events['part-pick']).toBeUndefined()
  })

  it('persists a thumbnail after the settle delay', async () => {
    vi.useFakeTimers()
    const canvas = document.createElement('canvas')
    ;(canvas as any).toBlob = (cb: (b: Blob | null) => void) => cb(new Blob(['png']))
    const renderThumbnail = vi.fn(() => canvas)
    const { emit } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost({ renderThumbnail }))

    mp.scheduleThumbnailPersist('/view?filename=a.glb')
    await vi.advanceTimersByTimeAsync(50)
    expect(h.persistModelThumbnail).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(600)
    expect(renderThumbnail).toHaveBeenCalledWith(256)
    expect(h.persistModelThumbnail).toHaveBeenCalledTimes(1)
    expect(h.persistModelThumbnail.mock.calls[0][0]).toBe('/view?filename=a.glb')
    expect(h.persistModelThumbnail.mock.calls[0][1]).toBeInstanceOf(Blob)
  })

  it('drops a pending thumbnail when a new load begins or on teardown', async () => {
    vi.useFakeTimers()
    const renderThumbnail = vi.fn(() => null)
    const { emit } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost({ renderThumbnail }))

    mp.scheduleThumbnailPersist('/a')
    mp.beginLoad()
    await vi.advanceTimersByTimeAsync(700)
    expect(renderThumbnail).not.toHaveBeenCalled()

    mp.scheduleThumbnailPersist('/b')
    mp.teardown()
    await vi.advanceTimersByTimeAsync(700)
    expect(renderThumbnail).not.toHaveBeenCalled()
  })

  it('tracks load staleness through beginLoad', () => {
    const { emit } = makeEmit()
    const mp = useModelPreview(props, emit, makeHost())
    const seq = mp.beginLoad()
    expect(mp.isStale(seq)).toBe(false)
    mp.beginLoad()
    expect(mp.isStale(seq)).toBe(true)
  })
})
