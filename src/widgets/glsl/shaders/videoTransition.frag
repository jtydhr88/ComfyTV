#version 300 es
precision highp float;

uniform sampler2D u_image0;
uniform sampler2D u_image1;
uniform vec2 u_resolution;
uniform float u_float0;
uniform int u_int0;

in vec2 v_texCoord;
out vec4 fragColor;

const float PI = 3.14159265358979;

vec4 srcA(vec2 p) {
    return texture(u_image0, vec2((p.x + 0.5) / u_resolution.x, 1.0 - (p.y + 0.5) / u_resolution.y));
}

vec4 srcB(vec2 p) {
    return texture(u_image1, vec2((p.x + 0.5) / u_resolution.x, 1.0 - (p.y + 0.5) / u_resolution.y));
}

vec4 cmix(vec4 a, vec4 b, float m) {
    return mix(b, a, m);
}

float frand(float x, float y) {
    float r = sin(x * 12.9898 + y * 78.233) * 43758.545;
    return r - floor(r);
}

vec4 fadeMeta(vec4 a, vec4 b, vec4 bg0, vec4 bg1, float P) {
    return cmix(cmix(a, bg0, smoothstep(0.8, 1.0, P)),
                cmix(bg1, b, smoothstep(0.2, 1.0, P)), P);
}

