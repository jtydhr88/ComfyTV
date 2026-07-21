#version 300 es
precision highp float;

uniform sampler2D u_image0;
uniform vec2 u_resolution;
uniform float u_float0;
uniform float u_float1;
uniform float u_float2;
uniform float u_float3;
uniform float u_float4;
uniform float u_float5;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    float w = u_resolution.x;
    float h = u_resolution.y;
    float px = v_texCoord.x * (w - 1.0);
    float py = (1.0 - v_texCoord.y) * (h - 1.0);
    float sx = u_float0 * px + u_float1 * py + u_float2;
    float sy = u_float3 * px + u_float4 * py + u_float5;
    if (sx < 0.0 || sy < 0.0 || sx > w - 1.0 || sy > h - 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    vec2 uv = vec2((sx + 0.5) / w, 1.0 - (sy + 0.5) / h);
    fragColor = vec4(texture(u_image0, uv).rgb, 1.0);
}
