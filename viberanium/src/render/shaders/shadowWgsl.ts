export const shadowWGSL = /* wgsl */ `
struct ShadowFrame {
  lightViewProj: mat4x4f,
};

struct ShadowObject {
  model: mat4x4f,
};

struct JointPalette {
  matrices: array<mat4x4f, 128>,
};

@group(0) @binding(0) var<uniform> frame: ShadowFrame;
@group(1) @binding(0) var<uniform> object: ShadowObject;
@group(2) @binding(0) var<storage, read> jointPalette: JointPalette;

@vertex
fn vsMain(
  @location(0) position: vec3f,
) -> @builtin(position) vec4f {
  return frame.lightViewProj * object.model * vec4f(position, 1.0);
}

@vertex
fn vsSkinned(
  @location(0) position: vec3f,
  @location(3) joints: vec4u,
  @location(4) weights: vec4f,
) -> @builtin(position) vec4f {
  let sm =
    jointPalette.matrices[joints.x] * weights.x +
    jointPalette.matrices[joints.y] * weights.y +
    jointPalette.matrices[joints.z] * weights.z +
    jointPalette.matrices[joints.w] * weights.w;
  let world = object.model * (sm * vec4f(position, 1.0));
  return frame.lightViewProj * world;
}
`;