void main() {
    float w = u_resolution.x;
    float h = u_resolution.y;
    float P = clamp(u_float0, 0.0, 1.0);
    int m = u_int0;
    float xi = floor(v_texCoord.x * w);
    float yi = floor((1.0 - v_texCoord.y) * h);
    vec2 p0 = vec2(xi, yi);
    vec4 A = texture(u_image0, v_texCoord);
    vec4 B = texture(u_image1, v_texCoord);
    vec4 outc = A;

    if (m == 0) {
        outc = cmix(A, B, P);
    } else if (m == 1) {
        float smoothv = frand(xi, yi) * 2.0 + P * 2.0 - 1.5;
        outc = smoothv >= 0.5 ? A : B;
    } else if (m == 2) {
        outc = fadeMeta(A, B, vec4(0.0, 0.0, 0.0, 1.0), vec4(0.0, 0.0, 0.0, 1.0), P);
    } else if (m == 3) {
        outc = fadeMeta(A, B, vec4(1.0), vec4(1.0), P);
    } else if (m == 4) {
        vec4 g0 = vec4(vec3(dot(A.rgb, vec3(1.0 / 3.0))), A.a);
        vec4 g1 = vec4(vec3(dot(B.rgb, vec3(1.0 / 3.0))), B.a);
        outc = fadeMeta(A, B, g0, g1, P);
    } else if (m == 5) {
        vec4 e = pow(vec4(P), vec4(1.0) + log(vec4(1.0) + abs(A - B)));
        outc = A * e + B * (vec4(1.0) - e);
    } else if (m == 6) {
        vec4 e = pow(vec4(P), vec4(1.0) + log(vec4(2.0) - abs(A - B)));
        outc = A * e + B * (vec4(1.0) - e);
    } else if (m == 7) {
        outc = xi > floor(w * P) ? B : A;
    } else if (m == 8) {
        outc = xi > floor(w * (1.0 - P)) ? A : B;
    } else if (m == 9) {
        outc = yi > floor(h * P) ? B : A;
    } else if (m == 10) {
        outc = yi > floor(h * (1.0 - P)) ? A : B;
    } else if (m == 11) {
        outc = (yi <= floor(h * P) && xi <= floor(w * P)) ? A : B;
    } else if (m == 12) {
        outc = (yi <= floor(h * P) && xi > floor(w * (1.0 - P))) ? A : B;
    } else if (m == 13) {
        outc = (yi > floor(h * (1.0 - P)) && xi <= floor(w * P)) ? A : B;
    } else if (m == 14) {
        outc = (yi > floor(h * (1.0 - P)) && xi > floor(w * (1.0 - P))) ? A : B;
    } else if (m == 15 || m == 16) {
        float z = (m == 15 ? -P : P) * w;
        float zx = floor(z) + xi;
        vec2 s = vec2(mod(zx, w), yi);
        outc = (zx >= 0.0 && zx < w) ? srcB(s) : srcA(s);
    } else if (m == 17 || m == 18) {
        float z = (m == 17 ? -P : P) * h;
        float zy = floor(z) + yi;
        vec2 s = vec2(xi, mod(zy, h));
        outc = (zy >= 0.0 && zy < h) ? srcB(s) : srcA(s);
    } else if (m == 19) {
        outc = mix(A, B, smoothstep(0.0, 1.0, 1.0 + xi / w - P * 2.0));
    } else if (m == 20) {
        outc = mix(A, B, smoothstep(0.0, 1.0, 1.0 + (w - 1.0 - xi) / w - P * 2.0));
    } else if (m == 21) {
        outc = mix(A, B, smoothstep(0.0, 1.0, 1.0 + yi / h - P * 2.0));
    } else if (m == 22) {
        outc = mix(A, B, smoothstep(0.0, 1.0, 1.0 + (h - 1.0 - yi) / h - P * 2.0));
    } else if (m == 23) {
        float z = pow(2.0 * abs(P - 0.5), 3.0) * length(vec2(w, h) * 0.5);
        float dist = length(p0 - vec2(w, h) * 0.5);
        outc = z < dist ? vec4(0.0, 0.0, 0.0, 1.0) : (P < 0.5 ? B : A);
    } else if (m == 24) {
        bool inside = abs(xi - w * 0.5) < abs(P - 0.5) * w
                   && abs(yi - h * 0.5) < abs(P - 0.5) * h;
        outc = inside ? (P < 0.5 ? B : A) : vec4(0.0, 0.0, 0.0, 1.0);
    } else if (m == 25) {
        float z = length(vec2(w, h) * 0.5);
        float smoothv = length(p0 - vec2(w, h) * 0.5) / z + (P - 0.5) * 3.0;
        outc = cmix(A, B, smoothstep(0.0, 1.0, smoothv));
    } else if (m == 26) {
        float z = length(vec2(w, h) * 0.5);
        float smoothv = length(p0 - vec2(w, h) * 0.5) / z + (0.5 - P) * 3.0;
        outc = mix(A, B, smoothstep(0.0, 1.0, smoothv));
    } else if (m == 27) {
        float w2 = w * 0.5;
        outc = mix(A, B, smoothstep(0.0, 1.0, 2.0 - abs((xi - w2) / w2) - P * 2.0));
    } else if (m == 28) {
        float w2 = w * 0.5;
        outc = mix(A, B, smoothstep(0.0, 1.0, 1.0 + abs((xi - w2) / w2) - P * 2.0));
    } else if (m == 29) {
        float h2 = h * 0.5;
        outc = mix(A, B, smoothstep(0.0, 1.0, 2.0 - abs((yi - h2) / h2) - P * 2.0));
    } else if (m == 30) {
        float h2 = h * 0.5;
        outc = mix(A, B, smoothstep(0.0, 1.0, 1.0 + abs((yi - h2) / h2) - P * 2.0));
    } else if (m == 31) {
        outc = mix(A, B, smoothstep(0.0, 1.0, 1.0 + xi / w * yi / h - P * 2.0));
    } else if (m == 32) {
        outc = mix(A, B, smoothstep(0.0, 1.0, 1.0 + (w - 1.0 - xi) / w * yi / h - P * 2.0));
    } else if (m == 33) {
        outc = mix(A, B, smoothstep(0.0, 1.0, 1.0 + xi / w * (h - 1.0 - yi) / h - P * 2.0));
    } else if (m == 34) {
        outc = mix(A, B, smoothstep(0.0, 1.0, 1.0 + (w - 1.0 - xi) / w * (h - 1.0 - yi) / h - P * 2.0));
    } else if (m >= 35 && m <= 38) {
        float c = m == 35 ? xi / w
                : m == 36 ? (w - 1.0 - xi) / w
                : m == 37 ? yi / h
                : (h - 1.0 - yi) / h;
        float smoothv = smoothstep(-0.5, 0.0, c - P * 1.5);
        float ss = smoothv <= fract(10.0 * c) ? 0.0 : 1.0;
        outc = mix(A, B, ss);
    } else if (m >= 39 && m <= 42) {
        float c = m == 39 ? 1.0 - xi / w
                : m == 40 ? xi / w
                : m == 41 ? 1.0 - yi / h
                : yi / h;
        float r = (m <= 40) ? frand(0.0, yi) : frand(xi, 0.0);
        float ss = 1.0 - smoothstep(-0.2, 0.0, c * 0.8 + 0.2 * r - (1.0 - P) * 1.2);
        outc = mix(A, B, ss);
    } else if (m == 43 || m == 44) {
        float z = (m == 43 ? -P : P) * w;
        float zx = floor(z) + xi;
        outc = (zx >= 0.0 && zx < w) ? srcB(vec2(mod(zx, w), yi)) : A;
    } else if (m == 45 || m == 46) {
        float z = (m == 45 ? -P : P) * h;
        float zy = floor(z) + yi;
        outc = (zy >= 0.0 && zy < h) ? srcB(vec2(xi, mod(zy, h))) : A;
    } else if (m == 47 || m == 48) {
        float z = (m == 47 ? -P : P) * w;
        float zx = floor(z) + xi;
        outc = (zx >= 0.0 && zx < w) ? B : srcA(vec2(mod(zx, w), yi));
    } else if (m == 49 || m == 50) {
        float z = (m == 49 ? -P : P) * h;
        float zy = floor(z) + yi;
        outc = (zy >= 0.0 && zy < h) ? B : srcA(vec2(xi, mod(zy, h)));
    } else if (m == 51) {
        float z = 0.5 + (yi / h - 0.5) / max(P, 0.001);
        outc = (P <= 0.001 || z < 0.0 || z > 1.0) ? B : srcA(vec2(xi, floor(z * (h - 1.0) + 0.5)));
    } else if (m == 52) {
        float z = 0.5 + (xi / w - 0.5) / max(P, 0.001);
        outc = (P <= 0.001 || z < 0.0 || z > 1.0) ? B : srcA(vec2(floor(z * (w - 1.0) + 0.5), yi));
    } else if (m == 53) {
        float zf = smoothstep(0.5, 1.0, P);
        vec2 uv = vec2(xi / w, yi / h);
        uv = vec2(0.5) + (uv - vec2(0.5)) * zf;
        vec2 s = ceil(uv * (vec2(w, h) - 1.0));
        outc = mix(B, srcA(s), smoothstep(0.0, 0.5, P));
    } else if (m == 54) {
        vec3 d = A.rgb - B.rgb;
        float flag = sqrt(dot(d, d)) <= P ? 1.0 : 0.0;
        outc = mix(B, cmix(A, B, flag), P);
    } else if (m == 55) {
        float d = min(P, 1.0 - P);
        float dist = ceil(d * 50.0) / 50.0;
        float sq = 2.0 * dist * min(w, h) / 20.0;
        vec2 s = dist > 0.0
            ? min((floor(p0 / sq) + 0.5) * sq, vec2(w, h) - 1.0)
            : p0;
        outc = cmix(srcA(s), srcB(s), P);
    } else if (m == 56) {
        vec2 rd = vec2(xi - w * 0.5, yi - h * 0.5);
        if (rd == vec2(0.0)) rd = vec2(0.0, 1.0);
        float smoothv = atan(rd.x, rd.y) - (P - 0.5) * (PI * 2.5);
        outc = mix(A, B, smoothstep(0.0, 1.0, smoothv));
    } else if (m == 57) {
        float prog = P <= 0.5 ? P * 2.0 : (1.0 - P) * 2.0;
        float size = 1.0 + floor(w * 0.5) * prog;
        const int TAPS = 24;
        float stride = size / float(TAPS);
        vec4 sum0 = vec4(0.0);
        vec4 sum1 = vec4(0.0);
        for (int k = 0; k < TAPS; k++) {
            float sx = min(xi + (float(k) + 0.5) * stride, w - 1.0);
            vec2 s = vec2(sx, yi);
            sum0 += srcA(s);
            sum1 += srcB(s);
        }
        outc = cmix(sum0 / float(TAPS), sum1 / float(TAPS), P);
    }

    fragColor = vec4(outc.rgb, 1.0);
}
