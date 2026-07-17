import { describe, expect, it } from 'vitest'

import {
  buildPrimitiveGeometry,
  PRIM_KINDS,
  PRIM_PARAMS,
  primitiveRecipeJson,
  type PrimKind,
} from './useMeshPrimitive'
import { parsePrimitiveRecipe } from '@/widgets/three/primitiveGeometry'

function defaultsFor(kind: PrimKind): Record<string, number | boolean> {
  return Object.fromEntries(PRIM_PARAMS[kind].map((d) => [d.key, d.default]))
}

describe('useMeshPrimitive', () => {
  it('every kind builds a non-empty indexed geometry with defaults', () => {
    for (const kind of PRIM_KINDS) {
      const geom = buildPrimitiveGeometry(kind, defaultsFor(kind))
      expect(geom.getAttribute('position').count).toBeGreaterThan(0)
      expect(geom.index).not.toBeNull()
      expect(geom.getAttribute('normal')).toBeTruthy()
      expect(geom.getAttribute('uv')).toBeTruthy()
    }
  })

  it('recipe json carries three.js geometry.parameters names the backend reads', () => {
    const recipe = JSON.parse(primitiveRecipeJson('cylinder', {
      radiusTop: 0, radiusBottom: 1, height: 2, radialSegments: 16,
      heightSegments: 1, openEnded: true, thetaStart: 0, thetaLength: Math.PI,
    }))
    expect(recipe).toMatchObject({
      radiusTop: 0, radiusBottom: 1, height: 2, radialSegments: 16, openEnded: true,
    })
  })

  it('wire payload {"__prim__":{...}} round-trips into a buildable geometry', () => {
    for (const kind of PRIM_KINDS) {
      const params = JSON.parse(primitiveRecipeJson(kind, defaultsFor(kind)))
      const wire = JSON.stringify({ __prim__: { kind, ...params } })
      const parsed = parsePrimitiveRecipe(wire)
      expect(parsed?.kind).toBe(kind)
      const geom = buildPrimitiveGeometry(parsed!.kind, parsed!.params)
      expect(geom.getAttribute('position').count).toBeGreaterThan(0)
    }
  })

  it('non-recipe strings (URLs) are not mistaken for recipes', () => {
    expect(parsePrimitiveRecipe('/view?filename=m.glb&type=input')).toBeNull()
    expect(parsePrimitiveRecipe('')).toBeNull()
    expect(parsePrimitiveRecipe('{"foo":1}')).toBeNull()
  })

  it('recipe param keys for each kind are a subset of the backend-known parameters', () => {
    const KNOWN: Record<PrimKind, string[]> = {
      cube: ['width', 'height', 'depth', 'widthSegments', 'heightSegments', 'depthSegments'],
      sphere: ['radius', 'widthSegments', 'heightSegments', 'phiStart', 'phiLength', 'thetaStart', 'thetaLength'],
      cylinder: ['radiusTop', 'radiusBottom', 'height', 'radialSegments', 'heightSegments', 'openEnded', 'thetaStart', 'thetaLength'],
      cone: ['radius', 'height', 'radialSegments', 'heightSegments', 'openEnded', 'thetaStart', 'thetaLength'],
      plane: ['width', 'height', 'widthSegments', 'heightSegments'],
      torus: ['radius', 'tube', 'radialSegments', 'tubularSegments', 'arc'],
    }
    for (const kind of PRIM_KINDS) {
      const recipe = JSON.parse(primitiveRecipeJson(kind, defaultsFor(kind)))
      for (const key of Object.keys(recipe)) {
        expect(KNOWN[kind]).toContain(key)
      }
    }
  })
})
