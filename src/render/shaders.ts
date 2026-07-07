export const shadowDepthVS = `#version 300 es
precision highp float;

layout(location=0) in vec3 a_position;

uniform mat4 u_lightViewProj;
uniform mat4 u_model;

void main() {
  gl_Position = u_lightViewProj * u_model * vec4(a_position, 1.0);
}
`;

export const shadowDepthSkinnedVS = `#version 300 es
precision highp float;

layout(location=0) in vec3 a_position;
layout(location=3) in uvec4 a_joints;
layout(location=4) in vec4 a_weights;

uniform mat4 u_lightViewProj;
uniform mat4 u_model;
uniform mat4 u_joints[64];

mat4 skinMat() {
  mat4 m = mat4(0.0);
  m += u_joints[int(a_joints.x)] * a_weights.x;
  m += u_joints[int(a_joints.y)] * a_weights.y;
  m += u_joints[int(a_joints.z)] * a_weights.z;
  m += u_joints[int(a_joints.w)] * a_weights.w;
  return m;
}

void main() {
  vec4 wp = u_model * skinMat() * vec4(a_position, 1.0);
  gl_Position = u_lightViewProj * wp;
}
`;

export const shadowDepthFS = `#version 300 es
precision highp float;
void main() {}
`;

const shadowSamplingGLSL = `
uniform mat4 u_lightViewProj;
uniform highp sampler2DShadow u_shadowMap;
uniform float u_shadowMapSize;

float sampleShadow(vec3 worldPos, vec3 nrm, vec3 lightDir) {
  vec4 lp = u_lightViewProj * vec4(worldPos, 1.0);
  vec3 proj = lp.xyz / lp.w;
  vec2 uv = proj.xy * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;

  float ndl = max(dot(nrm, -lightDir), 0.0);
  float bias = max(0.0012 * (1.0 - ndl), 0.00035);
  float depth = proj.z * 0.5 + 0.5 - bias;

  float texel = 1.0 / u_shadowMapSize;
  float shadow = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 off = vec2(float(x), float(y)) * texel;
      shadow += texture(u_shadowMap, vec3(uv + off, depth));
    }
  }
  return shadow / 25.0;
}
`;

export const litTexturedVS = `#version 300 es
precision highp float;

layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_uv;

uniform mat4 u_viewProj;
uniform mat4 u_model;

out vec3 v_nrm;
out vec2 v_uv;
out vec3 v_worldPos;

void main() {
  vec4 wp = u_model * vec4(a_position, 1.0);
  v_worldPos = wp.xyz;
  v_nrm = mat3(u_model) * a_normal;
  v_uv = a_uv;
  gl_Position = u_viewProj * wp;
}
`;

export const litSkinnedVS = `#version 300 es
precision highp float;

layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_uv;
layout(location=3) in uvec4 a_joints;
layout(location=4) in vec4 a_weights;

uniform mat4 u_viewProj;
uniform mat4 u_model;
uniform mat4 u_joints[64];

out vec3 v_nrm;
out vec2 v_uv;
out vec3 v_worldPos;

mat4 skinMat() {
  mat4 m = mat4(0.0);
  m += u_joints[int(a_joints.x)] * a_weights.x;
  m += u_joints[int(a_joints.y)] * a_weights.y;
  m += u_joints[int(a_joints.z)] * a_weights.z;
  m += u_joints[int(a_joints.w)] * a_weights.w;
  return m;
}

void main() {
  mat4 sm = skinMat();
  vec4 lp = sm * vec4(a_position, 1.0);
  vec3 ln = mat3(sm) * a_normal;

  vec4 wp = u_model * lp;
  v_worldPos = wp.xyz;
  v_nrm = mat3(u_model) * ln;
  v_uv = a_uv;
  gl_Position = u_viewProj * wp;
}
`;

