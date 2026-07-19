#version 300 es
precision highp float;

uniform sampler2D u_image0;
uniform sampler2D u_curve0;
uniform sampler2D u_curve1;
uniform sampler2D u_curve2;

in vec2 v_texCoord;
out vec4 fragColor;

float mapChannel(sampler2D lut, float v) {
    int idx = int(floor(clamp(v, 0.0, 1.0) * 255.0 + 0.5));
    return texelFetch(lut, ivec2(idx, 0), 0).r;
}

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    fragColor = vec4(
        mapChannel(u_curve0, tex.r),
        mapChannel(u_curve1, tex.g),
        mapChannel(u_curve2, tex.b),
        tex.a);
}
