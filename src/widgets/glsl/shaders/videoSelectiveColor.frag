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
uniform bool u_bool0;

in vec2 v_texCoord;
out vec4 fragColor;

float compAdjust(float scale, float value, float adjust) {
    float lo = -value;
    float hi = 1.0 - value;
    float res = -adjust;
    if (u_bool0) res *= hi;
    return floor(clamp(res, lo, hi) * scale + 0.5);
}

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    float r = floor(tex.r * 255.0 + 0.5);
    float g = floor(tex.g * 255.0 + 0.5);
    float b = floor(tex.b * 255.0 + 0.5);
    float minC = min(r, min(g, b));
    float maxC = max(r, max(g, b));
    float mid = r + g + b - minC - maxC;
    float rnorm = r / 255.0;
    float adjR = 0.0;
    float s;

    if (u_float0 != 0.0 && r == maxC) {
        s = maxC - mid;
        if (s > 0.0) adjR += compAdjust(s, rnorm, u_float0);
    }
    if (u_float1 != 0.0 && b == minC) {
        s = mid - minC;
        if (s > 0.0) adjR += compAdjust(s, rnorm, u_float1);
    }
    if (u_float2 != 0.0 && g == maxC) {
        s = maxC - mid;
        if (s > 0.0) adjR += compAdjust(s, rnorm, u_float2);
    }
    if (u_float3 != 0.0 && r == minC) {
        s = mid - minC;
        if (s > 0.0) adjR += compAdjust(s, rnorm, u_float3);
    }
    if (u_float4 != 0.0 && b == maxC) {
        s = maxC - mid;
        if (s > 0.0) adjR += compAdjust(s, rnorm, u_float4);
    }
    if (u_float5 != 0.0 && g == minC) {
        s = mid - minC;
        if (s > 0.0) adjR += compAdjust(s, rnorm, u_float5);
    }
    if (u_float6 != 0.0 && r > 128.0 && g > 128.0 && b > 128.0) {
        s = minC * 2.0 - 255.0;
        if (s > 0.0) adjR += compAdjust(s, rnorm, u_float6);
    }
    if (u_float7 != 0.0 && (r + g + b) > 0.0
        && !(r == 255.0 && g == 255.0 && b == 255.0)) {
        s = floor((510.0 - (abs(maxC * 2.0 - 255.0)
                            + abs(minC * 2.0 - 255.0)) + 1.0) / 2.0);
        if (s > 0.0) adjR += compAdjust(s, rnorm, u_float7);
    }
    if (u_float8 != 0.0 && r < 128.0 && g < 128.0 && b < 128.0) {
        s = 255.0 - maxC * 2.0;
        if (s > 0.0) adjR += compAdjust(s, rnorm, u_float8);
    }

    fragColor = vec4(clamp(r + adjR, 0.0, 255.0) / 255.0, tex.g, tex.b, tex.a);
}
