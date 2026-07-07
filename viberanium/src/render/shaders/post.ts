export const fullscreenVS = `#version 300 es
precision highp float;

const vec2 positions[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2( 3.0, -1.0),
  vec2(-1.0,  3.0)
);

out vec2 v_uv;

void main() {
  vec2 pos = positions[gl_VertexID];
  v_uv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

export const toneColorFS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_scene;
uniform vec2 u_resolution;

vec3 acesFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 warmGrade(vec3 c) {
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 low = c * vec3(1.02, 1.0, 0.98);
  vec3 mid = c * vec3(1.0, 0.995, 0.99);
  vec3 high = c * vec3(1.0, 0.995, 0.99);
  vec3 graded = mix(low, mid, smoothstep(0.0, 0.45, luma));
  graded = mix(graded, high, smoothstep(0.35, 0.95, luma));
  float sat = 1.0 + 0.06 * (1.0 - abs(luma - 0.45) * 2.2);
  return mix(vec3(luma), graded, sat);
}

vec3 cheapBloom(vec2 uv, vec3 base) {
  vec2 texel = 1.0 / u_resolution;
  vec3 bloom = vec3(0.0);
  float wsum = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 off = texel * vec2(float(x), float(y)) * 2.5;
      vec3 s = texture(u_scene, uv + off).rgb;
      float w = 1.0 / (1.0 + float(abs(x) + abs(y)));
      bloom += max(s - 0.55, 0.0) * w;
      wsum += w;
    }
  }
  return base + (bloom / wsum) * 0.22;
}

void main() {
  vec3 col = texture(u_scene, v_uv).rgb;
  col = cheapBloom(v_uv, col);
  col *= 0.96;
  col = pow(max(col, 0.0), vec3(1.02));
  col = warmGrade(col);
  col = acesFilm(col * 1.05);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
