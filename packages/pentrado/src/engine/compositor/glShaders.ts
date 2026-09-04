import LAYER_BLEND_FRAG from './shaders/layerBlend.frag?raw'

export { LAYER_BLEND_FRAG }

export const BLEND_COMMON = LAYER_BLEND_FRAG.slice(0, LAYER_BLEND_FRAG.indexOf('void main'))

export const TILE_VERT = `#version 300 es
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

export const TILE_MAIN = `
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

export const VERT = `#version 300 es
out vec2 v_texCoord;
void main() {
  vec2 v[3] = vec2[](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  v_texCoord = v[gl_VertexID] * 0.5 + 0.5;
  gl_Position = vec4(v[gl_VertexID], 0.0, 1.0);
}`

export const PRESENT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_texCoord;
out vec4 fragColor;
float lin2srgb(float c){ c = clamp(c, 0.0, 1.0); return c <= 0.0031308 ? 12.92*c : 1.055*pow(c,1.0/2.4)-0.055; }
void main(){
  vec4 c = texture(u_tex, v_texCoord);
  fragColor = vec4(lin2srgb(c.r), lin2srgb(c.g), lin2srgb(c.b), clamp(c.a, 0.0, 1.0));
}`

export const COPY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_texCoord;
out vec4 fragColor;
void main(){ fragColor = texture(u_tex, v_texCoord); }`

export const ADJUST_FRAG = `#version 300 es
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

export interface Target {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
  width: number
  height: number
}

export function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
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

export function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
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

export function flipRows(px: Uint8ClampedArray, w: number, h: number): void {
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
