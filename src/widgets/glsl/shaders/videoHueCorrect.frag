#version 300 es
precision highp float;

uniform sampler2D u_image0;
uniform sampler2D u_curve0;
uniform sampler2D u_curve1;
uniform sampler2D u_curve2;
uniform sampler2D u_curve3;
uniform sampler2D u_curve4;
uniform sampler2D u_curve5;
uniform sampler2D u_curve6;
uniform sampler2D u_curve7;
uniform sampler2D u_curve8;
uniform float u_float0;
uniform float u_float1;
uniform bool u_bool0;

in vec2 v_texCoord;
out vec4 fragColor;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float EPS = 1e-8;

float sampleLut(sampler2D lut, float coord) {
    float idx = clamp(coord, 0.0, 1.0) * 255.0;
    int lo = int(floor(idx));
    int hi = min(lo + 1, 255);
    float f = idx - float(lo);
    return mix(texelFetch(lut, ivec2(lo, 0), 0).r,
               texelFetch(lut, ivec2(hi, 0), 0).r, f);
}

vec3 rgbToHsv(vec3 c) {
    float maxc = c.r;
    int argmax = 0;
    if (c.g > maxc) { maxc = c.g; argmax = 1; }
    if (c.b > maxc) { maxc = c.b; argmax = 2; }
    float minc = min(c.r, min(c.g, c.b));
    float deltac = maxc - minc;
    float s = deltac / (maxc + EPS);
    float dc = deltac == 0.0 ? 1.0 : deltac;
    vec3 comp = vec3(maxc) - c;
    float h;
    if (argmax == 0) h = comp.b - comp.g;
    else if (argmax == 1) h = comp.r - comp.b + 2.0 * dc;
    else h = comp.g - comp.r + 4.0 * dc;
    h = fract(h / dc / 6.0);
    return vec3(h, s, maxc);
}

vec3 hsvToRgb(vec3 hsv) {
    float h6 = fract(hsv.x) * 6.0;
    float hi = floor(h6);
    float f = h6 - hi;
    float v = hsv.z;
    float s = hsv.y;
    float p = v * (1.0 - s);
    float q = v * (1.0 - f * s);
    float t = v * (1.0 - (1.0 - f) * s);
    int i = int(hi) % 6;
    if (i == 0) return vec3(v, t, p);
    if (i == 1) return vec3(q, v, p);
    if (i == 2) return vec3(p, v, t);
    if (i == 3) return vec3(p, q, v);
    if (i == 4) return vec3(t, p, v);
    return vec3(v, p, q);
}

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    vec3 src = clamp(tex.rgb, 0.0, 1.0);
    vec3 hsv = rgbToHsv(src);
    float h0 = hsv.x;
    float s = hsv.y;
    float hx = h0 * 6.0 + 1.0;
    hx = (hx > 6.0 ? hx - 6.0 : hx) / 6.0;
    float lumIn = dot(tex.rgb, LUMA);

    vec3 outc = src;
    if (u_bool0) {
        float hueShift = sampleLut(u_curve8, hx);
        float h1 = fract(h0 + (hueShift - 1.0) / 2.0);
        outc = hsvToRgb(vec3(h1, s, hsv.z));
    }

    float rSup = sampleLut(u_curve5, hx);
    float mn = min(outc.g, outc.b);
    if (outc.r > mn) outc.r = mn + rSup * (outc.r - mn);
    float gSup = sampleLut(u_curve6, hx);
    mn = min(outc.r, outc.b);
    if (outc.g > mn) outc.g = mn + gSup * (outc.g - mn);
    float bSup = sampleLut(u_curve7, hx);
    mn = min(outc.r, outc.g);
    if (outc.b > mn) outc.b = mn + bSup * (outc.b - mn);

    float lumGain = sampleLut(u_curve1, hx);
    vec3 gains = vec3(sampleLut(u_curve2, hx),
                      sampleLut(u_curve3, hx),
                      sampleLut(u_curve4, hx)) * lumGain;
    float thr = clamp(u_float0, 0.0, 1.0);
    if (thr > 0.0) {
        vec3 factor = s > thr
            ? (thr + (s - thr) * gains) / max(s, 1e-6)
            : vec3(1.0);
        outc *= factor;
    } else {
        outc *= gains;
    }

    float satGain = sampleLut(u_curve0, hx);
    float lSat = dot(outc, LUMA);
    outc = mix(vec3(lSat), outc, satGain);

    float mixv = clamp(u_float1, 0.0, 1.0);
    if (mixv > 0.0) {
        float lumOut = max(dot(outc, LUMA), 1e-6);
        outc *= 1.0 + mixv * (lumIn / lumOut - 1.0);
    }

    fragColor = vec4(clamp(outc, 0.0, 1.0), tex.a);
}
