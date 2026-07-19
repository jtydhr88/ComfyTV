#version 300 es
precision highp float;

#pragma passes 3

uniform sampler2D u_image0;
uniform sampler2D u_image1;
uniform sampler2D u_curve0;
uniform sampler2D u_curve1;
uniform sampler2D u_curve2;
uniform vec2 u_resolution;
uniform int u_pass;
uniform int u_int0;
uniform int u_int1;
uniform int u_int2;
uniform int u_int3;
uniform float u_float0;
uniform float u_float1;
uniform float u_float2;

in vec2 v_texCoord;
out vec4 fragColor;

vec3 bytes(vec3 c) {
    return floor(c * 255.0 + 0.5);
}

vec3 rgbToYuv(vec3 c) {
    return vec3(
        16.0 + 65.481 * c.r + 128.553 * c.g + 24.966 * c.b,
        128.0 - 37.797 * c.r - 74.203 * c.g + 112.0 * c.b,
        128.0 + 112.0 * c.r - 93.786 * c.g - 18.214 * c.b);
}

vec3 yuvToRgb(vec3 yuv) {
    float y = (yuv.x - 16.0) / 219.0;
    float pb = (yuv.y - 128.0) / 224.0;
    float pr = (yuv.z - 128.0) / 224.0;
    return clamp(vec3(
        y + 1.402 * pr,
        y - 0.344136 * pb - 0.714136 * pr,
        y + 1.772 * pb), 0.0, 1.0);
}

float vigFactor(vec2 px) {
    vec2 hc = u_resolution * 0.5;
    vec2 d = trunc(px - hc);
    float dnorm = length(d) / length(hc);
    if (dnorm > 1.0) return 0.0;
    float c = cos(clamp(u_float0, 0.0, 1.5707964) * dnorm);
    return (c * c) * (c * c);
}

float hash01(ivec2 p, int frame, int plane) {
    uint h = uint(p.x) * 374761393u + uint(p.y) * 668265263u
        + uint(frame) * 2246822519u + uint(plane) * 3266489917u;
    h ^= h >> 16;
    h *= 2654435761u;
    h ^= h >> 13;
    h *= 2246822519u;
    h ^= h >> 16;
    return float(h) * (1.0 / 4294967296.0);
}

float noiseOff(ivec2 p, int plane) {
    float s = float(u_int2);
    return floor(hash01(p, u_int3, plane) * s) - float(u_int2 / 2);
}

vec3 applyVignette(vec3 c, ivec2 px) {
    float f = vigFactor(vec2(px));
    vec3 yuv = rgbToYuv(c);
    return yuvToRgb(vec3(
        clamp(floor(yuv.x * f), 0.0, 255.0),
        clamp(floor(f * (yuv.y - 127.0) + 127.0), 0.0, 255.0),
        clamp(floor(f * (yuv.z - 127.0) + 127.0), 0.0, 255.0)));
}

vec3 applyGrain(vec3 c, ivec2 px) {
    vec3 yuv = rgbToYuv(c);
    yuv.x = clamp(yuv.x + noiseOff(px, 0), 0.0, 255.0);
    yuv.y = clamp(yuv.y + noiseOff(px, 1), 0.0, 255.0);
    yuv.z = clamp(yuv.z + noiseOff(px, 2), 0.0, 255.0);
    return yuvToRgb(yuv);
}

vec3 applySepia(vec3 c) {
    vec3 b = bytes(c);
    vec3 mixed = vec3(
        floor(b.r * 0.393 + 0.5) + floor(b.g * 0.769 + 0.5) + floor(b.b * 0.189 + 0.5),
        floor(b.r * 0.349 + 0.5) + floor(b.g * 0.686 + 0.5) + floor(b.b * 0.168 + 0.5),
        floor(b.r * 0.272 + 0.5) + floor(b.g * 0.534 + 0.5) + floor(b.b * 0.131 + 0.5));
    return clamp(mixed, 0.0, 255.0) / 255.0;
}

vec3 applyMonochrome(vec3 c) {
    vec3 yuv = rgbToYuv(c);
    float y = yuv.x / 255.0;
    float u = yuv.y / 255.0 - 0.5;
    float v = yuv.z / 255.0 - 0.5;
    float ny = exp(-clamp(u * u + v * v, 0.0, 1.0));
    float y2 = clamp(floor(ny * y * 255.0 + 0.5), 0.0, 255.0);
    return yuvToRgb(vec3(y2, 128.0, 128.0));
}

