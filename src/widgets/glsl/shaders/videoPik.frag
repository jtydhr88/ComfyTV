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
uniform int u_int0;
uniform int u_int1;
uniform int u_int2;
uniform bool u_bool0;
uniform bool u_bool1;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    vec3 fg = tex.rgb;
    vec3 ab = vec3(u_float0, u_float1, u_float2);
    vec3 db = vec3(u_float3, u_float4, u_float5);
    vec3 c = vec3(u_float6, u_float7, u_float8);
    float rw = u_float9;
    float gbw = u_float10;
    float clipMin = u_float11;
    float clipMax = u_float12;
    vec3 repCol = vec3(u_float13, u_float14, u_float15);

    vec3 pfg = fg / ab;
    float pfgKey;
    float cKey;
    float cPrim;
    if (u_int0 == 0) {
        pfgKey = pfg.g - pfg.r * rw - pfg.b * gbw;
        cKey = c.g - c.r * rw - c.b * gbw;
        cPrim = c.g;
    } else {
        pfgKey = pfg.b - pfg.r * rw - pfg.g * gbw;
        cKey = c.b - c.r * rw - c.g * gbw;
        cPrim = c.b;
    }

    float alpha = 1.0 - pfgKey / (cKey <= 0.0 ? 1.0 : cKey);
    if (cPrim <= 0.0 || pfgKey <= 0.0 || cKey <= 0.0) alpha = 1.0;

    vec3 outc;
    if (u_bool0) {
        outc = alpha >= 1.0 ? fg : max(fg + c * db * (alpha - 1.0), 0.0);
    } else {
        outc = fg;
    }

    if (u_bool1) alpha = clamp(alpha, 0.0, 1.0);

    float clipped = clamp((alpha - clipMin) / (clipMax - clipMin), 0.0, 1.0);
    if (alpha <= clipMin) clipped = 0.0;
    if (alpha >= clipMax) clipped = 1.0;
    float safe = alpha > 0.0 ? alpha : 1.0;
    if (clipped < alpha) outc *= clipped / safe;
    if (u_int1 != 0 && clipped > alpha) {
        float diff = clipped - alpha;
        if (u_int1 == 1) outc += fg * diff;
        else if (u_int1 == 2) outc += repCol * diff;
        else outc += repCol * diff
            * dot(fg, vec3(0.2126, 0.7152, 0.0722));
    }
    alpha = clipped;

    if (!u_bool0) outc *= alpha;

    if (u_int2 == 0) fragColor = vec4(vec3(alpha), 1.0);
    else if (u_int2 == 1) fragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
    else fragColor = vec4(clamp(outc, 0.0, 1.0), alpha);
}
