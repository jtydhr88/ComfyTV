#version 300 es
precision highp float;

uniform sampler2D u_image0;
uniform vec2 u_resolution;
uniform float u_float0;
uniform float u_float1;
uniform float u_float2;
uniform int u_int0;
uniform bool u_bool0;

in vec2 v_texCoord;
out vec4 fragColor;

const float TAU = 6.28318530717958647693;

void main() {
    vec2 uv = v_texCoord;
    float envx = u_bool0 ? 4.0 * uv.x * (1.0 - uv.x) : 1.0;
    float envy = u_bool0 ? 4.0 * uv.y * (1.0 - uv.y) : 1.0;
    float dx = 0.0;
    float dy = 0.0;
    if (u_int0 != 2) {
        dx = u_float0 * envx * sin(TAU * u_float1 * uv.y + u_float2);
    }
    if (u_int0 != 1) {
        dy = u_float0 * envy * sin(TAU * u_float1 * uv.x + u_float2);
    }
    vec2 s = (uv * u_resolution + vec2(dx, dy)) / u_resolution;
    s = 1.0 - abs(mod(s, 2.0) - 1.0);
    fragColor = texture(u_image0, s);
}
