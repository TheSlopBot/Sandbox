export const instancedShadowWGSL = /* wgsl */ `
struct ShadowFrame {
  lightViewProj: mat4x4f,
};

struct StaticInstance {
  model: mat4x4f,
  color: vec4f,
  center: vec3f,
  radius: f32,
};

@group(0) @binding(0) var<uniform> frame: ShadowFrame;
@group(1) @binding(0) var<storage, read> instances: array<StaticInstance>;
@group(1) @binding(1) var<storage, read> visibleIndices: array<u32>;

@vertex
fn vsMain(
  @location(0) position: vec3f,
  @builtin(instance_index) instanceIndex: u32,
) -> @builtin(position) vec4f {
  let srcIndex = visibleIndices[instanceIndex];
  let inst = instances[srcIndex];
  let world = inst.model * vec4f(position, 1.0);
  return frame.lightViewProj * world;
}
`;
