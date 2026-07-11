import { screen, waitFor } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

import { renderWithPlugins } from '@/__tests__/renderHelpers'

const h = vi.hoisted(() => ({
  classifyModelBytes: vi.fn(),
  buildPointCloud: vi.fn(),
  loadSpark: vi.fn(),
  loadCustomModelAssets: vi.fn(),
  persistModelThumbnail: vi.fn(),
  guard: vi.fn(),
  guardDispose: vi.fn(),
  viewInstances: [] as any[],
  controlsInstances: [] as any[],
}))

vi.mock('@/widgets/three/modelFormats', () => ({
  classifyModelBytes: h.classifyModelBytes,
  buildPointCloud: h.buildPointCloud,
  loadSpark: h.loadSpark,
}))

vi.mock('@/widgets/three/scene3d/scene3dAssets', () => ({
  loadCustomModelAssets: h.loadCustomModelAssets,
}))

vi.mock('@/api/nativeAssets', () => ({
  persistModelThumbnail: h.persistModelThumbnail,
}))

vi.mock('@/widgets/three/orbitControlsGuard', () => ({
  guardOrbitControlsDragEnd: h.guard,
}))

vi.mock('three/examples/jsm/utils/SkeletonUtils.js', () => ({
  clone: (obj: unknown) => obj,
}))

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
  class OrbitControls {
    enableDamping = false
    target = { copy: vi.fn() }
    listeners: Record<string, Array<() => void>> = {}
    update = vi.fn()
    dispose = vi.fn()
    addEventListener = (ev: string, fn: () => void) => {
      ;(this.listeners[ev] ??= []).push(fn)
    }
    constructor(
      public camera: unknown,
      public element: unknown,
    ) {
      h.controlsInstances.push(this)
    }
  }
  return { OrbitControls }
})

vi.mock('@/widgets/three/RendererView', () => {
  class RendererView {
    canvas = document.createElement('canvas')
    state: Record<string, unknown> = {}
    renderer = { __shared: true }
    setSize = vi.fn()
    renderScene = vi.fn()
    observeResize = vi.fn()
    dispose = vi.fn()
    renderToCanvas = vi.fn(() => {
      const c = document.createElement('canvas')
      ;(c as any).toBlob = (cb: (b: Blob | null) => void) => cb(new Blob(['png']))
      return c
    })
    constructor(container: HTMLElement) {
      container.appendChild(this.canvas)
      h.viewInstances.push(this)
    }
  }
  return { RendererView }
})

import ModelPreview from './ModelPreview.vue'

class MockSplatMesh extends THREE.Object3D {
  static instances: MockSplatMesh[] = []
  initialized = Promise.resolve()
  quaternionSet: number[] | null = null
  dispose = vi.fn()
  constructor(public opts: { fileBytes: ArrayBuffer; fileName: string }) {
    super()
    MockSplatMesh.instances.push(this)
  }
}

class MockSparkRenderer extends THREE.Object3D {
  static instances: MockSparkRenderer[] = []
  constructor(public opts: { renderer: unknown }) {
    super()
    MockSparkRenderer.instances.push(this)
  }
}

function renderPreview(src: string) {
  return renderWithPlugins(ModelPreview, { props: { src } })
}

async function waitForViewChanged(emitted: () => Record<string, unknown[]>) {
  await waitFor(() => expect(emitted()['view-changed']).toBeTruthy())
}

