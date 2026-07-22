import { beforeAll, describe, expect, it } from 'vitest'

import type { Compositor, CompositeInput, FBOHandle } from '../compositor'
import { DefaultContentStore } from '../impl/contentStore'
import { defaultMode } from '../mode'
import type { Document } from '../document'
import type { GroupData, SceneNode, Transform } from '../node'
import { registerNodeKind, type NodeKind } from '../nodeKind'
import { renderDocument, type RenderDeps } from './renderStack'

const T: Transform = { x: 0, y: 0, w: 10, h: 10, rotation: 0 }
const LOCKS = { content: false, position: false, visibility: false }

const stubKind = {
  kind: 'stub',
  renderNode: (_node: unknown, ctx: { region: unknown }) => ({
    source: document.createElement('canvas'),
    rect: ctx.region,
    linear: false,
  }),
} as unknown as NodeKind

beforeAll(() => registerNodeKind(stubKind))

function leaf(opacity = 1, visible = true): SceneNode {
  return {
    kind: 'stub',
    id: `l${opacity}`,
    name: 'l',
    visible,
    opacity,
    mode: defaultMode('normal'),
    transform: { ...T },
    locks: { ...LOCKS },
  } as unknown as SceneNode
}

function group(children: SceneNode[], opts: Partial<GroupData> = {}): GroupData {
  return {
    kind: 'group',
    id: 'g',
    name: 'g',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { ...T },
    locks: { ...LOCKS },
    children,
    passThrough: false,
    ...opts,
  }
}

function doc(children: SceneNode[]): Document {
  return { version: 2, width: 100, height: 100, root: group(children), channels: [] }
}

class FakeCompositor implements Compositor {
  composites: Array<{ inputs: CompositeInput[]; target: FBOHandle | null }> = []
  allocated: FBOHandle[] = []
  freed: number[] = []
  private nextId = 1
  init() {
    return true
  }
  resize() {}
  composite(inputs: CompositeInput[], target?: FBOHandle | null) {
    this.composites.push({ inputs: [...inputs], target: target ?? null })
  }
  allocTarget(width: number, height: number): FBOHandle {
    const h = { id: this.nextId++, width, height }
    this.allocated.push(h)
    return h
  }
  freeTarget(handle: FBOHandle) {
    this.freed.push(handle.id)
  }
  targetTexture(): WebGLTexture {
    return {} as WebGLTexture
  }
  upload(): WebGLTexture {
    return {} as WebGLTexture
  }
  readback(): ImageData {
    return new ImageData(1, 1)
  }
  async toBlob(): Promise<Blob> {
    return new Blob()
  }
  getCanvas() {
    return null
  }
  dispose() {}
}

function deps(compositor: Compositor): RenderDeps {
  return { content: new DefaultContentStore(), compositor }
}

describe('renderDocument', () => {
  it('composites visible layers bottom→top, skipping invisible / transparent', () => {
    const c = new FakeCompositor()
    renderDocument(doc([leaf(0.5), leaf(1, false), leaf(0), leaf(0.8)]), deps(c))
    expect(c.composites).toHaveLength(1)
    const { inputs, target } = c.composites[0]
    expect(target).toBeNull()
    expect(inputs.map((i) => i.opacity)).toEqual([0.5, 0.8])
  })

  it('renders a non-pass-through group into an isolated target, then blends it up', () => {
    const c = new FakeCompositor()
    const g = group([leaf(1), leaf(1)], { id: 'grp', opacity: 0.7 })
    renderDocument(doc([leaf(1), g]), deps(c))

    expect(c.composites).toHaveLength(2)
    expect(c.composites[0].inputs).toHaveLength(2)
    expect(c.composites[0].target).not.toBeNull()
    expect(c.composites[1].target).toBeNull()
    expect(c.composites[1].inputs.map((i) => i.opacity)).toEqual([1, 0.7])

    expect(c.allocated).toHaveLength(1)
    expect(c.freed).toEqual([c.allocated[0].id])
  })

  it('splices a pass-through group directly into the parent stack (no isolation target)', () => {
    const c = new FakeCompositor()
    const g = group([leaf(1), leaf(1)], { passThrough: true })
    renderDocument(doc([leaf(1), g]), deps(c))
    expect(c.composites).toHaveLength(1)
    expect(c.composites[0].inputs).toHaveLength(3)
    expect(c.allocated).toHaveLength(0)
  })

  it('emits an adjustment input with op code and packed params', () => {
    const c = new FakeCompositor()
    const adj = {
      kind: 'adjustment',
      id: 'a1',
      name: 'adj',
      visible: true,
      opacity: 0.8,
      mode: defaultMode('normal'),
      transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
      locks: { content: false, position: false, visibility: false },
      op: 'hue-saturation',
      params: { hue: 90, saturation: 0.5, lightness: 0 },
    } as unknown as SceneNode
    renderDocument(doc([leaf(1), adj]), deps(c))
    const inputs = c.composites[0].inputs
    expect(inputs).toHaveLength(2)
    const a = inputs[1] as { adjust: { op: number; params: number[] }; opacity: number }
    expect('adjust' in inputs[1]).toBe(true)
    expect(a.adjust.op).toBe(1)
    expect(a.adjust.params).toEqual([0.25, 0.5, 0, 0])
    expect(a.opacity).toBe(0.8)
  })
})
