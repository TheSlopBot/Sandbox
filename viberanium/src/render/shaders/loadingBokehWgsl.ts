const SCENE_WIDTH = 2560;
const SCENE_HEIGHT = 1440;
const CELL_WIDTH = 8;
const CELL_HEIGHT = 12;
const SCALE_SOFTEN_EXPONENT = 0.5;

export const loadingBokehWGSL = /* wgsl */ `
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

struct LoadingUniforms {
  time: f32,
  glyphCount: f32,
  resolution: vec2f,
  bgDeep: vec3f,
  _pad0: f32,
  textMuted: vec3f,
  _pad1: f32,
  accentCyan: vec3f,
  _pad2: f32,
  accentBlue: vec3f,
  _pad3: f32,
  accentPrimary: vec3f,
  _pad4: f32,
  accentPurple: vec3f,
  _pad5: f32,
  accentOrange: vec3f,
  _pad6: f32,
};

@group(0) @binding(0) var<uniform> u: LoadingUniforms;
@group(0) @binding(1) var glyphAtlas: texture_2d<f32>;
@group(0) @binding(2) var glyphSamp: sampler;

const SCENE_SIZE = vec2f(${SCENE_WIDTH}.0, ${SCENE_HEIGHT}.0);
const CELL_SIZE = vec2f(${CELL_WIDTH}.0, ${CELL_HEIGHT}.0);
const SCALE_SOFTEN_EXPONENT = ${SCALE_SOFTEN_EXPONENT};
const TIME_SCALE = 0.32;
const BLOB_SPREAD = 0.038;
const BG_DIM = 0.92;
const RUNE_BG_SATURATION = 0.30;
const RUNE_BG_LIGHTNESS = 0.09;
const RUNE_BG_BLEND = 0.55;

@vertex
fn vsMain(@builtin(vertex_index) vi: u32) -> VsOut {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  var out: VsOut;
  out.position = vec4f(pos[vi], 0.0, 1.0);
  out.uv = pos[vi] * 0.5 + 0.5;
  return out;
}

fn hueToRgb(p: f32, q: f32, tIn: f32) -> f32 {
  var t = tIn;
  if (t < 0.0) { t += 1.0; }
  if (t > 1.0) { t -= 1.0; }
  if (t < 1.0 / 6.0) { return p + (q - p) * 6.0 * t; }
  if (t < 0.5) { return q; }
  if (t < 2.0 / 3.0) { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
  return p;
}

fn rgbToHsl(c: vec3f) -> vec3f {
  let maxC = max(c.r, max(c.g, c.b));
  let minC = min(c.r, min(c.g, c.b));
  let l = (maxC + minC) * 0.5;
  let d = maxC - minC;
  var s = 0.0;
  var h = 0.0;

  if (d > 0.0001) {
    s = select(d / (maxC + minC), d / (2.0 - maxC - minC), l > 0.5);

    if (maxC == c.r) {
      h = (c.g - c.b) / d + select(0.0, 6.0, c.g < c.b);
    } else if (maxC == c.g) {
      h = (c.b - c.r) / d + 2.0;
    } else {
      h = (c.r - c.g) / d + 4.0;
    }

    h /= 6.0;
  }

  return vec3f(h, s, l);
}

fn hslToRgb(hsl: vec3f) -> vec3f {
  let h = hsl.x;
  let s = hsl.y;
  let l = hsl.z;

  if (s <= 0.0001) {
    return vec3f(l);
  }

  let q = select(l + s - l * s, l * (1.0 + s), l < 0.5);
  let p = 2.0 * l - q;

  return vec3f(
    hueToRgb(p, q, h + 1.0 / 3.0),
    hueToRgb(p, q, h),
    hueToRgb(p, q, h - 1.0 / 3.0)
  );
}

fn dimHueBackground(textColor: vec3f, baseBg: vec3f) -> vec3f {
  let hsl = rgbToHsl(textColor);
  let tinted = hslToRgb(vec3f(hsl.x, RUNE_BG_SATURATION, RUNE_BG_LIGHTNESS));
  return mix(baseBg, tinted, RUNE_BG_BLEND);
}

fn saturateColor(c: vec3f, amount: f32) -> vec3f {
  let luma = dot(c, vec3f(0.2126, 0.7152, 0.0722));
  return mix(vec3f(luma), c, amount);
}

fn contrastColor(c: vec3f, amount: f32) -> vec3f {
  return clamp((c - 0.5) * amount + 0.5, vec3f(0.0), vec3f(1.0));
}

fn mapToSceneCoord(fragCoord: vec2f) -> vec2f {
  let viewportScale = u.resolution / SCENE_SIZE;
  let coverScale = max(viewportScale.x, viewportScale.y);
  let uniformScale = pow(coverScale, SCALE_SOFTEN_EXPONENT);
  let centeredOffset = (SCENE_SIZE * uniformScale - u.resolution) * 0.5;
  return (fragCoord + centeredOffset) / uniformScale;
}

fn bokehIntensity(p: vec2f, tIn: f32) -> f32 {
  var t = tIn * TIME_SCALE;
  var intensity = 0.10;

  var cx = 0.5 + 0.38 * sin(t * 0.13) + 0.24 * cos(t * 0.078);
  var cy = 0.5 + 0.38 * cos(t * 0.1105) + 0.24 * sin(t * 0.0585);
  var d = p - vec2f(cx, cy);
  intensity += 0.32 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.32 * sin(t * 0.09 + 1.4) + 0.2 * cos(t * 0.054 + 1.82);
  cy = 0.5 + 0.32 * cos(t * 0.0765 + 0.98) + 0.2 * sin(t * 0.0405 + 1.4);
  d = p - vec2f(cx, cy);
  intensity += 0.26 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.42 * sin(t * 0.11 + 2.6) + 0.28 * cos(t * 0.066 + 3.38);
  cy = 0.5 + 0.42 * cos(t * 0.0935 + 1.82) + 0.28 * sin(t * 0.0495 + 2.6);
  d = p - vec2f(cx, cy);
  intensity += 0.36 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.28 * sin(t * 0.15 + 4.1) + 0.18 * cos(t * 0.09 + 5.33);
  cy = 0.5 + 0.28 * cos(t * 0.1275 + 2.87) + 0.18 * sin(t * 0.0675 + 4.1);
  d = p - vec2f(cx, cy);
  intensity += 0.24 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.36 * sin(t * 0.08 + 0.8) + 0.22 * cos(t * 0.048 + 1.04);
  cy = 0.5 + 0.36 * cos(t * 0.068 + 0.56) + 0.22 * sin(t * 0.036 + 0.8);
  d = p - vec2f(cx, cy);
  intensity += 0.30 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.3 * sin(t * 0.12 + 3.2) + 0.26 * cos(t * 0.072 + 4.16);
  cy = 0.5 + 0.3 * cos(t * 0.102 + 2.24) + 0.26 * sin(t * 0.054 + 3.2);
  d = p - vec2f(cx, cy);
  intensity += 0.22 * exp(-dot(d, d) / BLOB_SPREAD);

  cx = 0.5 + 0.34 * sin(t * 0.1 + 5.0) + 0.2 * cos(t * 0.06 + 6.5);
  cy = 0.5 + 0.34 * cos(t * 0.085 + 3.5) + 0.2 * sin(t * 0.045 + 5.0);
  d = p - vec2f(cx, cy);
  intensity += 0.28 * exp(-dot(d, d) / BLOB_SPREAD);

  intensity += 0.06 * sin(p.x * 16.0 + t * 0.35) * cos(p.y * 12.0 - t * 0.28);
  intensity += 0.04 * sin(p.x * 9.0 - t * 0.18) + 0.04 * cos(p.y * 11.0 + t * 0.22);

  return clamp(intensity, 0.0, 1.0);
}

fn bokehColor(p: vec2f, tIn: f32, intensity: f32) -> vec3f {
  let bright = pow(intensity, 0.55);
  let t = tIn * TIME_SCALE;

  var warmth = bright;
  warmth += 0.10 * (sin(p.x * 5.5 + p.y * 3.8 + t * 0.14) * 0.5 + 0.5);
  warmth = clamp(warmth, 0.0, 1.0);

  var col = mix(u.textMuted * 0.78, u.accentBlue, smoothstep(0.0, 0.30, warmth));
  col = mix(col, u.accentCyan, smoothstep(0.18, 0.50, warmth));
  col = mix(col, u.accentPrimary, smoothstep(0.38, 0.68, warmth));
  col = mix(col, u.accentPurple, smoothstep(0.55, 0.82, warmth));
  col = mix(col, u.accentOrange, smoothstep(0.72, 1.0, warmth));

  col = saturateColor(col, 1.12);
  col = contrastColor(col, 1.06);

  return col;
}

@fragment
fn fsMain(in: VsOut) -> @location(0) vec4f {
  var fragCoord = in.uv * u.resolution;
  fragCoord.y = u.resolution.y - fragCoord.y;
  let sceneCoord = mapToSceneCoord(fragCoord);
  let bg = u.bgDeep * BG_DIM;
  let inScene = all(sceneCoord >= vec2f(0.0)) && all(sceneCoord < SCENE_SIZE);

  let grid = SCENE_SIZE / CELL_SIZE;
  let cell = floor(sceneCoord / CELL_SIZE);
  let cellUV = fract(sceneCoord / CELL_SIZE);
  let norm = (cell + 0.5) / grid;
  let intensity = bokehIntensity(norm, u.time);
  let adjusted = min(1.0, 0.12 + intensity * 0.88);
  let variety = fract(sin(dot(cell, vec2f(12.9898, 78.233))) * 43758.5453);
  let idx = floor(clamp(adjusted * (u.glyphCount - 1.0) + variety * 2.5, 0.0, u.glyphCount - 1.0));
  let glyphU = (idx + cellUV.x) / u.glyphCount;
  let glyphAlpha = textureSample(glyphAtlas, glyphSamp, vec2f(glyphU, cellUV.y)).a;
  let glyphColor = bokehColor(norm, u.time, intensity);
  let alpha = pow(intensity, 0.82) * 0.78 + 0.18;
  let runeBg = dimHueBackground(glyphColor, bg);
  let sceneColor = mix(runeBg, glyphColor, glyphAlpha * alpha);

  return vec4f(select(bg, sceneColor, inScene), 1.0);
}
`;
