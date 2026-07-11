import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

const sparkState = vi.hoisted(() => ({
  plyProps: null as Record<string, unknown> | null,
  parseError: false,
}))

vi.mock('@sparkjsdev/spark', () => ({
  PlyReader: class {
    elements: unknown
    constructor(_opts: unknown) {}
    async parseHeader() {
      if (sparkState.parseError) throw new Error('bad ply header')
      this.elements = { vertex: { properties: sparkState.plyProps } }
    }
  },
}))

import {
  MODEL_FILE_EXTENSIONS,
  buildPointCloud,
  classifyModelBytes,
  isGaussianSplatPLY,
  isMeshModelUrl,
  loadSpark,
  modelUrlExtension,
} from './modelFormats'

const SPLAT_PROPS = {
  scale_0: {}, scale_1: {}, scale_2: {},
  rot_0: {}, rot_1: {}, rot_2: {}, rot_3: {},
}

function plyBytes(withColor = false): ArrayBuffer {
  const colorProps = withColor
    ? 'property uchar red\nproperty uchar green\nproperty uchar blue\n'
    : ''
  const colorVals = withColor ? ' 255 0 0' : ''
  const text = [
    'ply',
    'format ascii 1.0',
    'element vertex 3',
    'property float x',
    'property float y',
    'property float z',
    colorProps + 'end_header',
    `0 0 0${colorVals}`,
    `10 0 0${colorVals}`,
    `0 10 0${colorVals}`,
    '',
  ].join('\n')
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

beforeEach(() => {
  sparkState.plyProps = null
  sparkState.parseError = false
})

describe('modelUrlExtension / isMeshModelUrl', () => {
  it('reads the extension from /view? URLs and plain paths', () => {
    expect(modelUrlExtension('/view?filename=a.GLB&subfolder=3d')).toBe('.glb')
    expect(modelUrlExtension('3d/robot.fbx')).toBe('.fbx')
    expect(modelUrlExtension('noext')).toBe('')
  })

  it('classifies mesh URLs', () => {
    expect(isMeshModelUrl('/view?filename=a.glb')).toBe(true)
    expect(isMeshModelUrl('/view?filename=a.splat')).toBe(false)
    expect(isMeshModelUrl('/view?filename=a.ply')).toBe(false)
  })

  it('exposes the full supported extension list', () => {
    expect(MODEL_FILE_EXTENSIONS).toContain('.glb')
    expect(MODEL_FILE_EXTENSIONS).toContain('.spz')
    expect(MODEL_FILE_EXTENSIONS).toContain('.ply')
  })
})

describe('isGaussianSplatPLY', () => {
  it('detects splat PLYs by scale + rot vertex properties', async () => {
    sparkState.plyProps = SPLAT_PROPS
    await expect(isGaussianSplatPLY(new ArrayBuffer(4))).resolves.toBe(true)
  })

  it('rejects PLYs missing rot properties', async () => {
    sparkState.plyProps = { scale_0: {}, scale_1: {}, scale_2: {} }
    await expect(isGaussianSplatPLY(new ArrayBuffer(4))).resolves.toBe(false)
  })

  it('rejects PLYs without vertex properties', async () => {
    sparkState.plyProps = null
    await expect(isGaussianSplatPLY(new ArrayBuffer(4))).resolves.toBe(false)
  })

  it('treats parse failures as not-a-splat', async () => {
    sparkState.parseError = true
    await expect(isGaussianSplatPLY(new ArrayBuffer(4))).resolves.toBe(false)
  })
})

describe('classifyModelBytes', () => {
  it('classifies mesh and splat extensions without fetching bytes', async () => {
    const fetchBytes = vi.fn(async () => new ArrayBuffer(0))
    await expect(classifyModelBytes('/view?filename=a.glb', fetchBytes)).resolves.toBe('mesh')
    await expect(classifyModelBytes('/view?filename=a.spz', fetchBytes)).resolves.toBe('splat')
    await expect(classifyModelBytes('/view?filename=a.ksplat', fetchBytes)).resolves.toBe('splat')
    expect(fetchBytes).not.toHaveBeenCalled()
  })

  it('sniffs .ply content: splat props → splat, otherwise point cloud', async () => {
    const fetchBytes = vi.fn(async () => new ArrayBuffer(4))
    sparkState.plyProps = SPLAT_PROPS
    await expect(classifyModelBytes('/view?filename=a.ply', fetchBytes)).resolves.toBe('splat')
    sparkState.plyProps = {}
    await expect(classifyModelBytes('/view?filename=a.ply', fetchBytes)).resolves.toBe('pointcloud')
    expect(fetchBytes).toHaveBeenCalledTimes(2)
  })

  it('falls back to mesh for unknown extensions', async () => {
    await expect(classifyModelBytes('/view?filename=a.xyz', async () => new ArrayBuffer(0)))
      .resolves.toBe('mesh')
  })
})

describe('buildPointCloud', () => {
  it('builds normalized Points with a flat material when no vertex colors', () => {
    const group = buildPointCloud(plyBytes(false))
    const points = group.children[0] as THREE.Points
    expect(points).toBeInstanceOf(THREE.Points)
    const material = points.material as THREE.PointsMaterial
    expect(material.vertexColors).toBe(false)
    points.geometry.computeBoundingSphere()
    expect(points.geometry.boundingSphere!.radius).toBeLessThanOrEqual(1.0001)
  })

  it('enables vertexColors when the PLY carries color attributes', () => {
    const group = buildPointCloud(plyBytes(true))
    const points = group.children[0] as THREE.Points
    const material = points.material as THREE.PointsMaterial
    expect(material.vertexColors).toBe(true)
  })
})

describe('loadSpark', () => {
  it('returns the same cached module promise', async () => {
    const a = loadSpark()
    const b = loadSpark()
    expect(a).toBe(b)
    const mod = await a
    expect(mod.PlyReader).toBeTypeOf('function')
  })
})
