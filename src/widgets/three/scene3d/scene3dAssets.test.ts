import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchApi = vi.hoisted(() => vi.fn())

vi.mock('@/lib/comfyApp', () => ({
  app: {
    api: {
      fetchApi,
      fileURL: (path: string) => `/base${path}`
    }
  }
}))

vi.stubGlobal('fetch', fetchApi)

const splatInstances = vi.hoisted(() => [] as any[])

vi.mock('@sparkjsdev/spark', async () => {
  const THREE = await import('three')
  class SplatMesh extends THREE.Object3D {
    initialized = Promise.resolve()
    disposed = false
    opts: unknown
    constructor(opts: unknown) {
      super()
      this.opts = opts
      splatInstances.push(this)
    }
    dispose() {
      this.disposed = true
    }
  }
  class PlyReader {
    elements = {}
    async parseHeader() {}
  }
  return { SplatMesh, PlyReader }
})

function jsonResponse(data: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  return {
    ok: true,
    status: 200,
    json: async () => data,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  }
}

async function importModule() {
  vi.resetModules()
  return import('./scene3dAssets')
}

const VALID_MANIFEST = {
  version: 1,
  characters: [
    {
      id: 'human',
      name: 'Human',
      animations: ['animations/human-base-animations.glb']
    },
    { id: 'fox', name: 'Fox', animations: ['animations/fox-animations.glb'] }
  ]
}

describe('fetchScene3dManifest', () => {
  beforeEach(() => {
    fetchApi.mockReset()
  })

  it('returns validated character entries', async () => {
    fetchApi.mockResolvedValue(jsonResponse(VALID_MANIFEST))
    const { fetchScene3dManifest } = await importModule()
    const entries = await fetchScene3dManifest()
    expect(entries.map((entry) => entry.id)).toEqual(['human', 'fox'])
    expect(fetchApi).toHaveBeenCalledWith('/base/comfytv/scene3d/manifest.json')
  })

  it('filters malformed entries and path traversal', async () => {
    fetchApi.mockResolvedValue(
      jsonResponse({
        characters: [
          { id: 'ok', name: 'Ok', animations: ['a.glb'] },
          { id: 'body', name: 'Body', animations: ['a.glb'], model: 'models/b.glb' },
          { id: 'evilmodel', name: 'EvilModel', animations: ['a.glb'], model: '../key' },
          { id: 'evil', name: 'Evil', animations: ['../../etc/passwd'] },
          { id: 'empty', name: 'Empty', animations: [] },
          { name: 'NoId', animations: ['b.glb'] }
        ]
      })
    )
    const { fetchScene3dManifest } = await importModule()
    const entries = await fetchScene3dManifest()
    expect(entries.map((entry) => entry.id)).toEqual(['ok', 'body'])
  })

  it('resolves to an empty list when the pack is not installed (404)', async () => {
    fetchApi.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({})
    })
    const { fetchScene3dManifest } = await importModule()
    await expect(fetchScene3dManifest()).resolves.toEqual([])
  })

  it('caches the manifest across calls but retries after failure', async () => {
    fetchApi.mockRejectedValueOnce(new Error('offline'))
    fetchApi.mockResolvedValue(jsonResponse(VALID_MANIFEST))
    const { fetchScene3dManifest } = await importModule()
    await expect(fetchScene3dManifest()).resolves.toEqual([])
    await expect(fetchScene3dManifest()).resolves.toHaveLength(2)
    await fetchScene3dManifest()
    expect(fetchApi).toHaveBeenCalledTimes(2)
  })
})

describe('loadCharacterAssets', () => {
  it('rejects unknown models', async () => {
    fetchApi.mockResolvedValue(jsonResponse(VALID_MANIFEST))
    const { loadCharacterAssets } = await importModule()
    await expect(loadCharacterAssets('dragon')).rejects.toThrow(
      'Unknown scene3d character model: dragon'
    )
  })
})

describe('stripNonPelvisTranslations', () => {
  it('keeps quaternion tracks and pelvis translation only', async () => {
    const THREE = await import('three')
    const { stripNonPelvisTranslations } = await importModule()
    const clip = new THREE.AnimationClip('Walk', 1, [
      new THREE.VectorKeyframeTrack('pelvis.position', [0, 1], [0, 0, 0, 0, 1, 0]),
      new THREE.VectorKeyframeTrack('clavicle_l.position', [0, 1], [0, 0, 0, 1, 0, 0]),
      new THREE.QuaternionKeyframeTrack('clavicle_l.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
      new THREE.VectorKeyframeTrack('spine_01.scale', [0, 1], [1, 1, 1, 1, 1, 1])
    ])
    const [stripped] = stripNonPelvisTranslations([clip])
    expect(stripped.tracks.map((track) => track.name)).toEqual([
      'pelvis.position',
      'clavicle_l.quaternion',
      'spine_01.scale'
    ])
    expect(stripped.name).toBe('Walk')
    expect(stripped.duration).toBe(1)
  })
})

describe('loadSceneModelInstance', () => {
  beforeEach(() => {
    fetchApi.mockReset()
    splatInstances.length = 0
  })

  it('loads splat urls via spark, tags the root and disposes cleanly', async () => {
    fetchApi.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8)
    })
    const { loadSceneModelInstance } = await importModule()
    const inst = await loadSceneModelInstance(
      '/view?filename=a.spz&subfolder=3d&type=output'
    )
    expect(inst.kind).toBe('splat')
    expect(inst.clips).toEqual([])
    expect(inst.root.userData.comfytvSplat).toBe(true)
    expect(splatInstances).toHaveLength(1)
    expect(splatInstances[0].quaternion.x).toBe(1)
    expect(splatInstances[0].quaternion.w).toBe(0)
    expect((splatInstances[0].opts as any).fileName).toBe('a.spz')
    inst.dispose?.()
    expect(splatInstances[0].disposed).toBe(true)
    expect(fetchApi).toHaveBeenCalledWith(
      '/base/view?filename=a.spz&subfolder=3d&type=output'
    )
  })

  it('rejects when the splat fetch fails', async () => {
    fetchApi.mockResolvedValue({ ok: false, status: 404 })
    const { loadSceneModelInstance } = await importModule()
    await expect(
      loadSceneModelInstance('/view?filename=a.spz')
    ).rejects.toThrow('HTTP 404')
  })
})
