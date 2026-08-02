#version 300 es

precision highp float;

uniform sampler2D u_backdrop;
uniform sampler2D u_layer;
uniform sampler2D u_mask;
uniform bool  u_hasMask;
uniform bool  u_srgbLayer;
uniform float u_opacity;
uniform int   u_blend;
uniform int   u_composite;
uniform int   u_blendSpace;
uniform int   u_compositeSpace;

uniform vec2  u_docSize;
uniform bool  u_hasQuad;
uniform vec2  u_quadCenter;
uniform vec2  u_quadRot;
uniform vec2  u_quadSize;
uniform vec2  u_srcSize;
uniform bool  u_maskHasQuad;
uniform vec2  u_maskQuadCenter;
uniform vec2  u_maskQuadRot;
uniform vec2  u_maskQuadSize;
uniform vec2  u_maskSrcSize;

in vec2 v_texCoord;
out vec4 fragColor;

/* Sample a content-sized texture placed as a doc-space quad. The last
   component of the return carries edge coverage in [0,1] (1px AA ramp). */
vec4 sampleQuad(sampler2D tex, vec2 center, vec2 rot, vec2 size, vec2 srcSize, out float cov) {
  vec2 docPx = vec2(v_texCoord.x * u_docSize.x, (1.0 - v_texCoord.y) * u_docSize.y);
  vec2 d = docPx - center;
  vec2 r = vec2(rot.x * d.x + rot.y * d.y, -rot.y * d.x + rot.x * d.y);
  vec2 local = r / size + 0.5;
  vec2 px = local * srcSize;
  vec2 c2 = clamp(min(px, srcSize - px) + 0.5, 0.0, 1.0);
  cov = c2.x * c2.y;
  return texture(tex, vec2(local.x, 1.0 - local.y));
}

const float EPS = 1e-6;

float safeDiv(float a, float b) {
  return abs(a) <= EPS ? 0.0 : clamp(a / b, -1e6, 1e6);
}

float srgbToLinear(float c) {
  return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}
float linearToSrgb(float c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}
vec3 srgbToLinear(vec3 c) { return vec3(srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b)); }
vec3 linearToSrgb(vec3 c) { return vec3(linearToSrgb(c.r), linearToSrgb(c.g), linearToSrgb(c.b)); }

vec3 toSpace(vec3 c, int space)   { return space == 0 ? c : linearToSrgb(c); }
vec3 fromSpace(vec3 c, int space) { return space == 0 ? c : srgbToLinear(c); }

float luminance(vec3 c) { return dot(c, vec3(0.22248840, 0.71690369, 0.06060791)); }

float blendChannel(int mode, float i, float l) {
  if (mode == 1)  return i * l;
  if (mode == 2)  return 1.0 - (1.0 - i) * (1.0 - l);
  if (mode == 3)  return i < 0.5 ? 2.0*i*l : 1.0 - 2.0*(1.0-l)*(1.0-i);
  if (mode == 4)  return min(i, l);
  if (mode == 5)  return max(i, l);
  if (mode == 6)  return safeDiv(i, 1.0 - l);
  if (mode == 7)  return 1.0 - safeDiv(1.0 - i, l);
  if (mode == 8)  return l > 0.5 ? min(1.0 - (1.0-i)*(1.0-(l-0.5)*2.0), 1.0)
                                 : min(i*(l*2.0), 1.0);
  if (mode == 9) {
    float m = i * l;
    float s = 1.0 - (1.0 - i) * (1.0 - l);
    return (1.0 - i) * m + i * s;
  }
  if (mode == 10) return abs(i - l);
  if (mode == 11) return 0.5 - 2.0*(i-0.5)*(l-0.5);
  if (mode == 12) return i + l;
  if (mode == 13) return i + l - 1.0;
  if (mode == 14) return l <= 0.5 ? max(1.0 - safeDiv(1.0-i, 2.0*l), 0.0)
                                  : min(safeDiv(i, 2.0*(1.0-l)), 1.0);
  if (mode == 15) return l > 0.5 ? max(i, 2.0*(l-0.5)) : min(i, 2.0*l);
  if (mode == 20) return i + 2.0*l - 1.0;
  if (mode == 21) return i + l < 1.0 ? 0.0 : 1.0;
  if (mode == 22) return i - l;
  if (mode == 23) return safeDiv(i, l);
  if (mode == 24) return i - l + 0.5;
  if (mode == 25) return i + l - 0.5;
  return l;
}

