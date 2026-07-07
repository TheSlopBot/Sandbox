const SCENE_WIDTH = 2560;
const SCENE_HEIGHT = 1440;
const CELL_WIDTH = 8;
const CELL_HEIGHT = 12;
const SCALE_SOFTEN_EXPONENT = 0.5;

export const loadingBokehVS = `#version 300 es
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

export const loadingBokehFS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_glyphCount;
uniform vec3 u_bgDeep;
uniform vec3 u_textMuted;
uniform vec3 u_accentCyan;
uniform vec3 u_accentBlue;
uniform vec3 u_accentPrimary;
uniform vec3 u_accentPurple;
uniform vec3 u_accentOrange;
uniform sampler2D u_glyphAtlas;

const vec2 SCENE_SIZE = vec2(${SCENE_WIDTH}.0, ${SCENE_HEIGHT}.0);
const vec2 CELL_SIZE = vec2(${CELL_WIDTH}.0, ${CELL_HEIGHT}.0);
const float SCALE_SOFTEN_EXPONENT = ${SCALE_SOFTEN_EXPONENT};
const float TIME_SCALE = 0.32;
const float BLOB_SPREAD = 0.038;
const float BG_DIM = 0.92;
const float RUNE_BG_SATURATION = 0.30;
const float RUNE_BG_LIGHTNESS = 0.09;
const float RUNE_BG_BLEND = 0.55;

float hueToRgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

vec3 rgbToHsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) * 0.5;
  float d = maxC - minC;
  float s = 0.0;
  float h = 0.0;

  if (d > 0.0001) {
    s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);

    if (maxC == c.r) {
      h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    } else if (maxC == c.g) {
      h = (c.b - c.r) / d + 2.0;
    } else {
      h = (c.r - c.g) / d + 4.0;
    }

    h /= 6.0;
  }

  return vec3(h, s, l);
}

vec3 hslToRgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;

  if (s <= 0.0001) {
    return vec3(l);
  }

  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;

  return vec3(
    hueToRgb(p, q, h + 1.0 / 3.0),
    hueToRgb(p, q, h),
    hueToRgb(p, q, h - 1.0 / 3.0)
  );
}

vec3 dimHueBackground(vec3 textColor, vec3 baseBg) {
  vec3 hsl = rgbToHsl(textColor);
  vec3 tinted = hslToRgb(vec3(hsl.x, RUNE_BG_SATURATION, RUNE_BG_LIGHTNESS));
  return mix(baseBg, tinted, RUNE_BG_BLEND);
}

vec3 saturateColor(vec3 c, float amount) {
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luma), c, amount);
}

vec3 contrastColor(vec3 c, float amount) {
  return clamp((c - 0.5) * amount + 0.5, 0.0, 1.0);
}

vec2 mapToSceneCoord(vec2 fragCoord) {
  vec2 viewportScale = u_resolution / SCENE_SIZE;
  float coverScale = max(viewportScale.x, viewportScale.y);
  float uniformScale = pow(coverScale, SCALE_SOFTEN_EXPONENT);
  vec2 centeredOffset = (SCENE_SIZE * uniformScale - u_resolution) * 0.5;
  return (fragCoord + centeredOffset) / uniformScale;
}

float bokehIntensity(vec2 p, float t) {
  t *= TIME_SCALE;
  float intensity = 0.10;

  float cx = 0.5 + 0.38 * sin(t * 0.13) + 0.24 * cos(t * 0.078);
  float cy = 0.5 + 0.38 * cos(t * 0.1105) + 0.24 * sin(t * 0.0585);
  vec2 d = p - vec2(cx, cy);
  intensity += 0.32 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.32 * sin(t * 0.09 + 1.4) + 0.2 * cos(t * 0.054 + 1.82);
  cy = 0.5 + 0.32 * cos(t * 0.0765 + 0.98) + 0.2 * sin(t * 0.0405 + 1.4);
  d = p - vec2(cx, cy);
  intensity += 0.26 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.42 * sin(t * 0.11 + 2.6) + 0.28 * cos(t * 0.066 + 3.38);
  cy = 0.5 + 0.42 * cos(t * 0.0935 + 1.82) + 0.28 * sin(t * 0.0495 + 2.6);
  d = p - vec2(cx, cy);
  intensity += 0.36 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.28 * sin(t * 0.15 + 4.1) + 0.18 * cos(t * 0.09 + 5.33);
  cy = 0.5 + 0.28 * cos(t * 0.1275 + 2.87) + 0.18 * sin(t * 0.0675 + 4.1);
  d = p - vec2(cx, cy);
  intensity += 0.24 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.36 * sin(t * 0.08 + 0.8) + 0.22 * cos(t * 0.048 + 1.04);
  cy = 0.5 + 0.36 * cos(t * 0.068 + 0.56) + 0.22 * sin(t * 0.036 + 0.8);
  d = p - vec2(cx, cy);
  intensity += 0.30 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.3 * sin(t * 0.12 + 3.2) + 0.26 * cos(t * 0.072 + 4.16);
  cy = 0.5 + 0.3 * cos(t * 0.102 + 2.24) + 0.26 * sin(t * 0.054 + 3.2);
  d = p - vec2(cx, cy);
  intensity += 0.22 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.34 * sin(t * 0.1 + 5.0) + 0.2 * cos(t * 0.06 + 6.5);
  cy = 0.5 + 0.34 * cos(t * 0.085 + 3.5) + 0.2 * sin(t * 0.045 + 5.0);
  d = p - vec2(cx, cy);
  intensity += 0.28 * exp(-dot(d, d) / BLOB_SPREAD);

  intensity += 0.06 * sin(p.x * 16.0 + t * 0.35) * cos(p.y * 12.0 - t * 0.28);
  intensity += 0.04 * sin(p.x * 9.0 - t * 0.18) + 0.04 * cos(p.y * 11.0 + t * 0.22);

  return clamp(intensity, 0.0, 1.0);
}

vec3 bokehColor(vec2 p, float t, float intensity) {
  float bright = pow(intensity, 0.55);
  t *= TIME_SCALE;

  float warmth = bright;
  warmth += 0.10 * (sin(p.x * 5.5 + p.y * 3.8 + t * 0.14) * 0.5 + 0.5);
  warmth = clamp(warmth, 0.0, 1.0);

  vec3 col = mix(u_textMuted * 0.78, u_accentBlue, smoothstep(0.0, 0.30, warmth));
  col = mix(col, u_accentCyan, smoothstep(0.18, 0.50, warmth));
  col = mix(col, u_accentPrimary, smoothstep(0.38, 0.68, warmth));
  col = mix(col, u_accentPurple, smoothstep(0.55, 0.82, warmth));
  col = mix(col, u_accentOrange, smoothstep(0.72, 1.0, warmth));

  col = saturateColor(col, 1.12);
  col = contrastColor(col, 1.06);

  return col;
}

void main() {
  vec2 fragCoord = v_uv * u_resolution;
  fragCoord.y = u_resolution.y - fragCoord.y;
  vec2 sceneCoord = mapToSceneCoord(fragCoord);
  vec3 bg = u_bgDeep * BG_DIM;

  if (any(lessThan(sceneCoord, vec2(0.0))) || any(greaterThanEqual(sceneCoord, SCENE_SIZE))) {
    outColor = vec4(bg, 1.0);
    return;
  }

  vec2 grid = SCENE_SIZE / CELL_SIZE;
  vec2 cell = floor(sceneCoord / CELL_SIZE);
  vec2 cellUV = fract(sceneCoord / CELL_SIZE);
  vec2 norm = (cell + 0.5) / grid;
  float intensity = bokehIntensity(norm, u_time);
  float adjusted = min(1.0, 0.12 + intensity * 0.88);
  float variety = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  float idx = floor(clamp(adjusted * (u_glyphCount - 1.0) + variety * 2.5, 0.0, u_glyphCount - 1.0));
  float glyphU = (idx + cellUV.x) / u_glyphCount;
  float glyphAlpha = texture(u_glyphAtlas, vec2(glyphU, cellUV.y)).a;
  vec3 glyphColor = bokehColor(norm, u_time, intensity);
  float alpha = pow(intensity, 0.82) * 0.78 + 0.18;

  vec3 runeBg = dimHueBackground(glyphColor, bg);

  outColor = vec4(mix(runeBg, glyphColor, glyphAlpha * alpha), 1.0);
}
`;