float curveAt(sampler2D lut, float b) {
    int idx = int(clamp(b, 0.0, 255.0));
    return texelFetch(lut, ivec2(idx, 0), 0).r * 255.0;
}

vec3 applyOldFilm(vec3 c, ivec2 px) {
    vec3 b = bytes(c);
    b = vec3(curveAt(u_curve0, b.r), curveAt(u_curve1, b.g), curveAt(u_curve2, b.b));
    b.r = clamp(b.r + noiseOff(px, 0), 0.0, 255.0);
    b.g = clamp(b.g + noiseOff(px, 1), 0.0, 255.0);
    b.b = clamp(b.b + noiseOff(px, 2), 0.0, 255.0);
    float f = vigFactor(vec2(px));
    return clamp(floor(b * f), 0.0, 255.0) / 255.0;
}

vec4 pixelizeRows(ivec2 t) {
    int w = int(u_resolution.x);
    int b = max(1, u_int1);
    int bx = (t.x / b) * b;
    int bw = min(b, w - bx);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 64; i++) {
        if (i >= bw) break;
        acc += texelFetch(u_image0, ivec2(bx + i, t.y), 0).rgb;
    }
    return vec4(acc / float(bw), 1.0);
}

vec4 pixelizeCols(ivec2 t) {
    int h = int(u_resolution.y);
    int b = max(1, u_int1);
    int vy = h - 1 - t.y;
    int vby = (vy / b) * b;
    int bh = min(b, h - vby);
    vec3 acc = vec3(0.0);
    for (int j = 0; j < 64; j++) {
        if (j >= bh) break;
        acc += texelFetch(u_image0, ivec2(t.x, h - 1 - (vby + j)), 0).rgb;
    }
    return vec4(acc / float(bh), 1.0);
}

vec4 edgeGaussian(ivec2 t) {
    int w = int(u_resolution.x);
    int h = int(u_resolution.y);
    vec3 src = bytes(texelFetch(u_image0, t, 0).rgb);
    if (t.x < 2 || t.x >= w - 2 || t.y < 2 || t.y >= h - 2) {
        return vec4(src, 255.0);
    }
    float k[25] = float[25](
        2.0, 4.0, 5.0, 4.0, 2.0,
        4.0, 9.0, 12.0, 9.0, 4.0,
        5.0, 12.0, 15.0, 12.0, 5.0,
        4.0, 9.0, 12.0, 9.0, 4.0,
        2.0, 4.0, 5.0, 4.0, 2.0);
    vec3 acc = vec3(0.0);
    for (int dy = -2; dy <= 2; dy++) {
        for (int dx = -2; dx <= 2; dx++) {
            acc += k[(dy + 2) * 5 + dx + 2]
                * bytes(texelFetch(u_image0, t + ivec2(dx, dy), 0).rgb);
        }
    }
    return vec4(floor(acc / 159.0 + 1e-3), 255.0);
}

void sobelAt(ivec2 t, out vec3 gx, out vec3 gy) {
    vec3 a = texelFetch(u_image0, t + ivec2(-1, -1), 0).rgb;
    vec3 b = texelFetch(u_image0, t + ivec2(0, -1), 0).rgb;
    vec3 c = texelFetch(u_image0, t + ivec2(1, -1), 0).rgb;
    vec3 d = texelFetch(u_image0, t + ivec2(-1, 0), 0).rgb;
    vec3 f = texelFetch(u_image0, t + ivec2(1, 0), 0).rgb;
    vec3 g = texelFetch(u_image0, t + ivec2(-1, 1), 0).rgb;
    vec3 hh = texelFetch(u_image0, t + ivec2(0, 1), 0).rgb;
    vec3 i = texelFetch(u_image0, t + ivec2(1, 1), 0).rgb;
    gx = -a + c - 2.0 * d + 2.0 * f - g + i;
    gy = -a + g - 2.0 * b + 2.0 * hh - c + i;
}

vec3 sobelMagAt(ivec2 t, int w, int h) {
    if (t.x < 1 || t.x >= w - 1 || t.y < 1 || t.y >= h - 1) return vec3(0.0);
    vec3 gx;
    vec3 gy;
    sobelAt(t, gx, gy);
    return abs(gx) + abs(gy);
}

