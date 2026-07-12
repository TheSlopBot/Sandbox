export const litWGSL = /* wgsl */ `
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
  alphaCutoff: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

struct JointPalette {
  matrices: array<mat4x4f, 128>,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSamp: sampler_comparison;
@group(1) @binding(0) var<uniform> object: ObjectUniforms;
@group(2) @binding(0) var baseColorTex: texture_2d<f32>;
@group(2) @binding(1) var baseColorSamp: sampler;
@group(3) @binding(0) var<storage, read> jointPalette: JointPalette;

struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
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
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
) -> VsOut {
  var out: VsOut;
  let world = object.model * vec4f(position, 1.0);
  out.worldPos = world.xyz;
  out.normal = (object.model * vec4f(normal, 0.0)).xyz;
  out.uv = uv;
  out.position = frame.viewProj * world;
  return out;
}

@vertex
fn vsSkinned(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) joints: vec4u,
  @location(4) weights: vec4f,
) -> VsOut {
  var out: VsOut;
  let sm =
    jointPalette.matrices[joints.x] * weights.x +
    jointPalette.matrices[joints.y] * weights.y +
    jointPalette.matrices[joints.z] * weights.z +
    jointPalette.matrices[joints.w] * weights.w;
  let localPos = sm * vec4f(position, 1.0);
  let localNrm = sm * vec4f(normal, 0.0);
  let world = object.model * localPos;
  out.worldPos = world.xyz;
  out.normal = (object.model * localNrm).xyz;
  out.uv = uv;
  out.position = frame.viewProj * world;
  return out;
}

@fragment
fn fsMain(input: VsOut) -> @location(0) vec4f {
  let n = normalize(input.normal);
  let ndl = max(dot(n, -frame.lightDir), 0.0);
  let tex = textureSample(baseColorTex, baseColorSamp, input.uv);
  let base = tex * object.color;
  if (object.alphaCutoff >= 0.0 && base.a < object.alphaCutoff) {
    discard;
  }
  let shadow = sampleShadow(input.worldPos, n, frame.lightDir);
  let lit = base.rgb * (frame.ambient + ndl * frame.lightColor * shadow);
  return vec4f(lit, base.a);
}
`;