beforeEach(() => {
  h.classifyModelBytes.mockReset().mockResolvedValue('mesh')
  h.buildPointCloud.mockReset()
  h.loadSpark.mockReset().mockResolvedValue({
    SplatMesh: MockSplatMesh,
    SparkRenderer: MockSparkRenderer,
  })
  h.loadCustomModelAssets.mockReset().mockResolvedValue({ template: new THREE.Group(), clips: [] })
  h.persistModelThumbnail.mockReset().mockResolvedValue(undefined)
  h.guard.mockReset().mockReturnValue(h.guardDispose)
  h.guardDispose.mockReset()
  h.viewInstances.length = 0
  h.controlsInstances.length = 0
  MockSplatMesh.instances.length = 0
  MockSparkRenderer.instances.length = 0
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('ModelPreview', () => {
  it('loads a mesh, emits view-changed and hides the loading overlay', async () => {
    const { emitted } = renderPreview('/view?filename=a.glb&subfolder=3d&type=input')
    await waitForViewChanged(() => emitted())
    expect(h.loadCustomModelAssets).toHaveBeenCalledWith('/view?filename=a.glb&subfolder=3d&type=input')
    expect(screen.queryByText('Loading model…')).toBeNull()
    expect(screen.queryByText('Failed to load model')).toBeNull()
  })

  it('re-emits view-changed when an orbit interaction ends', async () => {
    const { emitted } = renderPreview('/view?filename=a.glb')
    await waitForViewChanged(() => emitted())
    const controls = h.controlsInstances[0]
    controls.listeners['end'][0]()
    expect(emitted()['view-changed']).toHaveLength(2)
  })

  it('persists a thumbnail snapshot after the settle delay', async () => {
    vi.useFakeTimers()
    renderPreview('/view?filename=a.glb')
    await vi.advanceTimersByTimeAsync(50)
    expect(h.persistModelThumbnail).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(700)
    expect(h.persistModelThumbnail).toHaveBeenCalledTimes(1)
    const [url, blob] = h.persistModelThumbnail.mock.calls[0]
    expect(url).toBe('/view?filename=a.glb')
    expect(blob).toBeInstanceOf(Blob)
    expect(h.viewInstances[0].renderToCanvas).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 256, 256,
    )
  })

  it('shows the failure overlay when loading throws', async () => {
    h.loadCustomModelAssets.mockRejectedValue(new Error('404'))
    renderPreview('/view?filename=broken.glb')
    expect(await screen.findByText('Failed to load model')).toBeInTheDocument()
  })

  it('renders nothing but the viewport for an empty src', async () => {
    renderPreview('')
    await waitFor(() => expect(screen.queryByText('Loading model…')).toBeNull())
    expect(h.classifyModelBytes).not.toHaveBeenCalled()
  })

  it('splat path: lazy-loads spark, adds a SparkRenderer, flips the quaternion', async () => {
    h.classifyModelBytes.mockResolvedValue('splat')
    const { emitted, unmount } = renderPreview('/view?filename=a.splat')
    await waitForViewChanged(() => emitted())

    expect(MockSparkRenderer.instances).toHaveLength(1)
    expect(MockSparkRenderer.instances[0].opts.renderer).toBe(h.viewInstances[0].renderer)
    const splat = MockSplatMesh.instances[0]
    expect(splat.opts.fileName).toBe('a.splat')
    expect(splat.quaternion.w).toBe(0)
    expect(splat.quaternion.x).toBe(1)

    unmount()
    expect(splat.dispose).toHaveBeenCalled()
  })

  it('point-cloud path: builds Points and disposes their resources on unmount', async () => {
    h.classifyModelBytes.mockResolvedValue('pointcloud')
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3))
    const material = new THREE.PointsMaterial()
    const group = new THREE.Group()
    group.add(new THREE.Points(geometry, material))
    h.buildPointCloud.mockReturnValue(group)
    const geoDispose = vi.spyOn(geometry, 'dispose')
    const matDispose = vi.spyOn(material, 'dispose')

    const { emitted, unmount } = renderPreview('/view?filename=cloud.ply')
    await waitForViewChanged(() => emitted())
    expect(h.buildPointCloud).toHaveBeenCalled()

    unmount()
    expect(geoDispose).toHaveBeenCalled()
    expect(matDispose).toHaveBeenCalled()
  })

  it('tears down the renderer view, controls and drag guard on unmount', async () => {
    const { emitted, unmount } = renderPreview('/view?filename=a.glb')
    await waitForViewChanged(() => emitted())
    unmount()
    expect(h.viewInstances[0].dispose).toHaveBeenCalled()
    expect(h.controlsInstances[0].dispose).toHaveBeenCalled()
    expect(h.guardDispose).toHaveBeenCalled()
  })
})