int dirClass(float gxf, float gyf) {
    int gx = int(gxf);
    int gy = int(gyf);
    if (gx != 0) {
        if (gx < 0) {
            gx = -gx;
            gy = -gy;
        }
        int gy16 = gy * 65536;
        int tanPi8 = 27146 * gx;
        int tan3Pi8 = 158218 * gx;
        if (gy16 > -tan3Pi8 && gy16 < -tanPi8) return 0;
        if (gy16 > -tanPi8 && gy16 < tanPi8) return 2;
        if (gy16 > tanPi8 && gy16 < tan3Pi8) return 1;
    }
    return 3;
}

vec4 edgeSobelNms(ivec2 t) {
    int w = int(u_resolution.x);
    int h = int(u_resolution.y);
    if (t.x < 1 || t.x >= w - 1 || t.y < 1 || t.y >= h - 1) {
        return vec4(0.0, 0.0, 0.0, 255.0);
    }
    vec3 gx;
    vec3 gy;
    sobelAt(t, gx, gy);
    vec3 mag = abs(gx) + abs(gy);
    vec3 res = vec3(0.0);
    for (int ch = 0; ch < 3; ch++) {
        int dir = dirClass(gx[ch], gy[ch]);
        ivec2 o1 = dir == 0 ? ivec2(-1, 1)
            : dir == 1 ? ivec2(-1, -1)
            : dir == 2 ? ivec2(-1, 0)
            : ivec2(0, -1);
        ivec2 o2 = -o1;
        float m1 = sobelMagAt(t + o1, w, h)[ch];
        float m2 = sobelMagAt(t + o2, w, h)[ch];
        if (mag[ch] > m1 && mag[ch] > m2) res[ch] = min(mag[ch], 255.0);
    }
    return vec4(res, 255.0);
}

vec4 edgeThreshold(ivec2 t) {
    int w = int(u_resolution.x);
    int h = int(u_resolution.y);
    vec3 nms = texelFetch(u_image0, t, 0).rgb;
    vec3 orig = bytes(texture(u_image1, v_texCoord).rgb);
    bool interior = t.x > 0 && t.x < w - 1 && t.y > 0 && t.y < h - 1;
    vec3 maxN = vec3(0.0);
    if (interior) {
        for (int dy = -1; dy <= 1; dy++) {
            for (int dx = -1; dx <= 1; dx++) {
                if (dx == 0 && dy == 0) continue;
                maxN = max(maxN, texelFetch(u_image0, t + ivec2(dx, dy), 0).rgb);
            }
        }
    }
    vec3 res;
    for (int ch = 0; ch < 3; ch++) {
        float v = nms[ch];
        float kept = 0.0;
        if (v > u_float2) kept = v;
        else if (interior && v > u_float1 && maxN[ch] > u_float2) kept = v;
        res[ch] = floor((kept + orig[ch]) * 0.5);
    }
    return vec4(res / 255.0, 1.0);
}

void main() {
    ivec2 t = ivec2(gl_FragCoord.xy);
    ivec2 vp = ivec2(t.x, int(u_resolution.y) - 1 - t.y);
    if (u_int0 == 2) {
        if (u_pass == 0) fragColor = pixelizeRows(t);
        else if (u_pass == 1) fragColor = pixelizeCols(t);
        else fragColor = vec4(texelFetch(u_image0, t, 0).rgb, 1.0);
        return;
    }
    if (u_int0 == 3) {
        if (u_pass == 0) fragColor = edgeGaussian(t);
        else if (u_pass == 1) fragColor = edgeSobelNms(t);
        else fragColor = edgeThreshold(t);
        return;
    }
    if (u_pass < 2) {
        fragColor = vec4(0.0);
        return;
    }
    vec4 tex = texture(u_image1, v_texCoord);
    vec3 c = tex.rgb;
    if (u_int0 == 0) c = applyVignette(c, vp);
    else if (u_int0 == 1) c = applyGrain(c, vp);
    else if (u_int0 == 4) c = applySepia(c);
    else if (u_int0 == 5) c = applyMonochrome(c);
    else if (u_int0 == 6) c = applyOldFilm(c, vp);
    fragColor = vec4(c, tex.a);
}
