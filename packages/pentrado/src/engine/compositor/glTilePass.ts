import type { TileLayerInput } from '../compositor'
import { modeUniforms } from './modeCodes'
import { TILE_SIZE, type TileGrid } from '../tile/tileBuffer'
import { ATLAS_SIZE, GUTTER, type AtlasSlot } from './tileAtlas'
import type { Target } from './glShaders'
import {
  FLOATS_PER_INSTANCE,
  MASK_QUAD,
  bindQuadUniforms,
  blit,
  getFallback,
  loc,
  type GlState,
  type InstanceBatch,
  type InstanceEntry,
} from './glState'
import { resolveTexture } from './glTextures'

function proxySlot(s: GlState, input: TileLayerInput, grid: TileGrid, i: number): AtlasSlot | null {
  if (!input.tiles.proxy || !s.atlas) return null
  let keys = s.proxyKeys.get(grid)
  if (!keys) {
    keys = new Map()
    s.proxyKeys.set(grid, keys)
  }
  let key = keys.get(i)
  if (!key) {
    key = {}
    keys.set(i, key)
  }
  const hit = s.atlas.peek(key)
  if (hit) return hit
  const bytes = input.tiles.proxy(i)
  return bytes ? s.atlas.acquireBytes(key, bytes) : null
}

function buildInstances(s: GlState, input: TileLayerInput): InstanceEntry | null {
  const g = s.gl!
  const grid = input.tiles.grid
  const drawZero = input.tiles.drawZero
  const cached = s.instanceCache.get(grid)
  if (cached && cached.epoch === s.atlas!.epoch && cached.drawZero === drawZero && cached.residency === (grid.residency ?? 0)) {
    cached.gen = s.generation
    return cached
  }

  const byAtlas = new Map<number, number[]>()
  const push = (atlasIdx: number, rec: number[]) => {
    let arr = byAtlas.get(atlasIdx)
    if (!arr) {
      arr = []
      byAtlas.set(atlasIdx, arr)
    }
    arr.push(...rec)
  }
  for (let i = 0; i < grid.tiles.length; i++) {
    const tile = grid.tiles[i]
    const tx = i % grid.cols
    const ty = (i / grid.cols) | 0
    const x = tx * TILE_SIZE
    const y = ty * TILE_SIZE
    const w = Math.min(TILE_SIZE, grid.width - x)
    const h = Math.min(TILE_SIZE, grid.height - y)
    if (tile.uniform) {
      const [r, gg, b, a] = tile.uniform
      if (!drawZero && r === 0 && gg === 0 && b === 0 && a === 0) continue
      push(-1, [x, y, w, h, -1, 0, 0, 0, r / 255, gg / 255, b / 255, a / 255])
      continue
    }
    const slot = tile.bytes ? s.atlas!.acquire(grid, i) : proxySlot(s, input, grid, i)
    if (!slot) {
      if (drawZero) push(-1, [x, y, w, h, -1, 0, 0, 0, 0, 0, 0, 0])
      continue
    }
    push(slot.atlas, [x, y, w, h, slot.x, slot.y, 0, 0, 0, 0, 0, 0])
  }
  const total = [...byAtlas.values()].reduce((n, a) => n + a.length, 0)
  const data = new Float32Array(total)
  const batches: InstanceBatch[] = []
  let cursor = 0
  for (const [atlasIdx, arr] of byAtlas) {
    batches.push({ atlas: atlasIdx, offset: cursor / FLOATS_PER_INSTANCE, count: arr.length / FLOATS_PER_INSTANCE })
    data.set(arr, cursor)
    cursor += arr.length
  }
  const buffer = cached?.buffer ?? g.createBuffer()
  if (!buffer) return null
  g.bindBuffer(g.ARRAY_BUFFER, buffer)
  g.bufferData(g.ARRAY_BUFFER, data, g.DYNAMIC_DRAW)
  const entry: InstanceEntry = { buffer, batches, epoch: s.atlas!.epoch, drawZero, gen: s.generation, residency: grid.residency ?? 0 }
  s.instanceCache.set(grid, entry)
  return entry
}

