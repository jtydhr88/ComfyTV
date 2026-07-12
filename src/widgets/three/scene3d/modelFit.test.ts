import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import {
  MODEL_FIT_TARGET_SIZE,
  computeModelFit,
  needsAutoFit
} from './modelFit'

function boxTemplate(
  width: number,
  height: number,
  depth: number,
  offset?: THREE.Vector3
): THREE.Group {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth))
  if (offset) mesh.position.copy(offset)
  const group = new THREE.Group()
  group.add(mesh)
  return group
}

describe('computeModelFit', () => {
  it('scales the largest dimension to the fit target, uniformly', () => {
    const fit = computeModelFit(boxTemplate(40, 10, 20))!
    expect(fit.maxDim).toBeCloseTo(40)
    const expected = MODEL_FIT_TARGET_SIZE / 40
    expect(fit.transform.scale.x).toBeCloseTo(expected)
    expect(fit.transform.scale.y).toBeCloseTo(expected)
    expect(fit.transform.scale.z).toBeCloseTo(expected)
  })

  it('centers off-origin models and rests them on the ground', () => {
    const fit = computeModelFit(
      boxTemplate(4, 2, 4, new THREE.Vector3(10, 5, -6))
    )!
    const scale = fit.transform.scale.x
    expect(fit.transform.position.x).toBeCloseTo(-10 * scale)
    expect(fit.transform.position.y).toBeCloseTo(-4 * scale)
    expect(fit.transform.position.z).toBeCloseTo(6 * scale)
    expect(fit.transform.quaternion).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('returns null for empty objects', () => {
    expect(computeModelFit(new THREE.Group())).toBeNull()
  })
})

describe('needsAutoFit', () => {
  it('flags only sizes outside the sane range', () => {
    expect(needsAutoFit(0.05)).toBe(true)
    expect(needsAutoFit(0.5)).toBe(false)
    expect(needsAutoFit(1.7)).toBe(false)
    expect(needsAutoFit(20)).toBe(false)
    expect(needsAutoFit(21)).toBe(true)
    expect(needsAutoFit(1000)).toBe(true)
  })
})
