export const fullscreenPostWGSL = /* wgsl */ `
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@builtin(vertex_index) vi: u32) -> VsOut {
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  var out: VsOut;
  out.position = vec4f(pos[vi], 0.0, 1.0);
  let uv = pos[vi] * 0.5 + 0.5;
  out.uv = vec2f(uv.x, 1.0 - uv.y);
  return out;
}
`;

export const toneColorWGSL = /* wgsl */ `
${fullscreenPostWGSL}

struct PostUniforms {
  resolution: vec2f,
  bloomAmount: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> post: PostUniforms;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var sceneSamp: sampler;

fn acesFilm(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}

fn warmGrade(c: vec3f) -> vec3f {
  let luma = dot(c, vec3f(0.2126, 0.7152, 0.0722));
  let low = c * vec3f(1.02, 1.0, 0.98);
  let mid = c * vec3f(1.0, 0.995, 0.99);
  let high = c * vec3f(1.0, 0.995, 0.99);
  var graded = mix(low, mid, smoothstep(0.0, 0.45, luma));
  graded = mix(graded, high, smoothstep(0.35, 0.95, luma));
  let sat = 1.0 + 0.06 * (1.0 - abs(luma - 0.45) * 2.2);
  return mix(vec3f(luma), graded, sat);
}

fn cheapBloom(uv: vec2f, base: vec3f) -> vec3f {
  let texel = 1.0 / post.resolution;
  var bloom = vec3f(0.0);
  var wsum = 0.0;
  for (var x = -2; x <= 2; x++) {
    for (var y = -2; y <= 2; y++) {
      let off = texel * vec2f(f32(x), f32(y)) * 2.5;
      let s = textureSampleLevel(sceneTex, sceneSamp, uv + off, 0.0).rgb;
      let w = 1.0 / (1.0 + f32(abs(x) + abs(y)));
      bloom += max(s - 0.55, vec3f(0.0)) * w;
      wsum += w;
    }
  }
  return base + (bloom / wsum) * 0.22;
}

@fragment
fn fsMain(input: VsOut) -> @location(0) vec4f {
  var col = textureSampleLevel(sceneTex, sceneSamp, input.uv, 0.0).rgb;
  if (post.bloomAmount > 0.0) {
    col = mix(col, cheapBloom(input.uv, col), post.bloomAmount);
  }
  col *= 0.96;
  col = pow(max(col, vec3f(0.0)), vec3f(1.02));
  col = warmGrade(col);
  col = acesFilm(col * 1.05);
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;

export const asciiPostWGSL = /* wgsl */ `
${fullscreenPostWGSL}

struct PostUniforms {
  resolution: vec2f,
  glyphCount: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> post: PostUniforms;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var sceneSamp: sampler;
@group(0) @binding(3) var glyphAtlas: texture_2d<f32>;
@group(0) @binding(4) var glyphSamp: sampler;

const CELL_SIZE = vec2f(8.0, 12.0);

fn saturateColor(c: vec3f, amount: f32) -> vec3f {
  let luma = dot(c, vec3f(0.2126, 0.7152, 0.0722));
  return mix(vec3f(luma), c, amount);
}

fn contrastColor(c: vec3f, amount: f32) -> vec3f {
  return clamp((c - 0.5) * amount + 0.5, vec3f(0.0), vec3f(1.0));
}

fn sampleCellColor(cell: vec2f) -> vec3f {
  let cellCenter = (cell + 0.5) * CELL_SIZE;
  let uv = cellCenter / post.resolution;
  let texel = 1.0 / post.resolution;
  var col = vec3f(0.0);
  var wsum = 0.0;
  for (var x = -1; x <= 1; x++) {
    for (var y = -1; y <= 1; y++) {
      let w = 1.0 / (1.0 + f32(abs(x) + abs(y)));
      col += textureSampleLevel(sceneTex, sceneSamp, uv + texel * vec2f(f32(x), f32(y)), 0.0).rgb * w;
      wsum += w;
    }
  }
  return col / wsum;
}

fn colorVibrancy(c: vec3f) -> f32 {
  let maxC = max(max(c.r, c.g), c.b);
  let minC = min(min(c.r, c.g), c.b);
  return smoothstep(0.06, 0.38, (maxC - minC) / max(maxC, 1e-4));
}

@fragment
fn fsMain(input: VsOut) -> @location(0) vec4f {
  let fragCoord = input.uv * post.resolution;
  let cell = floor(fragCoord / CELL_SIZE);
  let cellUV = fract(fragCoord / CELL_SIZE);

  let sceneCol = sampleCellColor(cell);
  let luma = dot(sceneCol, vec3f(0.2126, 0.7152, 0.0722));
  let vibrancy = colorVibrancy(sceneCol);

  let variety = fract(sin(dot(cell, vec2f(12.9898, 78.233))) * 43758.5453);
  let maxIdx = mix((post.glyphCount - 1.0) * 0.18, post.glyphCount - 1.0, vibrancy);
  let idx = floor(clamp(luma * maxIdx + variety * mix(0.6, 2.0, vibrancy), 0.0, post.glyphCount - 1.0));

  let glyphScale = mix(0.38, 1.0, vibrancy);
  let glyphUV = (cellUV - 0.5) / glyphScale + 0.5;
  var glyphAlpha = 0.0;
  if (all(glyphUV >= vec2f(0.0)) && all(glyphUV <= vec2f(1.0))) {
    glyphAlpha = textureSampleLevel(
      glyphAtlas,
      glyphSamp,
      vec2f((idx + glyphUV.x) / post.glyphCount, glyphUV.y),
      0.0,
    ).a;
  }

  var glyphColor = contrastColor(saturateColor(sceneCol, 1.536), 1.12) * 1.2;
  glyphColor = clamp(glyphColor, vec3f(0.0), vec3f(1.0));
  let bg = glyphColor * 0.5;
  let alpha = mix(mix(0.18, 0.55, luma), mix(0.22, 0.95, luma), vibrancy);

  return vec4f(mix(bg, glyphColor, glyphAlpha * alpha), 1.0);
}
`;
