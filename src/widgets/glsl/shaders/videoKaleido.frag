#version 300 es
precision highp float;

uniform sampler2D u_image0;
uniform vec2 u_resolution;
uniform float u_float0;
uniform float u_float1;
uniform float u_float2;
uniform float u_float3;
uniform float u_float4;

in vec2 v_texCoord;
out vec4 fragColor;

const float TAU = 6.28318530717958647693;

void main() {
    vec2 res = u_resolution;
    vec2 c = vec2(u_float3 * res.x, u_float4 * res.y);
    vec2 p = v_texCoord * res - c;
    float r = length(p);
    float seg = TAU / max(1.0, u_float0);
    float th = atan(p.y, p.x) - u_float1;
    th = mod(th, TAU);
    float k = mod(th, 2.0 * seg);
    float folded = k < seg ? k : 2.0 * seg - k;
    float phi = folded + u_float1 + u_float2;
    vec2 s = (c + r * vec2(cos(phi), sin(phi))) / res;
    s = 1.0 - abs(mod(s, 2.0) - 1.0);
    fragColor = texture(u_image0, s);
}
