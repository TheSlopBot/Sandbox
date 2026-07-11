export const instanceCullWGSL = /* wgsl */ `
struct CullParams {
  cameraPlanes: array<vec4f, 6>,
  lightPlanes: array<vec4f, 6>,
  cameraPos: vec3f,
  forwardDist: f32,
  shadowDist: f32,
  instanceCount: u32,
  indexCount: u32,
  _pad0: u32,
  _pad1: u32,
};

struct StaticInstance {
  model: mat4x4f,
  color: vec4f,
  center: vec3f,
  radius: f32,
};

@group(0) @binding(0) var<uniform> params: CullParams;
@group(0) @binding(1) var<storage, read> instances: array<StaticInstance>;
@group(0) @binding(2) var<storage, read_write> forwardIndices: array<u32>;
@group(0) @binding(3) var<storage, read_write> shadowIndices: array<u32>;
@group(0) @binding(4) var<storage, read_write> forwardCount: atomic<u32>;
@group(0) @binding(5) var<storage, read_write> shadowCount: atomic<u32>;
@group(0) @binding(6) var<storage, read_write> forwardIndirect: array<u32>;
@group(0) @binding(7) var<storage, read_write> shadowIndirect: array<u32>;

fn sphereInPlanes(planes: array<vec4f, 6>, c: vec3f, r: f32) -> bool {
  for (var i = 0u; i < 6u; i++) {
    let p = planes[i];
    if (dot(p.xyz, c) + p.w < -r) {
      return false;
    }
  }
  return true;
}

@compute @workgroup_size(1)
fn initIndirect(@builtin(global_invocation_id) id: vec3u) {
  if (id.x != 0u) {
    return;
  }
  atomicStore(&forwardCount, 0u);
  atomicStore(&shadowCount, 0u);
  forwardIndirect[0] = params.indexCount;
  forwardIndirect[1] = 0u;
  forwardIndirect[2] = 0u;
  forwardIndirect[3] = 0u;
  forwardIndirect[4] = 0u;
  shadowIndirect[0] = params.indexCount;
  shadowIndirect[1] = 0u;
  shadowIndirect[2] = 0u;
  shadowIndirect[3] = 0u;
  shadowIndirect[4] = 0u;
}

@compute @workgroup_size(64)
fn cull(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= params.instanceCount) {
    return;
  }

  let inst = instances[i];
  let c = inst.center;
  let r = inst.radius;
  let dx = c.x - params.cameraPos.x;
  let dz = c.z - params.cameraPos.z;
  let d2 = dx * dx + dz * dz;

  let forwardDist2 = params.forwardDist * params.forwardDist;
  let shadowDist2 = params.shadowDist * params.shadowDist;

  if (d2 <= forwardDist2 && sphereInPlanes(params.cameraPlanes, c, r)) {
    let slot = atomicAdd(&forwardCount, 1u);
    forwardIndices[slot] = i;
  }

  if (d2 <= shadowDist2 && sphereInPlanes(params.lightPlanes, c, r)) {
    let slot = atomicAdd(&shadowCount, 1u);
    shadowIndices[slot] = i;
  }
}

@compute @workgroup_size(1)
fn finalizeIndirect(@builtin(global_invocation_id) id: vec3u) {
  if (id.x != 0u) {
    return;
  }
  forwardIndirect[1] = atomicLoad(&forwardCount);
  shadowIndirect[1] = atomicLoad(&shadowCount);
}
`;
