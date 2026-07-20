#version 300 es
precision highp float;

uniform sampler2D u_image0;
uniform float u_float0;
uniform float u_float1;
uniform float u_float2;
uniform float u_float3;
uniform float u_float4;
uniform float u_float5;
uniform bool u_bool0;
uniform bool u_bool1;
uniform bool u_bool2;
uniform bool u_bool3;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    float r = tex.r;
    float g = tex.g;
    float b = tex.b;
    float mixv = clamp(u_float0, 0.0, 1.0);
    float expandv = clamp(u_float1, 0.0, 1.0);
    float spill = u_bool0
        ? max(0.0, b - (r * mixv + g * (1.0 - mixv)) * (1.0 - expandv))
        : max(0.0, g - (r * mixv + b * (1.0 - mixv)) * (1.0 - expandv));
    vec3 outc = vec3(
        r + spill * u_float2 + u_float5 * spill,
        g + spill * u_float3 + u_float5 * spill,
        b + spill * u_float4 + u_float5 * spill);
    if (u_bool1) outc = max(outc, 0.0);
    if (u_bool2) outc = min(outc, 1.0);
    if (u_bool3) outc = vec3(clamp(spill, 0.0, 1.0));
    fragColor = vec4(outc, tex.a);
}
