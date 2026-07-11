export const collisionResolveWGSL = /* wgsl */ `
struct FrameParams {
  dt: f32,
  characterCount: f32,
  colliderCount: f32,
  stepSec: f32,
};

struct StaticCollider {
  aminX: f32,
  aminY: f32,
  aminZ: f32,
  kind: f32,
  amaxX: f32,
  amaxY: f32,
  amaxZ: f32,
  _pad0: f32,
  cx: f32,
  cy: f32,
  cz: f32,
  p0: f32,
  p1: f32,
  p2: f32,
  _pad1: f32,
  _pad2: f32,
  rotX: f32,
  rotY: f32,
  rotZ: f32,
  rotW: f32,
};

struct CharacterState {
  posX: f32,
  posY: f32,
  posZ: f32,
  velY: f32,
  velX: f32,
  velZ: f32,
  radius: f32,
  halfHeight: f32,
  gravity: f32,
  onGround: f32,
  awake: f32,
  _pad: f32,
};

struct Aabb {
  mn: vec3f,
  mx: vec3f,
};

@group(0) @binding(0) var<uniform> params: FrameParams;
@group(0) @binding(1) var<storage, read> colliders: array<StaticCollider>;
@group(0) @binding(2) var<storage, read_write> characters: array<CharacterState>;
@group(0) @binding(3) var<storage, read> cellStarts: array<u32>;
@group(0) @binding(4) var<storage, read> cellCounts: array<u32>;
@group(0) @binding(5) var<storage, read> cellIndices: array<u32>;

const SURFACE_EPS: f32 = 0.02;
const GRID_CELL_SIZE: f32 = 4.0;
const GRID_RES: u32 = 64u;
const GRID_ORIGIN: f32 = -128.0;
const MAX_CANDIDATES: u32 = 64u;
const MAX_SUBSTEPS: u32 = 16u;

fn colAabbMin(col: StaticCollider) -> vec3f {
  return vec3f(col.aminX, col.aminY, col.aminZ);
}

fn colAabbMax(col: StaticCollider) -> vec3f {
  return vec3f(col.amaxX, col.amaxY, col.amaxZ);
}

fn colCenter(col: StaticCollider) -> vec3f {
  return vec3f(col.cx, col.cy, col.cz);
}

fn colRot(col: StaticCollider) -> vec4f {
  return vec4f(col.rotX, col.rotY, col.rotZ, col.rotW);
}

fn aabbIntersects(amin: vec3f, amax: vec3f, bmin: vec3f, bmax: vec3f) -> bool {
  return amin.x <= bmax.x && amax.x >= bmin.x
    && amin.y <= bmax.y && amax.y >= bmin.y
    && amin.z <= bmax.z && amax.z >= bmin.z;
}

fn capsuleAabb(pos: vec3f, radius: f32, halfHeight: f32) -> Aabb {
  let extY = halfHeight + radius;
  var box: Aabb;
  box.mn = vec3f(pos.x - radius, pos.y - extY, pos.z - radius);
  box.mx = vec3f(pos.x + radius, pos.y + extY, pos.z + radius);
  return box;
}

fn yawFromQuat(q: vec4f) -> f32 {
  let siny = 2.0 * (q.w * q.y + q.x * q.z);
  let cosy = 1.0 - 2.0 * (q.y * q.y + q.x * q.x);
  return atan2(siny, cosy);
}

fn rotateY(x: f32, z: f32, yaw: f32) -> vec2f {
  let c = cos(yaw);
  let s = sin(yaw);
  return vec2f(x * c + z * s, -x * s + z * c);
}

fn resolveCircleVsAabbXZ(
  x: f32, z: f32, radius: f32,
  minX: f32, maxX: f32, minZ: f32, maxZ: f32,
) -> vec3f {
  let cx = clamp(x, minX, maxX);
  let cz = clamp(z, minZ, maxZ);
  var dx = x - cx;
  var dz = z - cz;
  let d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius && d2 > 1e-12) {
    return vec3f(x, z, 0.0);
  }

  if (d2 < 1e-12) {
    let penLeft = x - minX + radius;
    let penRight = maxX - x + radius;
    let penNear = z - minZ + radius;
    let penFar = maxZ - z + radius;
    let minPen = min(min(penLeft, penRight), min(penNear, penFar));
    if (minPen == penLeft) { return vec3f(minX - radius - 1e-3, z, 1.0); }
    if (minPen == penRight) { return vec3f(maxX + radius + 1e-3, z, 1.0); }
    if (minPen == penNear) { return vec3f(x, minZ - radius - 1e-3, 1.0); }
    return vec3f(x, maxZ + radius + 1e-3, 1.0);
  }

  let d = sqrt(d2);
  let push = (radius - d) / d + 1e-3 / d;
  return vec3f(x + dx * push, z + dz * push, 1.0);
}

fn resolveCircleVsOrientedBoxXZ(
  x: f32, z: f32, radius: f32,
  center: vec3f, hx: f32, hz: f32, rot: vec4f,
) -> vec3f {
  let yaw = yawFromQuat(rot);
  let rel = rotateY(x - center.x, z - center.z, -yaw);
  let resolved = resolveCircleVsAabbXZ(rel.x, rel.y, radius, -hx, hx, -hz, hz);
  if (resolved.z < 0.5) {
    return vec3f(x, z, 0.0);
  }
  let world = rotateY(resolved.x, resolved.y, yaw);
  return vec3f(center.x + world.x, center.z + world.y, 1.0);
}

fn resolveCircleVsCircleXZ(
  x: f32, z: f32, radius: f32,
  cx: f32, cz: f32, otherR: f32,
) -> vec3f {
  let dx = x - cx;
  let dz = z - cz;
  let d2 = dx * dx + dz * dz;
  let minDist = radius + otherR;
  if (d2 >= minDist * minDist) {
    return vec3f(x, z, 0.0);
  }
  if (d2 < 1e-12) {
    return vec3f(cx + minDist + 1e-3, cz, 1.0);
  }
  let d = sqrt(d2);
  let push = (minDist - d) / d + 1e-3 / d;
  return vec3f(x + dx * push, z + dz * push, 1.0);
}

fn footprintOverlaps(col: StaticCollider, x: f32, z: f32, radius: f32) -> bool {
  let center = colCenter(col);
  let rot = colRot(col);
  let kind = u32(col.kind + 0.5);
  if (kind == 0u) {
    let yaw = yawFromQuat(rot);
    let rel = rotateY(x - center.x, z - center.z, -yaw);
    let hx = col.p0 + radius;
    let hz = col.p2 + radius;
    return abs(rel.x) <= hx && abs(rel.y) <= hz;
  }
  if (kind == 1u || kind == 2u || kind == 3u) {
    let dx = x - center.x;
    let dz = z - center.z;
    return dx * dx + dz * dz <= (col.p0 + radius) * (col.p0 + radius);
  }
  let yaw = yawFromQuat(rot);
  let rel = rotateY(x - center.x, z - center.z, -yaw);
  let nx = rel.x / (col.p0 + radius);
  let nz = rel.y / (col.p2 + radius);
  return nx * nx + nz * nz <= 1.0;
}

fn resolveHorizontalVsCollider(
  x: f32, z: f32, radius: f32, col: StaticCollider,
) -> vec3f {
  let center = colCenter(col);
  let rot = colRot(col);
  let kind = u32(col.kind + 0.5);
  if (kind == 0u) {
    return resolveCircleVsOrientedBoxXZ(x, z, radius, center, col.p0, col.p2, rot);
  }
  if (kind == 1u || kind == 2u || kind == 3u) {
    return resolveCircleVsCircleXZ(x, z, radius, center.x, center.z, col.p0);
  }
  let yaw = yawFromQuat(rot);
  let rel = rotateY(x - center.x, z - center.z, -yaw);
  let rx = col.p0 + radius;
  let rz = col.p2 + radius;
  let nx = rel.x / rx;
  let nz = rel.y / rz;
  let d2 = nx * nx + nz * nz;
  if (d2 >= 1.0) {
    return vec3f(x, z, 0.0);
  }
  if (d2 < 1e-12) {
    let world = rotateY(rx + 1e-3, 0.0, yaw);
    return vec3f(center.x + world.x, center.z + world.y, 1.0);
  }
  let d = sqrt(d2);
  let scale = (1.0 - d) / d + 1e-3 / d;
  let world = rotateY(rel.x + rel.x * scale, rel.y + rel.y * scale, yaw);
  return vec3f(center.x + world.x, center.z + world.y, 1.0);
}

fn gatherCandidates(
  amin: vec3f, amax: vec3f,
  outIndices: ptr<function, array<u32, 64>>,
) -> u32 {
  var count = 0u;
  let minCX = i32(floor((amin.x - GRID_ORIGIN) / GRID_CELL_SIZE));
  let maxCX = i32(floor((amax.x - GRID_ORIGIN) / GRID_CELL_SIZE));
  let minCZ = i32(floor((amin.z - GRID_ORIGIN) / GRID_CELL_SIZE));
  let maxCZ = i32(floor((amax.z - GRID_ORIGIN) / GRID_CELL_SIZE));

  let x0 = max(minCX, 0);
  let x1 = min(maxCX, i32(GRID_RES) - 1);
  let z0 = max(minCZ, 0);
  let z1 = min(maxCZ, i32(GRID_RES) - 1);

  for (var cz = z0; cz <= z1; cz++) {
    for (var cx = x0; cx <= x1; cx++) {
      let cell = u32(cz) * GRID_RES + u32(cx);
      let start = cellStarts[cell];
      let n = cellCounts[cell];
      for (var k = 0u; k < n; k++) {
        if (count >= MAX_CANDIDATES) {
          return count;
        }
        let idx = cellIndices[start + k];
        let col = colliders[idx];
        if (!aabbIntersects(amin, amax, colAabbMin(col), colAabbMax(col))) {
          continue;
        }
        var dup = false;
        for (var d = 0u; d < count; d++) {
          if ((*outIndices)[d] == idx) {
            dup = true;
            break;
          }
        }
        if (dup) {
          continue;
        }
        (*outIndices)[count] = idx;
        count += 1u;
      }
    }
  }
  return count;
}

@compute @workgroup_size(64)
fn resolveCharacters(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  let characterCount = u32(params.characterCount + 0.5);
  if (i >= characterCount) {
    return;
  }

  var ch = characters[i];
  if (ch.awake < 0.5) {
    characters[i] = ch;
    return;
  }

  let foot = ch.halfHeight + ch.radius;
  let speed2 = ch.velX * ch.velX + ch.velY * ch.velY + ch.velZ * ch.velZ;
  let footY0 = ch.posY - foot;
  if (speed2 < 1e-10 && ch.onGround > 0.5 && footY0 <= SURFACE_EPS + 0.05) {
    characters[i] = ch;
    return;
  }

  var remaining = params.dt;
  var sub = 0u;

  while (remaining > 1e-12 && sub < MAX_SUBSTEPS) {
    let step = min(remaining, params.stepSec);
    remaining -= step;
    sub += 1u;

    let stepPrevY = ch.posY;

    ch.posX += ch.velX * step;
    ch.posZ += ch.velZ * step;

    var pos = vec3f(ch.posX, ch.posY, ch.posZ);
    var box = capsuleAabb(pos, ch.radius, ch.halfHeight);
    var candidates: array<u32, 64>;
    var candCount = gatherCandidates(box.mn, box.mx, &candidates);

    for (var c = 0u; c < candCount; c++) {
      let col = colliders[candidates[c]];
      let colMin = colAabbMin(col);
      let colMax = colAabbMax(col);
      let yOverlap = box.mx.y > colMin.y + 1e-4 && box.mn.y < colMax.y - 1e-4;
      if (!yOverlap) {
        continue;
      }
      if (!aabbIntersects(box.mn, box.mx, colMin, colMax)) {
        continue;
      }
      let resolved = resolveHorizontalVsCollider(ch.posX, ch.posZ, ch.radius, col);
      if (resolved.z < 0.5) {
        continue;
      }
      ch.posX = resolved.x;
      ch.posZ = resolved.y;
      pos = vec3f(ch.posX, ch.posY, ch.posZ);
      box = capsuleAabb(pos, ch.radius, ch.halfHeight);
    }

    pos = vec3f(ch.posX, ch.posY, ch.posZ);
    box = capsuleAabb(pos, ch.radius, ch.halfHeight);
    candCount = gatherCandidates(box.mn, box.mx, &candidates);

    let footY = ch.posY - foot;
    var supportY = -1e30;
    var hasSupport = false;
    if (footY <= SURFACE_EPS) {
      supportY = 0.0;
      hasSupport = true;
    } else {
      for (var c = 0u; c < candCount; c++) {
        let col = colliders[candidates[c]];
        if (!footprintOverlaps(col, ch.posX, ch.posZ, ch.radius)) {
          continue;
        }
        let top = col.amaxY;
        if (top > supportY) {
          supportY = top;
          hasSupport = true;
        }
      }
      if (hasSupport) {
        if (!(footY >= supportY - SURFACE_EPS && footY <= supportY + SURFACE_EPS)) {
          hasSupport = false;
        }
      }
    }

    if (hasSupport && ch.velY <= 0.0) {
      ch.velY = 0.0;
      ch.posY = supportY + foot;
      ch.onGround = 1.0;
      continue;
    }

    ch.velY -= ch.gravity * step;
    ch.posY += ch.velY * step;
    ch.onGround = 0.0;

    pos = vec3f(ch.posX, ch.posY, ch.posZ);
    box = capsuleAabb(pos, ch.radius, ch.halfHeight);
    candCount = gatherCandidates(box.mn, box.mx, &candidates);
    let ext = ch.halfHeight + ch.radius;

    for (var c = 0u; c < candCount; c++) {
      let col = colliders[candidates[c]];
      let colMin = colAabbMin(col);
      let colMax = colAabbMax(col);
      if (!aabbIntersects(box.mn, box.mx, colMin, colMax)) {
        continue;
      }
      let top = col.amaxY;
      let bottom = col.aminY;
      let prevBottom = stepPrevY - ext;
      let currBottom = ch.posY - ext;
      let prevTop = stepPrevY + ext;
      let currTop = ch.posY + ext;
      let supported = footprintOverlaps(col, ch.posX, ch.posZ, ch.radius);

      if (ch.velY <= 0.0 && supported && prevBottom >= top - 1e-4 && currBottom < top) {
        ch.posY = top + ext;
        ch.velY = 0.0;
        ch.onGround = 1.0;
      } else if (ch.velY > 0.0 && supported && prevTop <= bottom + 1e-4 && currTop > bottom) {
        ch.posY = bottom - ext;
        ch.velY = 0.0;
      }
      pos = vec3f(ch.posX, ch.posY, ch.posZ);
      box = capsuleAabb(pos, ch.radius, ch.halfHeight);
    }

    if (ch.posY - foot < 0.0) {
      ch.posY = foot;
      ch.velY = 0.0;
      ch.onGround = 1.0;
    }
  }

  characters[i] = ch;
}
`;
