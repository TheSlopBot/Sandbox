export const unlitWGSL = /* wgsl */ `
struct FrameUniforms {
  viewProj: mat4x4f,
};

struct ObjectUniforms {
  model: mat4x4f,
  color: vec4f,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vsMain(
  @location(0) position: vec3f,
  @location(1) _normal: vec3f,
  @location(2) _uv: vec2f,
) -> VsOut {
  var out: VsOut;
  out.position = frame.viewProj * object.model * vec4f(position, 1.0);
  out.color = object.color;
  return out;
}

@fragment
fn fsMain(input: VsOut) -> @location(0) vec4f {
  return input.color;
}
`;