export const litTexturedFS = `#version 300 es
precision highp float;

in vec3 v_nrm;
in vec2 v_uv;
in vec3 v_worldPos;

uniform sampler2D u_baseColorTex;
uniform vec4 u_baseColorFactor;
uniform vec3 u_lightDir;
uniform vec3 u_ambient;
uniform vec3 u_lightColor;
${shadowSamplingGLSL}

out vec4 outColor;

void main() {
  vec3 n = normalize(v_nrm);
  float ndl = max(dot(n, -u_lightDir), 0.0);
  vec4 tex = texture(u_baseColorTex, v_uv);
  vec4 base = tex * u_baseColorFactor;
  float shadow = sampleShadow(v_worldPos, n, u_lightDir);
  vec3 lit = base.rgb * (u_ambient + ndl * u_lightColor * shadow);
  outColor = vec4(lit, base.a);
}
`;

export const groundVS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
uniform mat4 u_viewProj;
uniform mat4 u_model;
out vec3 v_worldPos;
void main() {
  vec4 wp = u_model * vec4(a_position, 1.0);
  v_worldPos = wp.xyz;
  gl_Position = u_viewProj * wp;
}
`;

export const groundFS = `#version 300 es
precision highp float;
in vec3 v_worldPos;
uniform vec3 u_lightDir;
${shadowSamplingGLSL}
out vec4 outColor;

void main() {
  // "Blueprint paper" gray grid (minor + major lines), anti-aliased.
  vec2 p = v_worldPos.xz;

  // Base paper tone + subtle square modulation (not high-contrast).
  float baseSquare = mod(floor(p.x) + floor(p.y), 2.0);
  vec3 paperA = vec3(0.78, 0.76, 0.73);
  vec3 paperB = vec3(0.74, 0.72, 0.69);
  vec3 col = mix(paperA, paperB, baseSquare);

  // Minor grid every 1m and major grid every 5m.
  // We draw thin lines by measuring distance to the nearest integer line in each axis.
  vec2 minorCell = abs(fract(p) - 0.5);
  vec2 minorD = 0.5 - minorCell; // distance to nearest cell boundary in [0..0.5]

  vec2 majorP = p / 5.0;
  vec2 majorCell = abs(fract(majorP) - 0.5);
  vec2 majorD = 0.5 - majorCell;

  float aaMinor = max(fwidth(p.x), fwidth(p.y));
  float aaMajor = max(fwidth(majorP.x), fwidth(majorP.y));

  float minorLine = 1.0 - smoothstep(0.0, aaMinor * 1.25, min(minorD.x, minorD.y));
  float majorLine = 1.0 - smoothstep(0.0, aaMajor * 1.75, min(majorD.x, majorD.y));

  vec3 minorCol = vec3(0.64, 0.62, 0.59);
  vec3 majorCol = vec3(0.54, 0.52, 0.49);

  col = mix(col, minorCol, minorLine * 0.55);
  col = mix(col, majorCol, majorLine * 0.85);

  vec3 n = vec3(0.0, 1.0, 0.0);
  float shadow = sampleShadow(v_worldPos, n, u_lightDir);
  col *= mix(vec3(0.55), vec3(1.0), shadow);

  outColor = vec4(col, 1.0);
}
`;

export const postProcessVS = `#version 300 es
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

export const postProcessFS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_scene;
uniform vec2 u_resolution;

vec3 reinhard(vec3 x) {
  return x / (x + vec3(1.0));
}

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
  vec3 shadowTint = vec3(1.02, 1.0, 0.98);
  vec3 midTint = vec3(1.0, 0.995, 0.99);
  vec3 highlightTint = vec3(1.0, 0.995, 0.99);
  vec3 low = c * shadowTint;
  vec3 mid = c * midTint;
  vec3 high = c * highlightTint;
  vec3 graded = mix(low, mid, smoothstep(0.0, 0.45, luma));
  graded = mix(graded, high, smoothstep(0.35, 0.95, luma));
  float sat = 1.0 + 0.06 * (1.0 - abs(luma - 0.45) * 2.2);
  vec3 gray = vec3(luma);
  return mix(gray, graded, sat);
}

vec3 sampleScene(vec2 uv) {
  return texture(u_scene, uv).rgb;
}

