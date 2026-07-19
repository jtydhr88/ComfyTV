#version 300 es
precision highp float;

uniform sampler2D u_image0;

uniform float u_float0;
uniform float u_float1;
uniform float u_float2;
uniform float u_float3;
uniform float u_float4;
uniform float u_float5;
uniform float u_float6;
uniform float u_float7;
uniform float u_float8;
uniform float u_float9;
uniform float u_float10;
uniform float u_float11;
uniform float u_float12;
uniform float u_float13;
uniform float u_float14;
uniform float u_float15;
uniform float u_float16;
uniform float u_float17;
uniform float u_float18;
uniform float u_float19;
uniform float u_float20;
uniform float u_float21;
uniform float u_float22;
uniform float u_float23;
uniform float u_float24;
uniform float u_float25;
uniform float u_float26;
uniform float u_float27;
uniform float u_float28;
uniform float u_float29;
uniform float u_float30;

uniform bool u_bool0;
uniform bool u_bool1;
uniform bool u_bool2;
uniform bool u_bool3;
uniform bool u_bool4;
uniform bool u_bool5;
uniform bool u_bool6;
uniform bool u_bool7;

in vec2 v_texCoord;
out vec4 fragColor;

const float ENTRY_SCALE = 65280.0 / 65535.0;

vec3 quantTrunc(vec3 v) {
    return clamp(floor(v * 255.0), 0.0, 255.0) / 255.0;
}

vec3 quantRound(vec3 v) {
    return floor(clamp(v, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
}

vec3 floatExit8(vec3 v) {
    vec3 v16 = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5);
    return min(floor((v16 + 128.0) / 256.0), 255.0) / 255.0;
}

float fastDiv255(float x) {
    return floor((x + 128.0) * 257.0 / 65536.0);
}

vec3 hueSat(vec3 c) {
    float r = floor(c.r * 255.0 + 0.5);
    float g = floor(c.g * 255.0 + 0.5);
    float b = floor(c.b * 255.0 + 0.5);
    float f = 0.0;
    f = max(f, r - max(g, b));
    f = max(f, min(r, g) - b);
    f = max(f, g - max(r, b));
    f = max(f, min(g, b) - r);
    f = max(f, b - max(r, g));
    f = max(f, min(r, b) - g);
    f = min(f, 255.0);
    float tr = floor((r * u_float6 + g * u_float9 + b * u_float12) / 65536.0);
    float tg = floor((r * u_float7 + g * u_float10 + b * u_float13) / 65536.0);
    float tb = floor((r * u_float8 + g * u_float11 + b * u_float14) / 65536.0);
    vec3 o = vec3(
        r + fastDiv255((tr - r) * f),
        g + fastDiv255((tg - g) * f),
        b + fastDiv255((tb - b) * f));
    return clamp(o, 0.0, 255.0) / 255.0;
}

vec3 vibrance(vec3 c) {
    float intensity = u_float15;
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    float luma = c.g * 0.715158 + c.r * 0.212656 + c.b * 0.072186;
    float s = intensity > 0.0 ? 1.0 : -1.0;
    float k = 1.0 + intensity * (1.0 + s * sat);
    return quantTrunc(vec3(luma) + (c - vec3(luma)) * k);
}

float getComponent(float v, float l, float s, float m, float h) {
    const float a = 4.0;
    const float b = 0.333;
    const float sc = 0.7;
    float sw = s * clamp((b - l) * a + 0.5, 0.0, 1.0) * sc;
    float mw = m * clamp((l - b) * a + 0.5, 0.0, 1.0)
             * clamp((1.0 - l - b) * a + 0.5, 0.0, 1.0) * sc;
    float hw = h * clamp((l + b - 1.0) * a + 0.5, 0.0, 1.0) * sc;
    return clamp(v + sw + mw + hw, 0.0, 1.0);
}

float hfun(float n, float h, float s, float l) {
    float a = s * min(l, 1.0 - l);
    float k = mod(n + h / 30.0, 12.0);
    return clamp(l - a * max(min(min(k - 3.0, 9.0 - k), 1.0), -1.0), 0.0, 1.0);
}

vec3 preservel(vec3 c, float l) {
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float hl = l * 0.5;
    float h;
    if (c.r == c.g && c.g == c.b) h = 0.0;
    else if (mx == c.r) h = 60.0 * ((c.g - c.b) / (mx - mn));
    else if (mx == c.g) h = 60.0 * (2.0 + (c.b - c.r) / (mx - mn));
    else h = 60.0 * (4.0 + (c.r - c.g) / (mx - mn));
    if (h < 0.0) h += 360.0;
    float s = (mx == 1.0 || mn == 0.0)
        ? 0.0
        : (mx - mn) / (1.0 - abs(2.0 * hl - 1.0));
    return vec3(hfun(0.0, h, s, hl), hfun(8.0, h, s, hl), hfun(4.0, h, s, hl));
}

vec3 colorBalance(vec3 c) {
    float l = max(c.r, max(c.g, c.b)) + min(c.r, min(c.g, c.b));
    vec3 o = vec3(
        getComponent(c.r, l, u_float22, u_float25, u_float28),
        getComponent(c.g, l, u_float23, u_float26, u_float29),
        getComponent(c.b, l, u_float24, u_float27, u_float30));
    if (u_bool6) o = preservel(o, l);
    return quantRound(o);
}

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    vec3 c = tex.rgb;
    bool inFloat = false;

    if (u_bool0) {
        c = (c * ENTRY_SCALE - vec3(u_float0)) * u_float1;
        inFloat = true;
        if (u_bool1) c = mix(c, c * vec3(u_float2, u_float3, u_float4), u_float5);
    } else if (u_bool1) {
        c = mix(c, c * vec3(u_float2, u_float3, u_float4), u_float5);
        c = quantTrunc(c);
    }

    if (inFloat && !u_bool7) {
        c = floatExit8(c);
        inFloat = false;
    }

    if (u_bool2) c = hueSat(c);
    if (u_bool3) c = vibrance(c);

    if (u_bool4) {
        vec3 lo = vec3(u_float16, u_float17, u_float18);
        vec3 k = vec3(u_float19, u_float20, u_float21);
        c = (c - lo) * k;
        if (!inFloat) c = quantTrunc(c);
    }

    if (u_bool5) {
        if (inFloat) {
            c = floatExit8(c);
            inFloat = false;
        }
        c = colorBalance(c);
    }

    if (inFloat) c = floatExit8(c);

    fragColor = vec4(clamp(c, 0.0, 1.0), tex.a);
}
