export const groundWGSL = /* wgsl */ `
struct FrameUniforms {
  viewProj: mat4x4f,
  lightViewProj: mat4x4f,
  lightDir: vec3f,
  groundAlpha: f32,
  ambient: vec3f,
  shadowMapSize: f32,
  lightColor: vec3f,
  _pad2: f32,
};

struct ObjectUniforms {
  model: mat4x4f,
  color: vec4f,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSamp: sampler_comparison;
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) uv: vec2f,
};

struct GroundPalette {
  base: vec3f,
  line: vec3f,
  major: vec3f,
  square: vec3f,
  frame: vec3f,
};

fn sampleShadow(worldPos: vec3f, nrm: vec3f, lightDir: vec3f) -> f32 {
  let lp = frame.lightViewProj * vec4f(worldPos, 1.0);
  let proj = lp.xyz / lp.w;
  let uv = vec2f(proj.x * 0.5 + 0.5, 0.5 - proj.y * 0.5);
  let inBounds = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;

  let ndl = max(dot(nrm, -lightDir), 0.0);
  let bias = max(0.0004 * (1.0 - ndl), 0.00015);
  let depth = proj.z - bias;
  let texel = 1.0 / frame.shadowMapSize;

  var shadow = 0.0;
  for (var x = -2; x <= 2; x++) {
    for (var y = -2; y <= 2; y++) {
      let off = vec2f(f32(x), f32(y)) * texel;
      shadow += textureSampleCompare(shadowMap, shadowSamp, uv + off, depth);
    }
  }
  return select(1.0, shadow / 25.0, inBounds);
}

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn hash22(p: vec2f) -> vec2f {
  return vec2f(hash21(p), hash21(p + vec2f(17.13, 9.27)));
}

fn gridLine(p: vec2f, spacing: f32, aa: f32, halfWidth: f32) -> f32 {
  let coord = p / spacing;
  let cell = abs(fract(coord) - 0.5);
  let d = min(0.5 - cell.x, 0.5 - cell.y) * spacing;
  let line = 1.0 - smoothstep(halfWidth, halfWidth + aa * 1.5, d);
  let fade = 1.0 - smoothstep(0.18, 0.65, aa);
  return line * fade;
}

fn rotatedSquareMask(local: vec2f, halfSize: f32, angle: f32, aa: f32) -> f32 {
  let c = cos(angle);
  let s = sin(angle);
  let q = vec2f(c * local.x - s * local.y, s * local.x + c * local.y);
  let d = max(abs(q.x), abs(q.y)) - halfSize;
  return 1.0 - smoothstep(-aa, aa * 1.25, d);
}

fn decorSquares(p: vec2f, aa: f32) -> f32 {
  let cellSize = 1.4;
  let cell = floor(p / cellSize);
  var mask = 0.0;

  for (var ox = -1; ox <= 1; ox++) {
    for (var oz = -1; oz <= 1; oz++) {
      let id = cell + vec2f(f32(ox), f32(oz));
      let rnd = hash22(id);
      if (rnd.x > 0.022) {
        continue;
      }

      let rnd2 = hash22(id + vec2f(3.1, 7.7));
      let center = (id + 0.5 + (rnd - 0.5) * 0.55) * cellSize;
      let halfSize = mix(0.035, 0.085, rnd2.x);
      let angle = rnd2.y * 6.2831853;
      let local = p - center;
      let sqAa = max(aa, 0.02);
      mask = max(mask, rotatedSquareMask(local, halfSize, angle, sqAa));
    }
  }

  let fade = 1.0 - smoothstep(0.25, 0.9, aa);
  return mask * fade;
}

fn groundPalette(variant: i32) -> GroundPalette {
  var p: GroundPalette;
  if (variant == 1) {
    p.base = vec3f(0.28, 0.48, 0.24);
    p.line = vec3f(0.48, 0.68, 0.38);
    p.major = vec3f(0.4, 0.58, 0.3);
    p.square = vec3f(0.22, 0.4, 0.18);
    p.frame = vec3f(0.42, 0.6, 0.34);
  } else if (variant == 2) {
    p.base = vec3f(0.46, 0.34, 0.24);
    p.line = vec3f(0.66, 0.52, 0.38);
    p.major = vec3f(0.58, 0.44, 0.3);
    p.square = vec3f(0.36, 0.26, 0.18);
    p.frame = vec3f(0.6, 0.46, 0.34);
  } else if (variant == 3) {
    p.base = vec3f(0.72, 0.6, 0.28);
    p.line = vec3f(0.9, 0.8, 0.48);
    p.major = vec3f(0.82, 0.7, 0.38);
    p.square = vec3f(0.58, 0.48, 0.2);
    p.frame = vec3f(0.84, 0.72, 0.42);
  } else if (variant == 4) {
    p.base = vec3f(0.52, 0.52, 0.54);
    p.line = vec3f(0.68, 0.68, 0.7);
    p.major = vec3f(0.62, 0.62, 0.64);
    p.square = vec3f(0.42, 0.42, 0.44);
    p.frame = vec3f(0.64, 0.64, 0.66);
  } else {
    p.base = vec3f(0.18, 0.42, 0.72);
    p.line = vec3f(0.42, 0.62, 0.88);
    p.major = vec3f(0.35, 0.55, 0.82);
    p.square = vec3f(0.14, 0.34, 0.62);
    p.frame = vec3f(0.32, 0.52, 0.78);
  }
  return p;
}

@vertex
fn vsMain(
  @location(0) position: vec3f,
  @location(1) _normal: vec3f,
  @location(2) uv: vec2f,
) -> VsOut {
  var out: VsOut;
  let world = object.model * vec4f(position, 1.0);
  out.worldPos = world.xyz;
  out.position = frame.viewProj * world;
  out.uv = uv;
  return out;
}

@fragment
fn fsMain(input: VsOut) -> @location(0) vec4f {
  let p = input.worldPos.xz;
  let palette = groundPalette(i32(object.color.x + 0.5));
  var col = palette.base;

  let aa = max(length(dpdx(p)), length(dpdy(p)));
  let lineW = 0.012;
  let minorLine = gridLine(p, 1.0, aa, lineW);
  let midLine = gridLine(p, 5.0, aa, lineW * 3.0);
  let majorLine = gridLine(p, 10.0, aa, lineW * 3.0);

  col = mix(col, palette.line, minorLine * 0.4);
  col = mix(col, palette.major, midLine * 0.55);
  col = mix(col, palette.major, majorLine * 0.75);

  let square = decorSquares(p, aa);
  col = mix(col, palette.square, square * 0.92);

  let edge = min(min(input.uv.x, 1.0 - input.uv.x), min(input.uv.y, 1.0 - input.uv.y));
  let edgeAa = max(fwidth(edge), 0.001);
  let frameBand = 1.0 - smoothstep(0.012, 0.012 + edgeAa * 2.0, edge);
  let frameInner = 1.0 - smoothstep(0.028, 0.028 + edgeAa * 2.5, edge);
  col = mix(col, palette.frame, frameInner * 0.35);
  col = mix(col, palette.major, frameBand * 0.75);

  let n = vec3f(0.0, 1.0, 0.0);
  let shadow = sampleShadow(input.worldPos, n, frame.lightDir);
  col *= mix(vec3f(0.55), vec3f(1.0), shadow);

  return vec4f(col, frame.groundAlpha);
}
`;
