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
uniform int u_int0;

in vec2 v_texCoord;
out vec4 fragColor;

float lumaOf(vec3 c, int mode) {
    if (mode == 3) return (c.r + c.g + c.b) / 3.0;
    if (mode == 4) return max(c.r, max(c.g, c.b));
    if (mode == 1) return dot(c, vec3(0.2627, 0.6780, 0.0593));
    if (mode == 2) return dot(c, vec3(0.2989, 0.5866, 0.1145));
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    float r = tex.r;
    float g = tex.g;
    float b = tex.b;
    float modified = 0.0;
    float luma1 = lumaOf(tex.rgb, u_int0);

    if (u_float5 != 0.0 && b < g && b < r) {
        float d = min((g - b) * u_float5, (r - b) * u_float5);
        g -= d;
        r -= d;
        modified += abs(d);
    }
    if (u_float4 != 0.0 && g < b && g < r) {
        float d = min((b - g) * u_float4, (r - g) * u_float4);
        b -= d;
        r -= d;
        modified += abs(d);
    }
    if (u_float3 != 0.0 && r < g && r < b) {
        float d = min((g - r) * u_float3, (b - r) * u_float3);
        g -= d;
        b -= d;
        modified += abs(d);
    }
    if (u_float0 != 0.0 && r > g && r > b) {
        float d = (r - max(g, b)) * u_float0;
        r -= d;
        modified += abs(d);
    }
    if (u_float1 != 0.0 && g > b && g > r) {
        float d = (g - max(b, r)) * u_float1;
        g -= d;
        modified += abs(d);
    }
    if (u_float2 != 0.0 && b > g && b > r) {
        float d = (b - max(g, r)) * u_float2;
        b -= d;
        modified += abs(d);
    }

    if (u_bool1) {
        fragColor = vec4(vec3(clamp(modified, 0.0, 1.0)), tex.a);
        return;
    }
    vec3 outc = vec3(r, g, b);
    if (u_bool0) outc += luma1 - lumaOf(outc, u_int0);
    fragColor = vec4(clamp(outc, 0.0, 1.0), tex.a);
}
