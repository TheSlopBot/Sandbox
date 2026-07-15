export const skeletalPoseWGSL = /* wgsl */ `
const MAX_JOINTS: u32 = 128u;
const MAX_NODES: u32 = 128u;
const MAX_ATTACHMENTS: u32 = 64u;
const MAX_MESH_MODELS: u32 = 128u;
const FULL_BODY_DISABLED: u32 = 0xffffffffu;

struct BatchFrame {
  nodeCount: u32,
  jointCount: u32,
  rootNodeIndex: u32,
  instanceCount: u32,
  parentsOffset: u32,
  topoOffset: u32,
  bindLocalOffset: u32,
  jointsOffset: u32,
  inverseBindOffset: u32,
  clipHeadersOffset: u32,
  channelHeadersOffset: u32,
  clipTimesOffset: u32,
  clipValuesOffset: u32,
  animatedMaskOffset: u32,
  maskWords: u32,
  scratchStride: u32,
  lowerBodyMaskOffset: u32,
  rightArmMaskOffset: u32,
  leftArmMaskOffset: u32,
  clipCount: u32,
};

struct PoseInstance {
  renderRoot: mat4x4f,
  moveAnimTime: f32,
  rightAnimTime: f32,
  leftAnimTime: f32,
  torsoYawRad: f32,
  moveClipIndex: u32,
  moveLoop: u32,
  rightClipIndex: u32,
  rightLoop: u32,
  leftClipIndex: u32,
  leftLoop: u32,
  fullBodyClipIndex: u32,
  spineNodeIndex: u32,
  slotIndex: u32,
  meshJobStart: u32,
  meshJobCount: u32,
  attachJobStart: u32,
  attachJobCount: u32,
  layerMode: u32,
  headYawRad: f32,
  headNodeIndex: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  _pad3: u32,
  _pad4: u32,
  _pad5: u32,
  _pad6: u32,
  _pad7: u32,
  _pad8: u32,
  _pad9: u32,
  _pad10: u32,
  _pad11: u32,
};

struct AttachmentJob {
  boneNodeIndex: u32,
  attachNodeIndex: u32,
  outIndex: u32,
  _pad: u32,
  localOffset: mat4x4f,
  attachNodeWorld: mat4x4f,
};

struct MeshModelJob {
  nodeIndex: u32,
  outIndex: u32,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<uniform> frame: BatchFrame;
@group(0) @binding(1) var<storage, read> instances: array<PoseInstance>;
@group(0) @binding(2) var<storage, read> skeleton: array<u32>;
@group(0) @binding(3) var<storage, read_write> scratch: array<f32>;
@group(0) @binding(4) var<storage, read_write> palette: array<mat4x4f>;
@group(0) @binding(5) var<storage, read> meshJobs: array<MeshModelJob>;
@group(0) @binding(6) var<storage, read_write> meshModels: array<mat4x4f>;
@group(0) @binding(7) var<storage, read> attachmentJobs: array<AttachmentJob>;
@group(0) @binding(8) var<storage, read_write> attachmentModels: array<mat4x4f>;

var<private> scratchBase: u32;
var<private> paletteBase: u32;
var<private> meshModelBase: u32;
var<private> attachmentModelBase: u32;
var<private> activeRoot: mat4x4f;
var<private> activeAnimTime: f32;
var<private> activeClipIndex: u32;
var<private> activeLoop: u32;
var<private> activeBoneMaskOffset: u32;
var<private> activeUseBoneMask: u32;

fn u32At(offset: u32) -> u32 { return skeleton[offset]; }
fn i32At(offset: u32) -> i32 { return bitcast<i32>(skeleton[offset]); }
fn f32At(offset: u32) -> f32 { return bitcast<f32>(skeleton[offset]); }

fn mat4At(offsetWords: u32) -> mat4x4f {
  return mat4x4f(
    vec4f(f32At(offsetWords), f32At(offsetWords + 1u), f32At(offsetWords + 2u), f32At(offsetWords + 3u)),
    vec4f(f32At(offsetWords + 4u), f32At(offsetWords + 5u), f32At(offsetWords + 6u), f32At(offsetWords + 7u)),
    vec4f(f32At(offsetWords + 8u), f32At(offsetWords + 9u), f32At(offsetWords + 10u), f32At(offsetWords + 11u)),
    vec4f(f32At(offsetWords + 12u), f32At(offsetWords + 13u), f32At(offsetWords + 14u), f32At(offsetWords + 15u)),
  );
}

fn m4Identity() -> mat4x4f {
  return mat4x4f(
    vec4f(1.0, 0.0, 0.0, 0.0),
    vec4f(0.0, 1.0, 0.0, 0.0),
    vec4f(0.0, 0.0, 1.0, 0.0),
    vec4f(0.0, 0.0, 0.0, 1.0),
  );
}

fn m4FromTRSQuat(t: vec3f, r: vec4f, s: vec3f) -> mat4x4f {
  let x = r.x; let y = r.y; let z = r.z; let w = r.w;
  let x2 = x + x; let y2 = y + y; let z2 = z + z;
  let xx = x * x2; let xy = x * y2; let xz = x * z2;
  let yy = y * y2; let yz = y * z2; let zz = z * z2;
  let wx = w * x2; let wy = w * y2; let wz = w * z2;
  return mat4x4f(
    vec4f((1.0 - (yy + zz)) * s.x, (xy + wz) * s.x, (xz - wy) * s.x, 0.0),
    vec4f((xy - wz) * s.y, (1.0 - (xx + zz)) * s.y, (yz + wx) * s.y, 0.0),
    vec4f((xz + wy) * s.z, (yz - wx) * s.z, (1.0 - (xx + yy)) * s.z, 0.0),
    vec4f(t.x, t.y, t.z, 1.0),
  );
}

fn m4Mul(a: mat4x4f, b: mat4x4f) -> mat4x4f { return a * b; }

fn m4Invert(m: mat4x4f) -> mat4x4f {
  let a00 = m[0][0]; let a01 = m[0][1]; let a02 = m[0][2]; let a03 = m[0][3];
  let a10 = m[1][0]; let a11 = m[1][1]; let a12 = m[1][2]; let a13 = m[1][3];
  let a20 = m[2][0]; let a21 = m[2][1]; let a22 = m[2][2]; let a23 = m[2][3];
  let a30 = m[3][0]; let a31 = m[3][1]; let a32 = m[3][2]; let a33 = m[3][3];
  let b00 = a00 * a11 - a01 * a10;
  let b01 = a00 * a12 - a02 * a10;
  let b02 = a00 * a13 - a03 * a10;
  let b03 = a01 * a12 - a02 * a11;
  let b04 = a01 * a13 - a03 * a11;
  let b05 = a02 * a13 - a03 * a12;
  let b06 = a20 * a31 - a21 * a30;
  let b07 = a20 * a32 - a22 * a30;
  let b08 = a20 * a33 - a23 * a30;
  let b09 = a21 * a32 - a22 * a31;
  let b10 = a21 * a33 - a23 * a31;
  let b11 = a22 * a33 - a23 * a32;
  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (abs(det) < 1e-8) { return m4Identity(); }
  det = 1.0 / det;
  return mat4x4f(
    vec4f((a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det),
    vec4f((a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det),
    vec4f((a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det),
    vec4f((a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det),
  );
}

fn qSlerp(a: vec4f, bIn: vec4f, t: f32) -> vec4f {
  var b = bIn;
  var cosHalf = dot(a, b);
  if (cosHalf < 0.0) { b = -b; cosHalf = -cosHalf; }
  if (cosHalf > 0.9995) { return normalize(a + (b - a) * t); }
  let halfAngle = acos(cosHalf);
  let sinHalf = sin(halfAngle);
  let ra = sin((1.0 - t) * halfAngle) / sinHalf;
  let rb = sin(t * halfAngle) / sinHalf;
  return a * ra + b * rb;
}

fn qMul(a: vec4f, b: vec4f) -> vec4f {
  return vec4f(
    a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  );
}

fn localBase(node: u32) -> u32 { return scratchBase + node * 10u; }
fn worldBase(node: u32) -> u32 { return scratchBase + frame.nodeCount * 10u + node * 16u; }

fn writeLocalT(node: u32, v: vec3f) {
  let b = localBase(node);
  scratch[b] = v.x; scratch[b + 1u] = v.y; scratch[b + 2u] = v.z;
}
fn writeLocalR(node: u32, v: vec4f) {
  let b = localBase(node);
  scratch[b + 3u] = v.x; scratch[b + 4u] = v.y; scratch[b + 5u] = v.z; scratch[b + 6u] = v.w;
}
fn writeLocalS(node: u32, v: vec3f) {
  let b = localBase(node);
  scratch[b + 7u] = v.x; scratch[b + 8u] = v.y; scratch[b + 9u] = v.z;
}
fn readLocalT(node: u32) -> vec3f {
  let b = localBase(node);
  return vec3f(scratch[b], scratch[b + 1u], scratch[b + 2u]);
}
fn readLocalR(node: u32) -> vec4f {
  let b = localBase(node);
  return vec4f(scratch[b + 3u], scratch[b + 4u], scratch[b + 5u], scratch[b + 6u]);
}
fn readLocalS(node: u32) -> vec3f {
  let b = localBase(node);
  return vec3f(scratch[b + 7u], scratch[b + 8u], scratch[b + 9u]);
}

fn writeWorld(node: u32, m: mat4x4f) {
  let b = worldBase(node);
  scratch[b] = m[0][0]; scratch[b + 1u] = m[0][1]; scratch[b + 2u] = m[0][2]; scratch[b + 3u] = m[0][3];
  scratch[b + 4u] = m[1][0]; scratch[b + 5u] = m[1][1]; scratch[b + 6u] = m[1][2]; scratch[b + 7u] = m[1][3];
  scratch[b + 8u] = m[2][0]; scratch[b + 9u] = m[2][1]; scratch[b + 10u] = m[2][2]; scratch[b + 11u] = m[2][3];
  scratch[b + 12u] = m[3][0]; scratch[b + 13u] = m[3][1]; scratch[b + 14u] = m[3][2]; scratch[b + 15u] = m[3][3];
}

fn readWorld(node: u32) -> mat4x4f {
  let b = worldBase(node);
  return mat4x4f(
    vec4f(scratch[b], scratch[b + 1u], scratch[b + 2u], scratch[b + 3u]),
    vec4f(scratch[b + 4u], scratch[b + 5u], scratch[b + 6u], scratch[b + 7u]),
    vec4f(scratch[b + 8u], scratch[b + 9u], scratch[b + 10u], scratch[b + 11u]),
    vec4f(scratch[b + 12u], scratch[b + 13u], scratch[b + 14u], scratch[b + 15u]),
  );
}

fn nodeInBoneMask(node: u32) -> bool {
  if (activeUseBoneMask == 0u) { return true; }
  let word = u32At(activeBoneMaskOffset + (node >> 5u));
  return (word & (1u << (node & 31u))) != 0u;
}

fn findKeyframe(timesOffset: u32, keyCount: u32, t: f32) -> u32 {
  if (keyCount <= 1u) { return 0u; }
  var lo = 0u;
  var hi = keyCount - 1u;
  loop {
    if (lo > hi) { break; }
    let mid = (lo + hi) >> 1u;
    if (f32At(frame.clipTimesOffset + timesOffset + mid) <= t) {
      lo = mid + 1u;
    } else {
      if (mid == 0u) { break; }
      hi = mid - 1u;
    }
  }
  if (lo == 0u) { return 0u; }
  return min(lo - 1u, keyCount - 2u);
}

fn sampleClip() {
  if (activeClipIndex >= frame.clipCount) { return; }
  let headerBase = frame.clipHeadersOffset + activeClipIndex * 4u;
  let durationBits = u32At(headerBase);
  let channelCount = min(u32At(headerBase + 1u), 512u);
  let channelOffset = u32At(headerBase + 2u);
  let valid = u32At(headerBase + 3u);
  if (valid == 0u || channelCount == 0u) { return; }

  var t = max(activeAnimTime, 0.0);
  let duration = bitcast<f32>(durationBits);
  if (duration > 0.0) {
    if (activeLoop != 0u) {
      t = t % duration;
      if (t < 0.0) { t = t + duration; }
    } else {
      t = min(t, duration);
    }
  }

  for (var ci = 0u; ci < channelCount; ci++) {
    let chBase = frame.channelHeadersOffset + (channelOffset + ci) * 6u;
    let nodeIndex = u32At(chBase);
    let path = u32At(chBase + 1u);
    let keyCount = u32At(chBase + 2u);
    let timesOffset = u32At(chBase + 3u);
    let valuesOffset = u32At(chBase + 4u);
    if (nodeIndex >= frame.nodeCount || keyCount == 0u) { continue; }
    if (!nodeInBoneMask(nodeIndex)) { continue; }

    let valuesBase = frame.clipValuesOffset + valuesOffset;
    if (keyCount == 1u) {
      if (path == 0u) {
        writeLocalT(nodeIndex, vec3f(f32At(valuesBase), f32At(valuesBase + 1u), f32At(valuesBase + 2u)));
      } else if (path == 2u) {
        writeLocalS(nodeIndex, vec3f(f32At(valuesBase), f32At(valuesBase + 1u), f32At(valuesBase + 2u)));
      } else {
        writeLocalR(nodeIndex, vec4f(f32At(valuesBase), f32At(valuesBase + 1u), f32At(valuesBase + 2u), f32At(valuesBase + 3u)));
      }
      continue;
    }

    let i = findKeyframe(timesOffset, keyCount, t);
    let t0 = f32At(frame.clipTimesOffset + timesOffset + i);
    let t1 = f32At(frame.clipTimesOffset + timesOffset + i + 1u);
    let alpha = select(0.0, (t - t0) / (t1 - t0), t1 > t0);

    if (path == 0u || path == 2u) {
      let base0 = valuesBase + i * 3u;
      let base1 = valuesBase + (i + 1u) * 3u;
      let v = vec3f(
        f32At(base0) + (f32At(base1) - f32At(base0)) * alpha,
        f32At(base0 + 1u) + (f32At(base1 + 1u) - f32At(base0 + 1u)) * alpha,
        f32At(base0 + 2u) + (f32At(base1 + 2u) - f32At(base0 + 2u)) * alpha,
      );
      if (path == 0u) { writeLocalT(nodeIndex, v); } else { writeLocalS(nodeIndex, v); }
    } else {
      let base0 = valuesBase + i * 4u;
      let base1 = valuesBase + (i + 1u) * 4u;
      let qa = vec4f(f32At(base0), f32At(base0 + 1u), f32At(base0 + 2u), f32At(base0 + 3u));
      let qb = vec4f(f32At(base1), f32At(base1 + 1u), f32At(base1 + 2u), f32At(base1 + 3u));
      writeLocalR(nodeIndex, qSlerp(qa, qb, alpha));
    }
  }
}

fn applyBoneYaw(node: u32, yawRad: f32) {
  if (node >= frame.nodeCount) { return; }
  if (abs(yawRad) < 1e-5) { return; }
  let half = yawRad * 0.5;
  let qYaw = vec4f(0.0, sin(half), 0.0, cos(half));
  writeLocalR(node, normalize(qMul(qYaw, readLocalR(node))));
}

fn resolveHierarchyAndOutputs(inst: PoseInstance) {
  for (var ti = 0u; ti < frame.nodeCount; ti++) {
    let i = u32At(frame.topoOffset + ti);
    let localM = m4FromTRSQuat(readLocalT(i), readLocalR(i), readLocalS(i));
    let parent = i32At(frame.parentsOffset + i);
    if (parent < 0) {
      writeWorld(i, localM);
    } else {
      writeWorld(i, m4Mul(readWorld(u32(parent)), localM));
    }
  }

  for (var j = 0u; j < frame.jointCount; j++) {
    let jointNode = i32At(frame.jointsOffset + j);
    if (jointNode < 0) {
      palette[paletteBase + j] = m4Identity();
      continue;
    }
    let jointWorld = readWorld(u32(jointNode));
    palette[paletteBase + j] = m4Mul(m4Mul(activeRoot, jointWorld), mat4At(frame.inverseBindOffset + j * 16u));
  }

  for (var m = 0u; m < inst.meshJobCount; m++) {
    let job = meshJobs[inst.meshJobStart + m];
    if (job.outIndex >= MAX_MESH_MODELS || job.nodeIndex >= frame.nodeCount) { continue; }
    meshModels[meshModelBase + job.outIndex] = m4Mul(activeRoot, readWorld(job.nodeIndex));
  }

  for (var a = 0u; a < inst.attachJobCount; a++) {
    let job = attachmentJobs[inst.attachJobStart + a];
    if (job.outIndex >= MAX_ATTACHMENTS || job.boneNodeIndex >= frame.nodeCount) { continue; }
    let boneWorld = m4Mul(activeRoot, readWorld(job.boneNodeIndex));
    let attachRoot = m4Mul(boneWorld, job.localOffset);
    attachmentModels[attachmentModelBase + job.outIndex] = m4Mul(attachRoot, job.attachNodeWorld);
  }
}

fn resolveOne(inst: PoseInstance) {
  scratchBase = inst.slotIndex * frame.scratchStride;
  paletteBase = inst.slotIndex * MAX_JOINTS;
  meshModelBase = inst.slotIndex * MAX_MESH_MODELS;
  attachmentModelBase = inst.slotIndex * MAX_ATTACHMENTS;
  activeRoot = inst.renderRoot;

  for (var i = 0u; i < frame.nodeCount; i++) {
    let lb = localBase(i);
    let bb = frame.bindLocalOffset + i * 10u;
    for (var k = 0u; k < 10u; k++) {
      scratch[lb + k] = f32At(bb + k);
    }
  }

  if (inst.fullBodyClipIndex != FULL_BODY_DISABLED) {
    activeAnimTime = inst.moveAnimTime;
    activeClipIndex = inst.fullBodyClipIndex;
    activeLoop = 0u;
    activeUseBoneMask = 0u;
    sampleClip();
    resolveHierarchyAndOutputs(inst);
    return;
  }

  if (inst.layerMode == 0u) {
    activeAnimTime = inst.moveAnimTime;
    activeClipIndex = inst.moveClipIndex;
    activeLoop = inst.moveLoop;
    activeUseBoneMask = 0u;
    sampleClip();
    applyBoneYaw(inst.spineNodeIndex, inst.torsoYawRad);
    applyBoneYaw(inst.headNodeIndex, inst.headYawRad);
    resolveHierarchyAndOutputs(inst);
    return;
  }

  activeAnimTime = inst.moveAnimTime;
  activeClipIndex = inst.moveClipIndex;
  activeLoop = inst.moveLoop;
  activeUseBoneMask = 1u;
  activeBoneMaskOffset = frame.lowerBodyMaskOffset;
  sampleClip();

  activeAnimTime = inst.rightAnimTime;
  activeClipIndex = inst.rightClipIndex;
  activeLoop = inst.rightLoop;
  activeBoneMaskOffset = frame.rightArmMaskOffset;
  sampleClip();

  activeAnimTime = inst.leftAnimTime;
  activeClipIndex = inst.leftClipIndex;
  activeLoop = inst.leftLoop;
  activeBoneMaskOffset = frame.leftArmMaskOffset;
  sampleClip();

  applyBoneYaw(inst.spineNodeIndex, inst.torsoYawRad);
  applyBoneYaw(inst.headNodeIndex, inst.headYawRad);
  resolveHierarchyAndOutputs(inst);
}

@compute @workgroup_size(1)
fn resolvePoses(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= frame.instanceCount || frame.nodeCount == 0u) { return; }
  resolveOne(instances[id.x]);
}
`;
