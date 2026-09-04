import type { Rect } from '../node'
import type { NodeTexture } from '../compositor'
import type { GlState, TexEntry } from './glState'

type Source = HTMLCanvasElement | ImageBitmap | OffscreenCanvas

export function resolveTexture(s: GlState, nt: NodeTexture, temps: WebGLTexture[]): WebGLTexture {
  if (nt.source instanceof WebGLTexture) return nt.source
  const wantMips =
    nt.quad != null &&
    Math.min(nt.quad.w / Math.max(1, nt.source.width), nt.quad.h / Math.max(1, nt.source.height)) < 0.75
  if (nt.key) {
    const hit = s.texCache.get(nt.key)
    const entry = hit ?? null
    if (entry) {
      entry.gen = s.generation
      const stampSame = nt.stamp === undefined || entry.stamp === nt.stamp
      if (!stampSame) {
        uploadInto(s, entry.tex, nt.source)
        entry.stamp = nt.stamp
        entry.version = nt.version
        entry.mipDirty = true
      } else if (nt.version !== undefined && entry.version !== nt.version) {
        if (entry.version === nt.version - 1 && nt.dirtyRects && partialUploadAll(s, entry.tex, nt.source, nt.dirtyRects)) {
          entry.version = nt.version
        } else {
          uploadInto(s, entry.tex, nt.source)
          entry.version = nt.version
        }
        entry.mipDirty = true
      }
      finishMips(s, entry, wantMips)
      return entry.tex
    }
    const tex = uploadSource(s, nt.source)
    const fresh: TexEntry = { tex, gen: s.generation, version: nt.version, stamp: nt.stamp, mipDirty: true, hasMips: false }
    finishMips(s, fresh, wantMips)
    s.texCache.set(nt.key, fresh)
    return tex
  }
  const tex = uploadSource(s, nt.source)
  if (wantMips) {
    const g = s.gl!
    g.bindTexture(g.TEXTURE_2D, tex)
    g.generateMipmap(g.TEXTURE_2D)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR)
  }
  temps.push(tex)
  return tex
}

function finishMips(s: GlState, entry: TexEntry, wantMips: boolean): void {
  const g = s.gl!
  g.bindTexture(g.TEXTURE_2D, entry.tex)
  if (wantMips && entry.mipDirty) {
    g.generateMipmap(g.TEXTURE_2D)
    entry.mipDirty = false
    entry.hasMips = true
  }
  g.texParameteri(
    g.TEXTURE_2D,
    g.TEXTURE_MIN_FILTER,
    entry.hasMips && !entry.mipDirty ? g.LINEAR_MIPMAP_LINEAR : g.LINEAR
  )
}

function partialUploadAll(s: GlState, tex: WebGLTexture, src: Source, rects: Rect[]): boolean {
  let area = 0
  for (const r of rects) area += Math.max(0, r.w) * Math.max(0, r.h)
  if (area > (src.width * src.height) / 2) return false
  for (const r of rects) {
    if (!partialUpload(s, tex, src, r)) return false
  }
  return true
}

function partialUpload(s: GlState, tex: WebGLTexture, src: Source, rect: Rect): boolean {
  const g = s.gl!
  const x = Math.max(0, Math.floor(rect.x))
  const y = Math.max(0, Math.floor(rect.y))
  const w = Math.min(src.width, Math.ceil(rect.x + rect.w)) - x
  const h = Math.min(src.height, Math.ceil(rect.y + rect.h)) - y
  if (w <= 0 || h <= 0) return true
  if (!s.scratch2d) s.scratch2d = document.createElement('canvas')
  s.scratch2d.width = w
  s.scratch2d.height = h
  const sctx = s.scratch2d.getContext('2d')
  if (!sctx) return false
  sctx.clearRect(0, 0, w, h)
  sctx.drawImage(src, x, y, w, h, 0, 0, w, h)
  g.bindTexture(g.TEXTURE_2D, tex)
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
  g.texSubImage2D(g.TEXTURE_2D, 0, x, src.height - (y + h), g.RGBA, g.UNSIGNED_BYTE, s.scratch2d)
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
  return true
}

function uploadInto(s: GlState, tex: WebGLTexture, src: Source): void {
  const g = s.gl!
  g.bindTexture(g.TEXTURE_2D, tex)
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src)
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
}

export function sweepTexCache(s: GlState): void {
  if (s.generation - s.lastSweepGen < 8) return
  s.lastSweepGen = s.generation
  for (const [key, entry] of s.texCache) {
    if (entry.gen < s.generation - 3) {
      s.gl?.deleteTexture(entry.tex)
      s.texCache.delete(key)
    }
  }
}

export function uploadSource(s: GlState, src: Source): WebGLTexture {
  const g = s.gl!
  const tex = g.createTexture()!
  g.bindTexture(g.TEXTURE_2D, tex)
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src)
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
  return tex
}
