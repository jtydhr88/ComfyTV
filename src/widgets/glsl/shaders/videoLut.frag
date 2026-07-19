#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;

uniform sampler2D u_image0;
uniform sampler3D u_lut;
uniform int u_hasLut;
uniform int u_interp;
uniform int u_lutMax;
uniform vec3 u_scale;

in vec2 v_texCoord;
out vec4 fragColor;

vec3 fetchLut(int r, int g, int b) {
    return texelFetch(u_lut, ivec3(b, g, r), 0).rgb;
}

vec3 lutNearest(vec3 s) {
    ivec3 n = ivec3(s + 0.5);
    return fetchLut(n.r, n.g, n.b);
}

vec3 lutTrilinear(vec3 s) {
    ivec3 p = ivec3(s);
    ivec3 n = min(p + 1, ivec3(u_lutMax));
    vec3 d = s - vec3(p);
    vec3 c000 = fetchLut(p.r, p.g, p.b);
    vec3 c001 = fetchLut(p.r, p.g, n.b);
    vec3 c010 = fetchLut(p.r, n.g, p.b);
    vec3 c011 = fetchLut(p.r, n.g, n.b);
    vec3 c100 = fetchLut(n.r, p.g, p.b);
    vec3 c101 = fetchLut(n.r, p.g, n.b);
    vec3 c110 = fetchLut(n.r, n.g, p.b);
    vec3 c111 = fetchLut(n.r, n.g, n.b);
    vec3 c00 = mix(c000, c100, d.r);
    vec3 c10 = mix(c010, c110, d.r);
    vec3 c01 = mix(c001, c101, d.r);
    vec3 c11 = mix(c011, c111, d.r);
    vec3 c0 = mix(c00, c10, d.g);
    vec3 c1 = mix(c01, c11, d.g);
    return mix(c0, c1, d.b);
}

vec3 lutTetrahedral(vec3 s) {
    ivec3 p = ivec3(s);
    ivec3 n = min(p + 1, ivec3(u_lutMax));
    vec3 d = s - vec3(p);
    vec3 c000 = fetchLut(p.r, p.g, p.b);
    vec3 c111 = fetchLut(n.r, n.g, n.b);
    if (d.r > d.g) {
        if (d.g > d.b) {
            vec3 c100 = fetchLut(n.r, p.g, p.b);
            vec3 c110 = fetchLut(n.r, n.g, p.b);
            return (1.0 - d.r) * c000 + (d.r - d.g) * c100 + (d.g - d.b) * c110 + d.b * c111;
        } else if (d.r > d.b) {
            vec3 c100 = fetchLut(n.r, p.g, p.b);
            vec3 c101 = fetchLut(n.r, p.g, n.b);
            return (1.0 - d.r) * c000 + (d.r - d.b) * c100 + (d.b - d.g) * c101 + d.g * c111;
        } else {
            vec3 c001 = fetchLut(p.r, p.g, n.b);
            vec3 c101 = fetchLut(n.r, p.g, n.b);
            return (1.0 - d.b) * c000 + (d.b - d.r) * c001 + (d.r - d.g) * c101 + d.g * c111;
        }
    } else {
        if (d.b > d.g) {
            vec3 c001 = fetchLut(p.r, p.g, n.b);
            vec3 c011 = fetchLut(p.r, n.g, n.b);
            return (1.0 - d.b) * c000 + (d.b - d.g) * c001 + (d.g - d.r) * c011 + d.r * c111;
        } else if (d.b > d.r) {
            vec3 c010 = fetchLut(p.r, n.g, p.b);
            vec3 c011 = fetchLut(p.r, n.g, n.b);
            return (1.0 - d.g) * c000 + (d.g - d.b) * c010 + (d.b - d.r) * c011 + d.r * c111;
        } else {
            vec3 c010 = fetchLut(p.r, n.g, p.b);
            vec3 c110 = fetchLut(n.r, n.g, p.b);
            return (1.0 - d.g) * c000 + (d.g - d.r) * c010 + (d.r - d.b) * c110 + d.b * c111;
        }
    }
}

void main() {
    vec4 tex = texture(u_image0, v_texCoord);
    if (u_hasLut == 0) {
        fragColor = tex;
        return;
    }
    vec3 s = clamp(tex.rgb * u_scale, vec3(0.0), vec3(float(u_lutMax)));
    vec3 c;
    if (u_interp == 0) {
        c = lutNearest(s);
    } else if (u_interp == 1) {
        c = lutTrilinear(s);
    } else {
        c = lutTetrahedral(s);
    }
    c = floor(clamp(c, 0.0, 1.0) * 255.0) / 255.0;
    fragColor = vec4(c, tex.a);
}
