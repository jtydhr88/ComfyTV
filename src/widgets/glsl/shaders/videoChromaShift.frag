#version 300 es
precision highp float;

uniform sampler2D u_image0;
uniform vec2 u_resolution;
uniform float u_float0;
uniform float u_float1;
uniform float u_float2;
uniform float u_float3;
uniform bool u_bool0;

in vec2 v_texCoord;
out vec4 fragColor;

vec2 shiftCoord(vec2 offLuma) {
    vec2 px = v_texCoord * u_resolution;
    vec2 s = vec2(px.x - offLuma.x, px.y + offLuma.y);
    if (u_bool0) {
        s = mod(mod(s, u_resolution) + u_resolution, u_resolution);
    } else {
        s = clamp(s, vec2(0.5), u_resolution - 0.5);
    }
    return s / u_resolution;
}

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    vec3 self = floor(tex.rgb * 255.0 + 0.5);
    vec2 rUv = shiftCoord(vec2(u_float0, u_float1) * 2.0);
    vec2 bUv = shiftCoord(vec2(u_float2, u_float3) * 2.0);
    vec3 rs = floor(texture(u_image0, rUv).rgb * 255.0 + 0.5);
    vec3 bs = floor(texture(u_image0, bUv).rgb * 255.0 + 0.5);
    float y = dot(self, vec3(0.299, 0.587, 0.114));
    float cb = dot(bs, vec3(-0.168736, -0.331264, 0.5)) + 128.0;
    float cr = dot(rs, vec3(0.5, -0.418688, -0.081312)) + 128.0;
    vec3 outc = vec3(
        y + 1.402 * (cr - 128.0),
        y - 0.344136 * (cb - 128.0) - 0.714136 * (cr - 128.0),
        y + 1.772 * (cb - 128.0));
    fragColor = vec4(clamp(floor(outc + 0.5), 0.0, 255.0) / 255.0, tex.a);
}
