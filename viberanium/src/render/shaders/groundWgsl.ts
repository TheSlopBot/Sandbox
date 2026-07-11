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

@vertex
fn vsMain(
  @location(0) position: vec3f,
  @location(1) _normal: vec3f,
  @location(2) _uv: vec2f,
) -> VsOut {
  var out: VsOut;
  let world = object.model * vec4f(position, 1.0);
  out.worldPos = world.xyz;
  out.position = frame.viewProj * world;
  return out;
}

@fragment
fn fsMain(input: VsOut) -> @location(0) vec4f {
  let p = input.worldPos.xz;
  let cell = floor(p.x) + floor(p.y);
  let baseSquare = cell - 2.0 * floor(cell * 0.5);
  let paperA = vec3f(0.78, 0.76, 0.73);
  let paperB = vec3f(0.74, 0.72, 0.69);
  var col = mix(paperA, paperB, baseSquare);

  let minorCell = abs(fract(p) - 0.5);
  let minorD = 0.5 - minorCell;
  let majorP = p / 5.0;
  let majorCell = abs(fract(majorP) - 0.5);
  let majorD = 0.5 - majorCell;

  let aaMinor = max(length(dpdx(p)), length(dpdy(p)));
  let aaMajor = max(length(dpdx(majorP)), length(dpdy(majorP)));

  let minorLine = 1.0 - smoothstep(0.0, aaMinor * 1.25, min(minorD.x, minorD.y));
  let majorLine = 1.0 - smoothstep(0.0, aaMajor * 1.75, min(majorD.x, majorD.y));

  col = mix(col, vec3f(0.64, 0.62, 0.59), minorLine * 0.55);
  col = mix(col, vec3f(0.54, 0.52, 0.49), majorLine * 0.85);

  let n = vec3f(0.0, 1.0, 0.0);
  let shadow = sampleShadow(input.worldPos, n, frame.lightDir);
  col *= mix(vec3f(0.55), vec3f(1.0), shadow);

  return vec4f(col, frame.groundAlpha);
}
`;
