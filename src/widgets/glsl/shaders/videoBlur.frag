#version 300 es
precision highp float;

#pragma passes 2

uniform sampler2D u_image0;
uniform sampler2D u_image1;
uniform vec2 u_resolution;
uniform int u_pass;
uniform int u_int0;
uniform int u_int1;
uniform float u_float0;
uniform float u_float1;
uniform float u_float2;

in vec2 v_texCoord;
out vec4 fragColor;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

vec4 separableBlur(vec2 stepv) {
    vec4 c = texture(u_image0, v_texCoord);
    vec3 acc = c.rgb;
    float wsum = 1.0;
    float w = 1.0;
    for (int i = 1; i <= u_int1; i++) {
        if (u_int0 == 0) w *= u_float0;
        vec2 o = stepv * float(i);
        acc += w * (texture(u_image0, v_texCoord + o).rgb
                  + texture(u_image0, v_texCoord - o).rgb);
        wsum += 2.0 * w;
    }
    return vec4(acc / wsum, c.a);
}

vec4 bilateralH(vec2 stepv) {
    vec3 c = texture(u_image0, v_texCoord).rgb;
    float lum0 = dot(c, LUMA);
    vec3 accV = 2.0 * c;
    float accF = 2.0;
    float prodA = 1.0;
    float prodB = 1.0;
    float prevA = lum0;
    float prevB = lum0;
    for (int i = 1; i <= u_int1; i++) {
        vec2 o = stepv * float(i);
        vec3 a = texture(u_image0, v_texCoord + o).rgb;
        vec3 b = texture(u_image0, v_texCoord - o).rgb;
        float la = dot(a, LUMA);
        float lb = dot(b, LUMA);
        prodA *= u_float0 * exp(-abs(la - prevA) * u_float1);
        prodB *= u_float0 * exp(-abs(lb - prevB) * u_float1);
        prevA = la;
        prevB = lb;
        accV += prodA * a + prodB * b;
        accF += prodA + prodB;
    }
    return vec4(accV, accF);
}

vec4 bilateralV(vec2 stepv) {
    vec4 tf = texture(u_image0, v_texCoord);
    float lum0 = dot(texture(u_image1, v_texCoord).rgb, LUMA);
    vec3 accV = 2.0 * tf.rgb;
    float accF = 2.0 * tf.a;
    float prodA = 1.0;
    float prodB = 1.0;
    float prevA = lum0;
    float prevB = lum0;
    for (int i = 1; i <= u_int1; i++) {
        vec2 o = stepv * float(i);
        vec4 a = texture(u_image0, v_texCoord + o);
        vec4 b = texture(u_image0, v_texCoord - o);
        float la = dot(texture(u_image1, v_texCoord + o).rgb, LUMA);
        float lb = dot(texture(u_image1, v_texCoord - o).rgb, LUMA);
        prodA *= u_float0 * exp(-abs(la - prevA) * u_float1);
        prodB *= u_float0 * exp(-abs(lb - prevB) * u_float1);
        prevA = la;
        prevB = lb;
        accV += prodA * a.rgb + prodB * b.rgb;
        accF += prodA * a.a + prodB * b.a;
    }
    return vec4(clamp(accV / accF, 0.0, 1.0), 1.0);
}

float binomialLuma(vec2 stepv, bool fromRed) {
    int s = u_int1;
    float w = 1.0;
    for (int k = 1; k <= s; k++) {
        w *= (2.0 * float(k) - 1.0) / (2.0 * float(k));
    }
    vec4 c0 = texture(u_image0, v_texCoord);
    float acc = w * (fromRed ? c0.r : dot(c0.rgb, LUMA));
    for (int i = 0; i < s; i++) {
        w = w * float(s - i) / float(s + i + 1);
        vec2 o = stepv * float(i + 1);
        vec4 a = texture(u_image0, v_texCoord + o);
        vec4 b = texture(u_image0, v_texCoord - o);
        float va = fromRed ? a.r : dot(a.rgb, LUMA);
        float vb = fromRed ? b.r : dot(b.rgb, LUMA);
        acc += w * (va + vb);
    }
    return acc;
}

vec4 sharpenCombine(vec2 stepv) {
    float blurY = binomialLuma(stepv, true);
    vec4 orig = texture(u_image1, v_texCoord);
    float y = dot(orig.rgb, LUMA);
    vec3 c = orig.rgb + vec3((y - blurY) * u_float2);
    return vec4(clamp(c, 0.0, 1.0), orig.a);
}

void main() {
    vec2 texel = 1.0 / u_resolution;
    vec2 stepv = u_pass == 0 ? vec2(texel.x, 0.0) : vec2(0.0, texel.y);
    if (u_int0 == 2) {
        fragColor = u_pass == 0 ? bilateralH(stepv) : bilateralV(stepv);
    } else if (u_int0 == 3) {
        fragColor = u_pass == 0
            ? vec4(vec3(binomialLuma(stepv, false)), 1.0)
            : sharpenCombine(stepv);
    } else {
        fragColor = separableBlur(stepv);
    }
}
