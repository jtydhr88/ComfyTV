import type { Rect } from '../node'
import { modeUniforms } from './modeCodes'
import type {
  Compositor,
  CompositeInput,
  CompositorInit,
  FBOHandle,
  NodeTexture,
  TileLayerInput,
} from '../compositor'
import { TILE_SIZE, type TileGrid } from '../tile/tileBuffer'
import { ATLAS_SIZE, GUTTER, TileAtlas } from './tileAtlas'
import LAYER_BLEND_FRAG from './shaders/layerBlend.frag?raw'

const BLEND_COMMON = LAYER_BLEND_FRAG.slice(0, LAYER_BLEND_FRAG.indexOf('void main'))

const TILE_VERT = `#version 300 es
layout(location=0) in vec4 a_rect;
layout(location=1) in vec4 a_slot;
layout(location=2) in vec4 a_color;
uniform vec2 u_docSize;
uniform vec2 u_tQuadCenter;
uniform vec2 u_tQuadRot;
uniform vec2 u_tQuadSize;
uniform vec2 u_tSrcSize;
out vec2 v_texCoord;
out vec2 v_content;
flat out vec4 v_slotv;
flat out vec4 v_colorv;
flat out vec2 v_tileOrigin;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec2 c = a_rect.xy + corner * a_rect.zw;
  v_content = c;
  v_slotv = a_slot;
  v_colorv = a_color;
  v_tileOrigin = a_rect.xy;
  vec2 scaled = (c / u_tSrcSize - 0.5) * u_tQuadSize;
  vec2 doc = vec2(u_tQuadRot.x * scaled.x - u_tQuadRot.y * scaled.y,
                  u_tQuadRot.y * scaled.x + u_tQuadRot.x * scaled.y) + u_tQuadCenter;
  v_texCoord = vec2(doc.x / u_docSize.x, 1.0 - doc.y / u_docSize.y);
  gl_Position = vec4(doc.x / u_docSize.x * 2.0 - 1.0, 1.0 - doc.y / u_docSize.y * 2.0, 0.0, 1.0);
}`

const TILE_MAIN = `
uniform sampler2D u_atlas;
uniform vec2 u_atlasSize;
uniform float u_gutter;
in vec2 v_content;
flat in vec4 v_slotv;
flat in vec4 v_colorv;
flat in vec2 v_tileOrigin;

void main() {
  vec4 bg = texture(u_backdrop, v_texCoord);
  vec4 layer;
  if (v_slotv.x < 0.0) {
    layer = v_colorv;
  } else {
    vec2 px = v_slotv.xy + vec2(u_gutter) + (v_content - v_tileOrigin);
    layer = texture(u_atlas, px / u_atlasSize);
  }
  if (u_srgbLayer) layer.rgb = srgbToLinear(layer.rgb);
  vec2 edge = clamp(min(v_content, u_srcSize - v_content) + 0.5, 0.0, 1.0);
  layer.a *= edge.x * edge.y;

  float cov = u_opacity;
  if (u_hasMask) {
    if (u_maskHasQuad) {
      float medge;
      cov *= sampleQuad(u_mask, u_maskQuadCenter, u_maskQuadRot, u_maskQuadSize, u_maskSrcSize, medge).r * medge;
    } else {
      cov *= texture(u_mask, v_texCoord).r;
    }
  }
  if (u_clip) cov *= bg.a;

  vec3 comp = fromSpace(blendPixel(u_blend, toSpace(bg.rgb, u_blendSpace), toSpace(layer.rgb, u_blendSpace)), u_blendSpace);
  vec4 outc;
  if (u_compositeSpace == 0) {
    outc = composite(u_composite, bg, layer, comp, cov);
  } else {
    vec4 bgC = vec4(toSpace(bg.rgb, u_compositeSpace), bg.a);
    vec4 lyC = vec4(toSpace(layer.rgb, u_compositeSpace), layer.a);
    vec4 r = composite(u_composite, bgC, lyC, toSpace(comp, u_compositeSpace), cov);
    outc = vec4(fromSpace(r.rgb, u_compositeSpace), r.a);
  }
  fragColor = outc;
}`

const VERT = `#version 300 es
out vec2 v_texCoord;
void main() {
  vec2 v[3] = vec2[](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  v_texCoord = v[gl_VertexID] * 0.5 + 0.5;
  gl_Position = vec4(v[gl_VertexID], 0.0, 1.0);
}`

const PRESENT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_texCoord;
out vec4 fragColor;
float lin2srgb(float c){ c = clamp(c, 0.0, 1.0); return c <= 0.0031308 ? 12.92*c : 1.055*pow(c,1.0/2.4)-0.055; }
void main(){
  vec4 c = texture(u_tex, v_texCoord);
  fragColor = vec4(lin2srgb(c.r), lin2srgb(c.g), lin2srgb(c.b), clamp(c.a, 0.0, 1.0));
}`

const COPY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_texCoord;
out vec4 fragColor;
void main(){ fragColor = texture(u_tex, v_texCoord); }`

