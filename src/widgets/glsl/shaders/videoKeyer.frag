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
uniform int u_int0;
uniform int u_int1;
uniform int u_int2;

in vec2 v_texCoord;
out vec4 fragColor;

float lumaOf(vec3 c, int mode) {
    if (mode == 3) return (c.r + c.g + c.b) / 3.0;
    if (mode == 4) return max(c.r, max(c.g, c.b));
    if (mode == 1) return dot(c, vec3(0.2627, 0.6780, 0.0593));
    if (mode == 2) return dot(c, vec3(0.2989, 0.5866, 0.1145));
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float keyBg(float kfg, float softL, float tolL, float ctr, float tolU,
            float softU) {
    float aPt = ctr + tolL + softL;
    float bPt = ctr + tolL;
    float cPt = ctr + tolU;
    float dPt = ctr + tolU + softU;
    float k = kfg < aPt ? 0.0 : 1.0;
    if (softL < 0.0 && kfg >= aPt && kfg < bPt) k = (kfg - aPt) / -softL;
    if (kfg >= bPt && kfg <= cPt) k = 1.0;
    if (softU > 0.0 && kfg > cPt && kfg < dPt) k = (dPt - kfg) / softU;
    if (kfg >= dPt) k = 0.0;
    if (bPt <= 0.0 && kfg <= 0.0) k = 1.0;
    if (cPt >= 1.0 && kfg >= 1.0) k = 1.0;
    return clamp(k, 0.0, 1.0);
}

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    vec3 fg = tex.rgb;
    vec3 kc = vec3(u_float0, u_float1, u_float2);
    float kcSum = u_float3;
    float kcNorm2 = u_float4;
    float softL = u_float5;
    float tolL = u_float6;
    float ctr = u_float7;
    float tolU = u_float8;
    float softU = u_float9;
    float desp = u_float10;
    float closing = u_float11;

    float scalar = dot(fg, kc);
    float kfg;
    float dist = 0.0;
    if (u_int0 == 0) {
        kfg = lumaOf(fg, u_int1);
    } else if (u_int0 == 1) {
        kfg = kcSum == 0.0 ? lumaOf(fg, u_int1) : scalar / kcSum;
    } else {
        float norm2 = dot(fg, fg);
        float proj2 = kcNorm2 > 0.0 ? scalar * scalar / kcNorm2 : 0.0;
        dist = sqrt(max(0.0, norm2 - proj2));
        kfg = (kcSum == 0.0 ? lumaOf(fg, u_int1) : scalar / kcSum) - dist;
    }

    float kbg = u_int0 == 3
        ? 1.0
        : keyBg(kfg, softL, tolL, ctr, tolU, softU);

    vec3 outc = fg;
    if (desp > 0.0 && (u_int0 == 2 || u_int0 == 3) && kcNorm2 > 0.0) {
        float kcNorm = sqrt(kcNorm2);
        float along = scalar / kcNorm;
        float cone = dist * closing;
        float maxdesp = kbg * min(desp, 1.0)
            + (1.0 - kbg) * max(0.0, desp - 1.0);
        float shift = maxdesp * max(kcNorm, along - cone);
        shift = min(shift, along - cone);
        if (!(along > cone && shift > 0.0)) shift = 0.0;
        outc -= shift * kc / kcNorm;
    }

    float alpha = clamp(1.0 - kbg, 0.0, 1.0);
    vec3 pre = clamp(outc * alpha, 0.0, 1.0);

    if (u_int2 == 0) fragColor = vec4(vec3(alpha), 1.0);
    else if (u_int2 == 1) fragColor = vec4(pre, 1.0);
    else fragColor = vec4(pre, alpha);
}
