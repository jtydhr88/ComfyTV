#version 300 es
precision highp float;

uniform sampler2D u_image0;
uniform sampler2D u_curve0;
uniform sampler2D u_curve1;
uniform sampler2D u_curve2;
uniform float u_float0;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    vec3 rgb = floor(tex.rgb * 255.0 + 0.5);
    float l = dot(rgb, vec3(0.299, 0.587, 0.114));
    float yLim = floor(16.0 + l * 219.0 / 255.0 + 0.5);
    float idx = clamp(floor((yLim - 16.0) * 255.0 / 219.0 + 0.5), 0.0, 255.0);
    float u = (idx + 0.5) / 256.0;
    vec3 pal = vec3(
        texture(u_curve0, vec2(u, 0.5)).r,
        texture(u_curve1, vec2(u, 0.5)).r,
        texture(u_curve2, vec2(u, 0.5)).r) * 255.0;
    vec3 outc = clamp(floor(mix(rgb, pal, u_float0) + 0.5), 0.0, 255.0);
    fragColor = vec4(outc / 255.0, tex.a);
}