const ADJUST_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_backdrop;
uniform sampler2D u_mask;
uniform sampler2D u_lut;
uniform bool u_hasMask;
uniform float u_opacity;
uniform int u_op;
uniform vec4 u_p0;
uniform vec4 u_p1;
uniform vec4 u_p2;
uniform vec2 u_docSize;
uniform bool u_maskHasQuad;
uniform vec2 u_maskQuadCenter;
uniform vec2 u_maskQuadRot;
uniform vec2 u_maskQuadSize;
uniform vec2 u_maskSrcSize;
in vec2 v_texCoord;
out vec4 fragColor;

float maskSample(){
  if (!u_maskHasQuad) return texture(u_mask, v_texCoord).r;
  vec2 docPx = vec2(v_texCoord.x * u_docSize.x, (1.0 - v_texCoord.y) * u_docSize.y);
  vec2 d = docPx - u_maskQuadCenter;
  vec2 r = vec2(u_maskQuadRot.x * d.x + u_maskQuadRot.y * d.y, -u_maskQuadRot.y * d.x + u_maskQuadRot.x * d.y);
  vec2 local = r / u_maskQuadSize + 0.5;
  vec2 px = local * u_maskSrcSize;
  vec2 c2 = clamp(min(px, u_maskSrcSize - px) + 0.5, 0.0, 1.0);
  return texture(u_mask, vec2(local.x, 1.0 - local.y)).r * c2.x * c2.y;
}

float s2l(float c){ return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
float l2s(float c){ c = clamp(c, 0.0, 1.0); return c <= 0.0031308 ? 12.92*c : 1.055*pow(c,1.0/2.4)-0.055; }
vec3 s2l(vec3 c){ return vec3(s2l(c.r), s2l(c.g), s2l(c.b)); }
vec3 l2s(vec3 c){ return vec3(l2s(c.r), l2s(c.g), l2s(c.b)); }

float bc(float v, float b, float c){
  float hb = b * 0.5;
  float o = hb < 0.0 ? v * (1.0 + hb) : v + (1.0 - v) * hb;
  return (o - 0.5) * tan((c + 1.0) * 0.78539816) + 0.5;
}

vec3 rgb2hsl(vec3 c){
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  if (mx == mn) return vec3(0.0, 0.0, l);
  float d = mx - mn;
  float s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
  float h;
  if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, s, l);
}