export function drawTileInput(s: GlState, input: TileLayerInput, read: Target, write: Target, temps: WebGLTexture[]): void {
  const g = s.gl!
  const tileProg = s.tileProg
  const atlas = s.atlas
  if (!tileProg || !atlas) return
  s.tilePasses += 1

  blit(s, read, write)
  const inst = buildInstances(s, input)
  g.bindFramebuffer(g.FRAMEBUFFER, write.fbo)
  g.viewport(0, 0, write.width, write.height)
  if (!inst || !inst.batches.length) return

  g.useProgram(tileProg)
  g.activeTexture(g.TEXTURE0)
  g.bindTexture(g.TEXTURE_2D, read.tex)
  g.uniform1i(loc(s, tileProg, 'u_backdrop'), 0)
  g.activeTexture(g.TEXTURE2)
  g.bindTexture(g.TEXTURE_2D, input.mask ? resolveTexture(s, input.mask, temps) : getFallback(s))
  g.uniform1i(loc(s, tileProg, 'u_mask'), 2)
  g.uniform1i(loc(s, tileProg, 'u_hasMask'), input.mask ? 1 : 0)
  g.uniform2f(loc(s, tileProg, 'u_docSize'), s.width, s.height)
  bindQuadUniforms(s, tileProg, input.mask, MASK_QUAD)
  g.uniform1i(loc(s, tileProg, 'u_hasQuad'), 0)

  const q = input.tiles.quad
  g.uniform2f(loc(s, tileProg, 'u_tQuadCenter'), q.x + q.w / 2, q.y + q.h / 2)
  g.uniform2f(loc(s, tileProg, 'u_tQuadRot'), Math.cos(q.rotation), Math.sin(q.rotation))
  g.uniform2f(loc(s, tileProg, 'u_tQuadSize'), Math.max(1e-6, q.w), Math.max(1e-6, q.h))
  const grid = input.tiles.grid
  g.uniform2f(loc(s, tileProg, 'u_tSrcSize'), Math.max(1, grid.width), Math.max(1, grid.height))
  g.uniform2f(loc(s, tileProg, 'u_srcSize'), Math.max(1, grid.width), Math.max(1, grid.height))
  g.uniform2f(loc(s, tileProg, 'u_atlasSize'), ATLAS_SIZE, ATLAS_SIZE)
  g.uniform1f(loc(s, tileProg, 'u_gutter'), GUTTER)
  g.uniform1i(loc(s, tileProg, 'u_srgbLayer'), input.tiles.linear ? 0 : 1)
  g.uniform1f(loc(s, tileProg, 'u_opacity'), input.opacity)
  const u = modeUniforms(input.mode)
  g.uniform1i(loc(s, tileProg, 'u_blend'), u.blend)
  g.uniform1i(loc(s, tileProg, 'u_composite'), u.composite)
  g.uniform1i(loc(s, tileProg, 'u_blendSpace'), u.blendSpace)
  g.uniform1i(loc(s, tileProg, 'u_compositeSpace'), u.compositeSpace)
  g.uniform1i(loc(s, tileProg, 'u_clip'), input.clipToBackdrop ? 1 : 0)
  g.uniform1i(loc(s, tileProg, 'u_atlas'), 1)

  g.bindBuffer(g.ARRAY_BUFFER, inst.buffer)
  const stride = FLOATS_PER_INSTANCE * 4
  for (const attr of [0, 1, 2]) {
    g.enableVertexAttribArray(attr)
    g.vertexAttribDivisor(attr, 1)
  }
  for (const b of inst.batches) {
    const base = b.offset * stride
    g.vertexAttribPointer(0, 4, g.FLOAT, false, stride, base)
    g.vertexAttribPointer(1, 4, g.FLOAT, false, stride, base + 16)
    g.vertexAttribPointer(2, 4, g.FLOAT, false, stride, base + 32)
    g.activeTexture(g.TEXTURE1)
    g.bindTexture(g.TEXTURE_2D, (b.atlas >= 0 ? atlas.texture(b.atlas) : null) ?? getFallback(s))
    g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, b.count)
  }
  for (const attr of [0, 1, 2]) {
    g.vertexAttribDivisor(attr, 0)
    g.disableVertexAttribArray(attr)
  }
}

export function sweepInstanceCache(s: GlState): void {
  for (const [grid, entry] of s.instanceCache) {
    if (entry.gen < s.generation - 3) {
      s.gl?.deleteBuffer(entry.buffer)
      s.instanceCache.delete(grid)
    }
  }
}