vec3 cheapBloom(vec2 uv, vec3 base) {
  vec2 texel = 1.0 / u_resolution;
  vec3 bloom = vec3(0.0);
  float wsum = 0.0;
  const float k = 2.5;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 off = texel * vec2(float(x), float(y)) * k;
      vec3 s = sampleScene(uv + off);
      float bright = max(max(s.r, s.g), s.b);
      float w = 1.0 / (1.0 + float(abs(x) + abs(y)));
      bloom += max(s - 0.55, 0.0) * w;
      wsum += w;
    }
  }
  bloom /= wsum;
  return base + bloom * 0.22;
}

void main() {
  vec2 uv = v_uv;
  vec3 col = sampleScene(uv);

  col = cheapBloom(uv, col);

  // Exposure before tone mapping.
  col *= 0.96;
  col = pow(max(col, 0.0), vec3(1.02));

  col = warmGrade(col);
  col = acesFilm(col * 1.05);

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const asciiPostProcessVS = postProcessVS;

export const asciiPostProcessFS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_scene;
uniform sampler2D u_glyphAtlas;
uniform vec2 u_resolution;
uniform float u_glyphCount;

const vec2 CELL_SIZE = vec2(8.0, 12.0);

vec3 saturateColor(vec3 c, float amount) {
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luma), c, amount);
}

vec3 contrastColor(vec3 c, float amount) {
  return clamp((c - 0.5) * amount + 0.5, 0.0, 1.0);
}

vec3 sampleCellColor(vec2 cell) {
  vec2 cellCenter = (cell + 0.5) * CELL_SIZE;
  vec2 uv = cellCenter / u_resolution;

  vec2 texel = 1.0 / u_resolution;
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 off = texel * vec2(float(x), float(y));
      float w = 1.0 / (1.0 + float(abs(x) + abs(y)));
      col += texture(u_scene, uv + off).rgb * w;
      wsum += w;
    }
  }
  return col / wsum;
}

float colorVibrancy(vec3 c) {
  float maxC = max(max(c.r, c.g), c.b);
  float minC = min(min(c.r, c.g), c.b);
  float saturation = (maxC - minC) / max(maxC, 1e-4);
  return smoothstep(0.06, 0.38, saturation);
}

void main() {
  vec2 fragCoord = v_uv * u_resolution;
  vec2 cell = floor(fragCoord / CELL_SIZE);
  vec2 cellUV = fract(fragCoord / CELL_SIZE);

  vec3 sceneCol = sampleCellColor(cell);
  float luma = dot(sceneCol, vec3(0.2126, 0.7152, 0.0722));
  float adjusted = clamp(luma, 0.0, 1.0);
  float vibrancy = colorVibrancy(sceneCol);

  float variety = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  float mutedMaxIdx = (u_glyphCount - 1.0) * 0.18;
  float vibrantMaxIdx = u_glyphCount - 1.0;
  float maxIdx = mix(mutedMaxIdx, vibrantMaxIdx, vibrancy);
  float idx = floor(clamp(adjusted * maxIdx + variety * mix(0.6, 2.0, vibrancy), 0.0, u_glyphCount - 1.0));

  float glyphScale = mix(0.38, 1.0, vibrancy);
  vec2 glyphUV = (cellUV - 0.5) / glyphScale + 0.5;
  float glyphAlpha = 0.0;
  if (all(greaterThanEqual(glyphUV, vec2(0.0))) && all(lessThanEqual(glyphUV, vec2(1.0)))) {
    float glyphU = (idx + glyphUV.x) / u_glyphCount;
    glyphAlpha = texture(u_glyphAtlas, vec2(glyphU, glyphUV.y)).a;
  }

  vec3 glyphColor = saturateColor(sceneCol, 1.536);
  glyphColor = contrastColor(glyphColor, 1.12);
  glyphColor = clamp(glyphColor * 1.2, 0.0, 1.0);
  vec3 bg = glyphColor * 0.5;
  float alpha = mix(mix(0.18, 0.55, adjusted), mix(0.22, 0.95, adjusted), vibrancy);

  outColor = vec4(mix(bg, glyphColor, glyphAlpha * alpha), 1.0);
}
`;