float hue2rgb(float p, float q, float t){
  float x = t;
  if (x < 0.0) x += 1.0;
  if (x > 1.0) x -= 1.0;
  if (x < 1.0/6.0) return p + (q - p) * 6.0 * x;
  if (x < 0.5) return q;
  if (x < 2.0/3.0) return p + (q - p) * (2.0/3.0 - x) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl){
  if (hsl.y == 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return vec3(hue2rgb(p, q, hsl.x + 1.0/3.0), hue2rgb(p, q, hsl.x), hue2rgb(p, q, hsl.x - 1.0/3.0));
}

float lev(float v){
  float t = clamp((v - u_p0.x) / max(u_p0.y - u_p0.x, 1e-4), 0.0, 1.0);
  return u_p0.w + pow(t, 1.0 / max(u_p0.z, 1e-4)) * (u_p1.x - u_p0.w);
}

float balComp(float v, float l, float s, float m, float h){
  const float a = 4.0;
  const float b = 0.333;
  const float sc = 0.7;
  float sw = s * clamp((b - l) * a + 0.5, 0.0, 1.0) * sc;
  float mw = m * clamp((l - b) * a + 0.5, 0.0, 1.0) * clamp((1.0 - l - b) * a + 0.5, 0.0, 1.0) * sc;
  float hw = h * clamp((l + b - 1.0) * a + 0.5, 0.0, 1.0) * sc;
  return clamp(v + sw + mw + hw, 0.0, 1.0);
}

float hfun(float n, float h, float s, float l){
  float a = s * min(l, 1.0 - l);
  float k = mod(n + h / 30.0, 12.0);
  return clamp(l - a * max(min(min(k - 3.0, 9.0 - k), 1.0), -1.0), 0.0, 1.0);
}

vec3 preservel(vec3 c, float l){
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float h;
  if (c.r == c.g && c.g == c.b) h = 0.0;
  else if (mx == c.r) h = 60.0 * ((c.g - c.b) / (mx - mn));
  else if (mx == c.g) h = 60.0 * (2.0 + (c.b - c.r) / (mx - mn));
  else h = 60.0 * (4.0 + (c.r - c.g) / (mx - mn));
  if (h < 0.0) h += 360.0;
  float lOut = (mx + mn) * 0.5;
  float denom = 1.0 - abs(2.0 * lOut - 1.0);
  float s = denom <= 1e-6 ? 0.0 : (mx - mn) / denom;
  return vec3(hfun(0.0, h, s, l), hfun(8.0, h, s, l), hfun(4.0, h, s, l));
}

float lutAt(float v, int ch){
  float x = (floor(clamp(v, 0.0, 1.0) * 255.0 + 0.5) + 0.5) / 256.0;
  vec4 s = texture(u_lut, vec2(x, 0.5));
  return ch == 0 ? s.r : ch == 1 ? s.g : s.b;
}

void main(){
  vec4 bg = texture(u_backdrop, v_texCoord);
  vec3 adjusted;
  if (u_op == 0) {
    adjusted = vec3(bc(bg.r, u_p0.x, u_p0.y), bc(bg.g, u_p0.x, u_p0.y), bc(bg.b, u_p0.x, u_p0.y));
  } else if (u_op == 5) {
    adjusted = clamp((bg.rgb - vec3(u_p0.x)) * u_p0.y, 0.0, 1.0);
  } else {
    vec3 g = l2s(clamp(bg.rgb, 0.0, 1.0));
    vec3 o;
    if (u_op == 1) {
      vec3 hsl = rgb2hsl(g);
      hsl.x = fract(hsl.x + u_p0.x + 1.0);
      hsl.y = clamp(hsl.y * (1.0 + u_p0.y), 0.0, 1.0);
      hsl.z = clamp(u_p0.z > 0.0 ? hsl.z + u_p0.z * (1.0 - hsl.z) : hsl.z + u_p0.z * hsl.z, 0.0, 1.0);
      o = hsl2rgb(hsl);
    } else if (u_op == 2) {
      o = vec3(1.0) - g;
    } else if (u_op == 3) {
      o = vec3(lev(g.r), lev(g.g), lev(g.b));
    } else if (u_op == 4) {
      o = mix(g, g * u_p0.xyz, u_p0.w);
    } else if (u_op == 6) {
      float l = (max(g.r, max(g.g, g.b)) + min(g.r, min(g.g, g.b))) * 0.5;
      o = vec3(
        balComp(g.r, l, u_p0.x, u_p0.w, u_p1.z),
        balComp(g.g, l, u_p0.y, u_p1.x, u_p1.w),
        balComp(g.b, l, u_p0.z, u_p1.y, u_p2.x));
      o = preservel(o, l);
    } else if (u_op == 7) {
      float n = max(u_p0.x, 2.0) - 1.0;
      o = floor(g * n + 0.5) / n;
    } else if (u_op == 8) {
      float y = dot(g, vec3(0.2126, 0.7152, 0.0722));
      o = vec3(y >= u_p0.x ? 1.0 : 0.0);
    } else if (u_op == 9) {
      float sat = max(g.r, max(g.g, g.b)) - min(g.r, min(g.g, g.b));
      float luma = g.g * 0.715158 + g.r * 0.212656 + g.b * 0.072186;
      float s = u_p0.x > 0.0 ? 1.0 : -1.0;
      float k = 1.0 + u_p0.x * (1.0 + s * sat);
      o = clamp(vec3(luma) + (g - vec3(luma)) * k, 0.0, 1.0);
    } else if (u_op == 11) {
      o = clamp(vec3(
        dot(g, u_p0.xyz),
        dot(g, vec3(u_p0.w, u_p1.xy)),
        dot(g, vec3(u_p1.zw, u_p2.x))), 0.0, 1.0);
    } else if (u_op == 12) {
      float gray = clamp(
        g.r*u_p0.x + (g.r+g.g)*0.5*u_p0.y + g.g*u_p0.z + (g.g+g.b)*0.5*u_p0.w + g.b*u_p1.x + (g.r+g.b)*0.5*u_p1.y,
        0.0, 1.0);
      o = vec3(gray);
    } else if (u_op == 13) {
      vec3 filt = g * u_p0.xyz;
      float lo = dot(g, vec3(0.2126, 0.7152, 0.0722));
      float ln = dot(filt, vec3(0.2126, 0.7152, 0.0722));
      filt *= ln > 1e-4 ? lo / ln : 1.0;
      o = clamp(mix(g, filt, u_p0.w), 0.0, 1.0);
    } else if (u_op == 14) {
      float y = dot(g, vec3(0.2126, 0.7152, 0.0722));
      o = vec3(lutAt(y, 0), lutAt(y, 1), lutAt(y, 2));
    } else {
      o = vec3(lutAt(g.r, 0), lutAt(g.g, 1), lutAt(g.b, 2));
    }
    adjusted = s2l(clamp(o, 0.0, 1.0));
  }
  float t = u_opacity * (u_hasMask ? maskSample() : 1.0);
  fragColor = vec4(mix(bg.rgb, adjusted, t), bg.a);
}`

interface Target {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
  width: number
  height: number
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? 'compile failed'
    gl.deleteShader(sh)
    throw new Error(log)
  }
  return sh
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) ?? 'link failed'
    gl.deleteProgram(p)
    throw new Error(log)
  }
  return p
}

export function createWebGLCompositor(): Compositor {
  let canvas: OffscreenCanvas | HTMLCanvasElement | null = null
  let gl: WebGL2RenderingContext | null = null
  let blendProg: WebGLProgram | null = null
  let tileProg: WebGLProgram | null = null
  let presentProg: WebGLProgram | null = null
  let copyProg: WebGLProgram | null = null
  let adjustProg: WebGLProgram | null = null
  let atlas: TileAtlas | null = null
  let ping: Target | null = null
  let pong: Target | null = null
  let result: Target | null = null
  let resultValid = false
  let scratch2d: HTMLCanvasElement | null = null
  let lastSweepGen = 0
  let fallback: WebGLTexture | null = null
  let lutTex: WebGLTexture | null = null
  let width = 0
  let height = 0
  let nextHandle = 1
  let generation = 0
  let contextLost = false
  let disposed = false
  let lastRecover = -Infinity
  let onRestored: (() => void) | undefined
  interface TexEntry {
    tex: WebGLTexture
    gen: number
    version?: number
    stamp?: string
    mipDirty: boolean
    hasMips: boolean
  }
  const targets = new Map<number, Target>()
  const texCache = new Map<string, TexEntry>()
  let uniformCache = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>()

  interface InstanceBatch {
    atlas: number
    offset: number
    count: number
  }
  interface InstanceEntry {
    buffer: WebGLBuffer
    batches: InstanceBatch[]
    epoch: number
    drawZero: boolean
    gen: number
  }
  const instanceCache = new Map<TileGrid, InstanceEntry>()
  const FLOATS_PER_INSTANCE = 12
  let tilePasses = 0

  function loc(prog: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = uniformCache.get(prog)
    if (!m) {
      m = new Map()
      uniformCache.set(prog, m)
    }
    if (!m.has(name)) m.set(name, gl!.getUniformLocation(prog, name))
    return m.get(name)!
  }

  function makeTarget(w: number, h: number): Target {
    const g = gl!
    const tex = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, tex)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, w, h, 0, g.RGBA, g.HALF_FLOAT, null)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    const fbo = g.createFramebuffer()!
    g.bindFramebuffer(g.FRAMEBUFFER, fbo)
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0)
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    return { fbo, tex, width: w, height: h }
  }

  function freeTargetObj(t: Target): void {
    gl?.deleteFramebuffer(t.fbo)
    gl?.deleteTexture(t.tex)
  }

  function drawFullscreen(): void {
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
  }

  function bindQuadUniforms(
    prog: WebGLProgram,
    nt: NodeTexture | undefined,
    names: { has: string; center: string; rot: string; size: string; src: string }
  ): void {
    const g = gl!
    const q = nt?.quad
    if (!nt || !q || nt.source instanceof WebGLTexture) {
      g.uniform1i(loc(prog, names.has), 0)
      return
    }
    g.uniform1i(loc(prog, names.has), 1)
    g.uniform2f(loc(prog, names.center), q.x + q.w / 2, q.y + q.h / 2)
    g.uniform2f(loc(prog, names.rot), Math.cos(q.rotation), Math.sin(q.rotation))
    g.uniform2f(loc(prog, names.size), Math.max(1e-6, q.w), Math.max(1e-6, q.h))
    g.uniform2f(loc(prog, names.src), Math.max(1, nt.source.width), Math.max(1, nt.source.height))
  }

  const LAYER_QUAD = { has: 'u_hasQuad', center: 'u_quadCenter', rot: 'u_quadRot', size: 'u_quadSize', src: 'u_srcSize' }
  const MASK_QUAD = {
    has: 'u_maskHasQuad',
    center: 'u_maskQuadCenter',
    rot: 'u_maskQuadRot',
    size: 'u_maskQuadSize',
    src: 'u_maskSrcSize',
  }

  function buildInstances(input: TileLayerInput): InstanceEntry | null {
    const g = gl!
    const grid = input.tiles.grid
    const drawZero = input.tiles.drawZero
    const cached = instanceCache.get(grid)
    if (cached && cached.epoch === atlas!.epoch && cached.drawZero === drawZero) {
      cached.gen = generation
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
      const slot = tile.bytes ? atlas!.acquire(grid, i) : null
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
    const entry: InstanceEntry = { buffer, batches, epoch: atlas!.epoch, drawZero, gen: generation }
    instanceCache.set(grid, entry)
    return entry
  }

  function drawTileInput(input: TileLayerInput, read: Target, write: Target, temps: WebGLTexture[]): void {
    const g = gl!
    if (!tileProg || !atlas) return
    tilePasses += 1

    blit(read, write)
    const inst = buildInstances(input)
    g.bindFramebuffer(g.FRAMEBUFFER, write.fbo)
    g.viewport(0, 0, write.width, write.height)
    if (!inst || !inst.batches.length) return

    g.useProgram(tileProg)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, read.tex)
    g.uniform1i(loc(tileProg, 'u_backdrop'), 0)
    g.activeTexture(g.TEXTURE2)
    g.bindTexture(g.TEXTURE_2D, input.mask ? resolveTexture(input.mask, temps) : getFallback())
    g.uniform1i(loc(tileProg, 'u_mask'), 2)
    g.uniform1i(loc(tileProg, 'u_hasMask'), input.mask ? 1 : 0)
    g.uniform2f(loc(tileProg, 'u_docSize'), width, height)
    bindQuadUniforms(tileProg, input.mask, MASK_QUAD)
    g.uniform1i(loc(tileProg, 'u_hasQuad'), 0)

    const q = input.tiles.quad
    g.uniform2f(loc(tileProg, 'u_tQuadCenter'), q.x + q.w / 2, q.y + q.h / 2)
    g.uniform2f(loc(tileProg, 'u_tQuadRot'), Math.cos(q.rotation), Math.sin(q.rotation))
    g.uniform2f(loc(tileProg, 'u_tQuadSize'), Math.max(1e-6, q.w), Math.max(1e-6, q.h))
    const grid = input.tiles.grid
    g.uniform2f(loc(tileProg, 'u_tSrcSize'), Math.max(1, grid.width), Math.max(1, grid.height))
    g.uniform2f(loc(tileProg, 'u_srcSize'), Math.max(1, grid.width), Math.max(1, grid.height))
    g.uniform2f(loc(tileProg, 'u_atlasSize'), ATLAS_SIZE, ATLAS_SIZE)
    g.uniform1f(loc(tileProg, 'u_gutter'), GUTTER)
    g.uniform1i(loc(tileProg, 'u_srgbLayer'), input.tiles.linear ? 0 : 1)
    g.uniform1f(loc(tileProg, 'u_opacity'), input.opacity)
    const u = modeUniforms(input.mode)
    g.uniform1i(loc(tileProg, 'u_blend'), u.blend)
    g.uniform1i(loc(tileProg, 'u_composite'), u.composite)
    g.uniform1i(loc(tileProg, 'u_blendSpace'), u.blendSpace)
    g.uniform1i(loc(tileProg, 'u_compositeSpace'), u.compositeSpace)
    g.uniform1i(loc(tileProg, 'u_clip'), input.clipToBackdrop ? 1 : 0)
    g.uniform1i(loc(tileProg, 'u_atlas'), 1)

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
      g.bindTexture(g.TEXTURE_2D, (b.atlas >= 0 ? atlas.texture(b.atlas) : null) ?? getFallback())
      g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, b.count)
    }
    for (const attr of [0, 1, 2]) {
      g.vertexAttribDivisor(attr, 0)
      g.disableVertexAttribArray(attr)
    }
  }

  function sweepInstanceCache(): void {
    for (const [grid, entry] of instanceCache) {
      if (entry.gen < generation - 3) {
        gl?.deleteBuffer(entry.buffer)
        instanceCache.delete(grid)
      }
    }
  }

  function resolveTexture(nt: NodeTexture, temps: WebGLTexture[]): WebGLTexture {
    if (nt.source instanceof WebGLTexture) return nt.source
    const wantMips =
      nt.quad != null &&
      Math.min(nt.quad.w / Math.max(1, nt.source.width), nt.quad.h / Math.max(1, nt.source.height)) < 0.75
    if (nt.key) {
      const hit = texCache.get(nt.key)
      const entry = hit ?? null
      if (entry) {
        entry.gen = generation
        const stampSame = nt.stamp === undefined || entry.stamp === nt.stamp
        if (!stampSame) {
          uploadInto(entry.tex, nt.source)
          entry.stamp = nt.stamp
          entry.version = nt.version
          entry.mipDirty = true
        } else if (nt.version !== undefined && entry.version !== nt.version) {
          if (entry.version === nt.version - 1 && nt.dirtyRects && partialUploadAll(entry.tex, nt.source, nt.dirtyRects)) {
            entry.version = nt.version
          } else {
            uploadInto(entry.tex, nt.source)
            entry.version = nt.version
          }
          entry.mipDirty = true
        }
        finishMips(entry, wantMips)
        return entry.tex
      }
      const tex = uploadSource(nt.source)
      const fresh: TexEntry = { tex, gen: generation, version: nt.version, stamp: nt.stamp, mipDirty: true, hasMips: false }
      finishMips(fresh, wantMips)
      texCache.set(nt.key, fresh)
      return tex
    }
    const tex = uploadSource(nt.source)
    if (wantMips) {
      const g = gl!
      g.bindTexture(g.TEXTURE_2D, tex)
      g.generateMipmap(g.TEXTURE_2D)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR)
    }
    temps.push(tex)
    return tex
  }

  function finishMips(entry: TexEntry, wantMips: boolean): void {
    const g = gl!
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

  function partialUploadAll(
    tex: WebGLTexture,
    src: HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
    rects: Rect[]
  ): boolean {
    let area = 0
    for (const r of rects) area += Math.max(0, r.w) * Math.max(0, r.h)
    if (area > (src.width * src.height) / 2) return false
    for (const r of rects) {
      if (!partialUpload(tex, src, r)) return false
    }
    return true
  }

  function partialUpload(
    tex: WebGLTexture,
    src: HTMLCanvasElement | ImageBitmap | OffscreenCanvas,
    rect: Rect
  ): boolean {
    const g = gl!
    const x = Math.max(0, Math.floor(rect.x))
    const y = Math.max(0, Math.floor(rect.y))
    const w = Math.min(src.width, Math.ceil(rect.x + rect.w)) - x
    const h = Math.min(src.height, Math.ceil(rect.y + rect.h)) - y
    if (w <= 0 || h <= 0) return true
    if (!scratch2d) scratch2d = document.createElement('canvas')
    scratch2d.width = w
    scratch2d.height = h
    const sctx = scratch2d.getContext('2d')
    if (!sctx) return false
    sctx.clearRect(0, 0, w, h)
    sctx.drawImage(src, x, y, w, h, 0, 0, w, h)
    g.bindTexture(g.TEXTURE_2D, tex)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
    g.texSubImage2D(g.TEXTURE_2D, 0, x, src.height - (y + h), g.RGBA, g.UNSIGNED_BYTE, scratch2d)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
    return true
  }

  function uploadInto(tex: WebGLTexture, src: HTMLCanvasElement | ImageBitmap | OffscreenCanvas): void {
    const g = gl!
    g.bindTexture(g.TEXTURE_2D, tex)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
  }

  function sweepTexCache(): void {
    if (generation - lastSweepGen < 8) return
    lastSweepGen = generation
    for (const [key, entry] of texCache) {
      if (entry.gen < generation - 3) {
        gl?.deleteTexture(entry.tex)
        texCache.delete(key)
      }
    }
  }

  function uploadSource(src: HTMLCanvasElement | ImageBitmap | OffscreenCanvas): WebGLTexture {
    const g = gl!
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

  function getFallback(): WebGLTexture {
    if (!fallback) {
      const g = gl!
      fallback = g.createTexture()!
      g.bindTexture(g.TEXTURE_2D, fallback)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
    }
    return fallback
  }

  function getLutTex(lut?: Uint8Array): WebGLTexture {
    if (!lut) return getFallback()
    const g = gl!
    if (!lutTex) {
      lutTex = g.createTexture()!
      g.bindTexture(g.TEXTURE_2D, lutTex)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
    } else {
      g.bindTexture(g.TEXTURE_2D, lutTex)
    }
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 256, 1, 0, g.RGBA, g.UNSIGNED_BYTE, lut)
    return lutTex
  }

  function clearTarget(t: Target): void {
    const g = gl!
    g.bindFramebuffer(g.FRAMEBUFFER, t.fbo)
    g.viewport(0, 0, t.width, t.height)
    g.clearColor(0, 0, 0, 0)
    g.clear(g.COLOR_BUFFER_BIT)
  }

  function dropContextState(): void {
    targets.clear()
    texCache.clear()
    instanceCache.clear()
    uniformCache = new WeakMap()
    ping = pong = result = null
    resultValid = false
    fallback = null
    lutTex = null
    blendProg = presentProg = copyProg = adjustProg = tileProg = null
    atlas = null
    gl = null
    canvas = null
  }

  function setupContext(): boolean {
    try {
      const c =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(width, height)
          : document.createElement('canvas')
      if (!(c instanceof OffscreenCanvas)) {
        c.width = width
        c.height = height
      }
      const ctx = (c as HTMLCanvasElement | OffscreenCanvas).getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      }) as WebGL2RenderingContext | null
      if (!ctx) return false
      if (!ctx.getExtension('EXT_color_buffer_float')) return false
      canvas = c
      gl = ctx
      contextLost = false
      c.addEventListener('webglcontextlost', (e: Event) => {
        e.preventDefault()
        contextLost = true
        if (disposed) return
        console.warn('[pentrado] WebGL context lost — recreating')
        queueMicrotask(() => {
          if (recover()) onRestored?.()
        })
      })
      const vs = compile(gl, gl.VERTEX_SHADER, VERT)
      blendProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, LAYER_BLEND_FRAG))
      presentProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, PRESENT_FRAG))
      copyProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, COPY_FRAG))
      adjustProg = link(gl, vs, compile(gl, gl.FRAGMENT_SHADER, ADJUST_FRAG))
      tileProg = link(
        gl,
        compile(gl, gl.VERTEX_SHADER, TILE_VERT),
        compile(gl, gl.FRAGMENT_SHADER, BLEND_COMMON + TILE_MAIN)
      )
      atlas = new TileAtlas(gl)
      ping = makeTarget(width, height)
      pong = makeTarget(width, height)
      return true
    } catch {
      dropContextState()
      return false
    }
  }

  function recover(): boolean {
    if (disposed) return false
    const now = typeof performance !== 'undefined' ? performance.now() : 0
    if (now - lastRecover < 1000) return false
    lastRecover = now
    dropContextState()
    return setupContext()
  }

  function ensureHealthy(): boolean {
    if (disposed) return false
    if (gl && !contextLost && !gl.isContextLost()) return true
    contextLost = true
    if (!recover()) return false
    if (onRestored) queueMicrotask(onRestored)
    return true
  }

  return {
    init(opts: CompositorInit): boolean {
      if (gl) dropContextState()
      width = opts.width
      height = opts.height
      onRestored = opts.onContextRestored
      disposed = false
      if (setupContext()) return true
      dropContextState()
      return false
    },

    beginFrame(): void {
      generation += 1
      atlas?.beginFrame()
      if (generation % 16 === 0) atlas?.sweepDead()
    },

    resize(w: number, h: number): void {
      if (w === width && h === height) return
      width = w
      height = h
      if (!ensureHealthy() || !gl) return
      if (canvas) {
        canvas.width = w
        canvas.height = h
      }
      if (ping) freeTargetObj(ping)
      if (pong) freeTargetObj(pong)
      if (result) freeTargetObj(result)
      ping = makeTarget(w, h)
      pong = makeTarget(w, h)
      result = null
      resultValid = false
    },

    composite(inputs: CompositeInput[], target?: FBOHandle | null, region?: Rect): void {
      if (!ensureHealthy()) return
      if (!gl || !blendProg || !ping || !pong) return
      const g = gl
      g.disable(g.SCISSOR_TEST)

      let clip: Rect | null = null
      if (!target && region && resultValid && result) {
        const x = Math.max(0, Math.floor(region.x))
        const y = Math.max(0, Math.floor(region.y))
        const w = Math.min(width, Math.ceil(region.x + region.w)) - x
        const h = Math.min(height, Math.ceil(region.y + region.h)) - y
        if (w <= 0 || h <= 0) return
        if (w < width || h < height) clip = { x, y, w, h }
      }
      if (clip) {
        g.enable(g.SCISSOR_TEST)
        g.scissor(clip.x, height - (clip.y + clip.h), clip.w, clip.h)
      }

      let read = ping
      let write = pong
      clearTarget(read)
      const temps: WebGLTexture[] = []

      for (const input of inputs) {
        clearTarget(write)
        g.bindFramebuffer(g.FRAMEBUFFER, write.fbo)
        g.viewport(0, 0, write.width, write.height)

        if ('tiles' in input) {
          drawTileInput(input, read, write, temps)
          const t = read
          read = write
          write = t
          continue
        }

        if ('adjust' in input) {
          if (!adjustProg) continue
          g.useProgram(adjustProg)
          g.activeTexture(g.TEXTURE0)
          g.bindTexture(g.TEXTURE_2D, read.tex)
          g.uniform1i(loc(adjustProg, 'u_backdrop'), 0)
          g.activeTexture(g.TEXTURE2)
          g.bindTexture(g.TEXTURE_2D, input.mask ? resolveTexture(input.mask, temps) : getFallback())
          g.uniform1i(loc(adjustProg, 'u_mask'), 2)
          g.uniform1i(loc(adjustProg, 'u_hasMask'), input.mask ? 1 : 0)
          g.uniform2f(loc(adjustProg, 'u_docSize'), width, height)
          bindQuadUniforms(adjustProg, input.mask, MASK_QUAD)
          g.uniform1f(loc(adjustProg, 'u_opacity'), input.opacity)
          g.uniform1i(loc(adjustProg, 'u_op'), input.adjust.op)
          const p = input.adjust.params
          g.uniform4f(loc(adjustProg, 'u_p0'), p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 0)
          g.uniform4f(loc(adjustProg, 'u_p1'), p[4] ?? 0, p[5] ?? 0, p[6] ?? 0, p[7] ?? 0)
          g.uniform4f(loc(adjustProg, 'u_p2'), p[8] ?? 0, p[9] ?? 0, p[10] ?? 0, p[11] ?? 0)
          g.activeTexture(g.TEXTURE1)
          g.bindTexture(g.TEXTURE_2D, getLutTex(input.adjust.lut))
          g.uniform1i(loc(adjustProg, 'u_lut'), 1)
        } else {
          g.useProgram(blendProg)
          g.activeTexture(g.TEXTURE0)
          g.bindTexture(g.TEXTURE_2D, read.tex)
          g.uniform1i(loc(blendProg, 'u_backdrop'), 0)

          g.activeTexture(g.TEXTURE1)
          g.bindTexture(g.TEXTURE_2D, resolveTexture(input.texture, temps))
          g.uniform1i(loc(blendProg, 'u_layer'), 1)

          g.activeTexture(g.TEXTURE2)
          g.bindTexture(g.TEXTURE_2D, input.mask ? resolveTexture(input.mask, temps) : getFallback())
          g.uniform1i(loc(blendProg, 'u_mask'), 2)
          g.uniform1i(loc(blendProg, 'u_hasMask'), input.mask ? 1 : 0)

          g.uniform2f(loc(blendProg, 'u_docSize'), width, height)
          bindQuadUniforms(blendProg, input.texture, LAYER_QUAD)
          bindQuadUniforms(blendProg, input.mask, MASK_QUAD)

          g.uniform1i(loc(blendProg, 'u_srgbLayer'), input.texture.linear ? 0 : 1)
          g.uniform1f(loc(blendProg, 'u_opacity'), input.opacity)
          const u = modeUniforms(input.mode)
          g.uniform1i(loc(blendProg, 'u_blend'), u.blend)
          g.uniform1i(loc(blendProg, 'u_composite'), u.composite)
          g.uniform1i(loc(blendProg, 'u_blendSpace'), u.blendSpace)
          g.uniform1i(loc(blendProg, 'u_compositeSpace'), u.compositeSpace)
          g.uniform1i(loc(blendProg, 'u_clip'), input.clipToBackdrop ? 1 : 0)
        }

        drawFullscreen()
        const tmp = read
        read = write
        write = tmp
      }

      for (const tex of temps) g.deleteTexture(tex)
      sweepTexCache()
      sweepInstanceCache()

      if (target) {
        const dst = targets.get(target.id)
        if (dst) blit(read, dst)
        return
      }

      if (!result || result.width !== width || result.height !== height) {
        if (result) freeTargetObj(result)
        result = makeTarget(width, height)
        resultValid = false
      }
      blit(read, result)
      if (clip) g.disable(g.SCISSOR_TEST)
      resultValid = true
    },

    allocTarget(w: number, h: number): FBOHandle {
      const id = nextHandle++
      if (gl) targets.set(id, makeTarget(w, h))
      return { id, width: w, height: h }
    },

    freeTarget(handle: FBOHandle): void {
      const t = targets.get(handle.id)
      if (t) {
        freeTargetObj(t)
        targets.delete(handle.id)
      }
    },

    targetTexture(handle: FBOHandle): WebGLTexture {
      const t = targets.get(handle.id)
      if (!t) {
        if (!gl) return {} as WebGLTexture
        throw new Error(`Unknown target: ${handle.id}`)
      }
      return t.tex
    },

    upload(source: HTMLCanvasElement | ImageBitmap | OffscreenCanvas): WebGLTexture {
      return uploadSource(source)
    },

    readback(region?: Rect): ImageData {
      const empty = () => new ImageData(Math.max(1, width), Math.max(1, height))
      if (!ensureHealthy() || !gl || !ping) return empty()
      const g = gl

      let clip: Rect | null = null
      if (region) {
        const x = Math.max(0, Math.floor(region.x))
        const y = Math.max(0, Math.floor(region.y))
        const w = Math.min(width, Math.ceil(region.x + region.w)) - x
        const h = Math.min(height, Math.ceil(region.y + region.h)) - y
        if (w <= 0 || h <= 0) return new ImageData(1, 1)
        if (w < width || h < height) clip = { x, y, w, h }
      }

      presentToDefault(result ?? ping, clip)
      g.bindFramebuffer(g.FRAMEBUFFER, null)
      if (clip) {
        const px = new Uint8ClampedArray(clip.w * clip.h * 4)
        g.readPixels(clip.x, height - (clip.y + clip.h), clip.w, clip.h, g.RGBA, g.UNSIGNED_BYTE, px)
        flipRows(px, clip.w, clip.h)
        return new ImageData(px, clip.w, clip.h)
      }
      const px = new Uint8ClampedArray(width * height * 4)
      g.readPixels(0, 0, width, height, g.RGBA, g.UNSIGNED_BYTE, px)
      flipRows(px, width, height)
      return new ImageData(px, width, height)
    },

    presentCanvas(clip?: Rect | null): HTMLCanvasElement | OffscreenCanvas | null {
      if (!ensureHealthy() || !gl || !ping) return null
      let c: Rect | null = null
      if (clip) {
        const x = Math.max(0, Math.floor(clip.x))
        const y = Math.max(0, Math.floor(clip.y))
        const w = Math.min(width, Math.ceil(clip.x + clip.w)) - x
        const h = Math.min(height, Math.ceil(clip.y + clip.h)) - y
        if (w <= 0 || h <= 0) return canvas
        if (w < width || h < height) c = { x, y, w, h }
      }
      presentToDefault(result ?? ping, c)
      return canvas
    },

    async toBlob(): Promise<Blob> {
      const data = this.readback()
      const c = document.createElement('canvas')
      c.width = data.width
      c.height = data.height
      c.getContext('2d')!.putImageData(data, 0, 0)
      return await new Promise<Blob>((res, rej) =>
        c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
      )
    },

    getCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
      return canvas
    },

    debugStats() {
      const a = atlas?.stats() ?? { atlases: 0, residentSlots: 0, vramBytes: 0 }
      return {
        tilePasses,
        atlases: a.atlases,
        atlasSlots: a.residentSlots,
        atlasVramBytes: a.vramBytes,
        texCacheEntries: texCache.size,
      }
    },

    dispose(): void {
      disposed = true
      if (!gl) return
      if (ping) freeTargetObj(ping)
      if (pong) freeTargetObj(pong)
      if (result) freeTargetObj(result)
      for (const t of targets.values()) freeTargetObj(t)
      targets.clear()
      for (const entry of texCache.values()) gl.deleteTexture(entry.tex)
      texCache.clear()
      if (fallback) gl.deleteTexture(fallback)
      if (lutTex) gl.deleteTexture(lutTex)
      for (const entry of instanceCache.values()) gl.deleteBuffer(entry.buffer)
      instanceCache.clear()
      atlas?.dispose()
      atlas = null
      if (tileProg) gl.deleteProgram(tileProg)
      tileProg = null
      if (blendProg) gl.deleteProgram(blendProg)
      if (presentProg) gl.deleteProgram(presentProg)
      if (copyProg) gl.deleteProgram(copyProg)
      if (adjustProg) gl.deleteProgram(adjustProg)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      gl = null
      ping = pong = result = null
      lutTex = null
      fallback = blendProg = presentProg = copyProg = adjustProg = null
    },
  }

  function presentToDefault(src: Target, clip?: Rect | null): void {
    const g = gl!
    g.disable(g.SCISSOR_TEST)
    if (clip) {
      g.enable(g.SCISSOR_TEST)
      g.scissor(clip.x, height - (clip.y + clip.h), clip.w, clip.h)
    }
    g.useProgram(presentProg!)
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    g.viewport(0, 0, width, height)
    g.clearColor(0, 0, 0, 0)
    g.clear(g.COLOR_BUFFER_BIT)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, src.tex)
    g.uniform1i(loc(presentProg!, 'u_tex'), 0)
    drawFullscreen()
    if (clip) g.disable(g.SCISSOR_TEST)
  }

  function blit(src: Target, dst: Target): void {
    const g = gl!
    g.useProgram(copyProg!)
    g.bindFramebuffer(g.FRAMEBUFFER, dst.fbo)
    g.viewport(0, 0, dst.width, dst.height)
    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, src.tex)
    g.uniform1i(loc(copyProg!, 'u_tex'), 0)
    drawFullscreen()
  }
}

function flipRows(px: Uint8ClampedArray, w: number, h: number): void {
  const row = w * 4
  const tmp = new Uint8ClampedArray(row)
  for (let y = 0; y < h >> 1; y++) {
    const top = y * row
    const bot = (h - 1 - y) * row
    tmp.set(px.subarray(top, top + row))
    px.copyWithin(top, bot, bot + row)
    px.set(tmp, bot)
  }
}