vec3 blendHue(vec3 i, vec3 l) {
  float sMin = min(min(l.r, l.g), l.b), sMax = max(max(l.r, l.g), l.b);
  float sDelta = sMax - sMin;
  if (sDelta <= EPS) return i;
  float dMin = min(min(i.r, i.g), i.b), dMax = max(max(i.r, i.g), i.b);
  float dDelta = dMax - dMin;
  float dS = dMax != 0.0 ? dDelta / dMax : 0.0;
  float ratio = (dS * dMax) / sDelta;
  float offset = dMax - sMax * ratio;
  return l * ratio + offset;
}
vec3 blendSaturation(vec3 i, vec3 l) {
  float dMin = min(min(i.r, i.g), i.b), dMax = max(max(i.r, i.g), i.b);
  float dDelta = dMax - dMin;
  if (dDelta <= EPS) return vec3(dMax);
  float sMin = min(min(l.r, l.g), l.b), sMax = max(max(l.r, l.g), l.b);
  float sDelta = sMax - sMin;
  float sS = sMax != 0.0 ? sDelta / sMax : 0.0;
  float ratio = (sS * dMax) / dDelta;
  float offset = (1.0 - ratio) * dMax;
  return i * ratio + offset;
}
vec3 blendColor(vec3 i, vec3 l) {
  float dMin = min(min(i.r, i.g), i.b), dMax = max(max(i.r, i.g), i.b);
  float dL = (dMin + dMax) * 0.5;
  float sMin = min(min(l.r, l.g), l.b), sMax = max(max(l.r, l.g), l.b);
  float sL = (sMin + sMax) * 0.5;
  if (abs(sL) <= EPS || abs(1.0 - sL) <= EPS) return vec3(dL);
  bool dHigh = dL > 0.5, sHigh = sL > 0.5;
  dL = min(dL, 1.0 - dL);
  sL = min(sL, 1.0 - sL);
  float ratio = dL / sL;
  float offset = 0.0;
  if (dHigh) offset += 1.0 - 2.0 * dL;
  if (sHigh) offset += 2.0 * dL - ratio;
  return l * ratio + offset;
}
vec3 blendLuminosity(vec3 i, vec3 l) {
  return i * safeDiv(luminance(l), luminance(i));
}

vec3 blendPixel(int mode, vec3 i, vec3 l) {
  if (mode == 16) return blendHue(i, l);
  if (mode == 17) return blendSaturation(i, l);
  if (mode == 18) return blendColor(i, l);
  if (mode == 19) return blendLuminosity(i, l);
  return vec3(blendChannel(mode, i.r, l.r), blendChannel(mode, i.g, l.g), blendChannel(mode, i.b, l.b));
}

vec4 composite(int mode, vec4 bg, vec4 layer, vec3 comp, float cov) {
  float inA = bg.a;
  float layerA = layer.a * cov;
  if (mode == 1) {
    if (inA == 0.0 || layerA == 0.0) return vec4(bg.rgb, inA);
    return vec4(comp * layerA + bg.rgb * (1.0 - layerA), inA);
  }
  if (mode == 2) {
    if (layerA == 0.0) return vec4(bg.rgb, layerA);
    if (inA == 0.0)    return vec4(layer.rgb, layerA);
    return vec4(comp * inA + layer.rgb * (1.0 - inA), layerA);
  }
  if (mode == 3) {
    float newA = inA * layer.a * cov;
    return newA == 0.0 ? vec4(bg.rgb, 0.0) : vec4(comp, newA);
  }

  float newA = layerA + (1.0 - layerA) * inA;
  if (layerA == 0.0 || newA == 0.0) return vec4(bg.rgb, newA);
  if (inA == 0.0)                   return vec4(layer.rgb, newA);
  float ratio = layerA / newA;
  vec3 outRgb = ratio * (inA * (comp - layer.rgb) + layer.rgb - bg.rgb) + bg.rgb;
  return vec4(outRgb, newA);
}

void main() {
  vec4 bg = texture(u_backdrop, v_texCoord);
  vec4 layer;
  if (u_hasQuad) {
    float edge;
    layer = sampleQuad(u_layer, u_quadCenter, u_quadRot, u_quadSize, u_srcSize, edge);
    layer.a *= edge;
  } else {
    layer = texture(u_layer, v_texCoord);
  }
  if (u_srgbLayer) layer.rgb = srgbToLinear(layer.rgb);

  float cov = u_opacity;
  if (u_hasMask) {
    if (u_maskHasQuad) {
      float medge;
      cov *= sampleQuad(u_mask, u_maskQuadCenter, u_maskQuadRot, u_maskQuadSize, u_maskSrcSize, medge).r * medge;
    } else {
      cov *= texture(u_mask, v_texCoord).r;
    }
  }

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
}
