import { type Aabb, type Collider } from '../components/collider.ts';
import { type Vec3, v3, v3Set } from '../math/vec3.ts';
import { aabbIntersects } from './aabb.ts';
import {
  type CapsuleContact,
  type CapsuleY,
  contactCapsuleVsCollider,
  footprintOverlapsShape,
  projectOutOfNormal,
  separateCapsuleVsBoxVolume,
} from './capsuleContact.ts';

export type { CapsuleY, CapsuleContact } from './capsuleContact.ts';

export const DEFAULT_FLOOR_MAX_ANGLE = (50 * Math.PI) / 180;
export const FLOOR_SNAP_DISTANCE = 0.32;
export const STEP_HEIGHT = 0.25;
export const SLIDE_START_SPEED_FACTOR = 1.35;
export const SLIDE_MAX_SPEED_FACTOR = 3.5;
export const SLIDE_ACCEL_TIME_SEC = 0.55;
export const SLIDE_INPUT_COYOTE_SEC = 0.18;

const CONTACT_ITERS = 3;
const SURFACE_EPS = 0.05;
const SNAP_MAX_UP_SPEED = 4;
const SLIDE_MAX_ANGLE = (80 * Math.PI) / 180;
const SLIDE_MIN_NORMAL_Y = Math.cos(SLIDE_MAX_ANGLE);
const WALL_HEAD_ON_DOT = Math.cos((40 * Math.PI) / 180);

const _box: Aabb = {
  min: new Float32Array(3),
  max: new Float32Array(3),
};

const _groundNormal = v3(0, 1, 0);
const _downhill = v3();

export const capsuleToAabb = (capsule: CapsuleY, out: Aabb): Aabb => {
  const extY = capsule.halfHeight + capsule.radius;
  out.min[0] = capsule.x - capsule.radius;
  out.min[1] = capsule.y - extY;
  out.min[2] = capsule.z - capsule.radius;
  out.max[0] = capsule.x + capsule.radius;
  out.max[1] = capsule.y + extY;
  out.max[2] = capsule.z + capsule.radius;
  return out;
};

export type ContactKind = 'floor' | 'wall' | 'ceiling';

export const classifyContact = (
  normalY: number,
  floorMaxAngle = DEFAULT_FLOOR_MAX_ANGLE,
): ContactKind => {
  const cosFloor = Math.cos(floorMaxAngle);
  if (normalY >= cosFloor) return 'floor';
  if (normalY <= -cosFloor) return 'ceiling';
  return 'wall';
};

export const isSlideSlope = (
  normalY: number,
  floorMaxAngle = DEFAULT_FLOOR_MAX_ANGLE,
): boolean => {
  const cosFloor = Math.cos(floorMaxAngle);
  return normalY > SLIDE_MIN_NORMAL_Y && normalY < cosFloor;
};

export const pointBlocksNav = (
  collider: Collider,
  x: number,
  z: number,
  margin: number,
): boolean => {
  if (!collider.isStatic) return false;

  const { min, max } = collider.aabb;
  if (x < min[0] - margin || x > max[0] + margin || z < min[2] - margin || z > max[2] + margin) {
    return false;
  }

  return footprintOverlapsShape(collider.shape, x, z, margin);
};

const findDeepestBoxVolumeContact = (
  capsule: CapsuleY,
  obstacles: Collider[],
  outBox: Aabb,
): CapsuleContact | null => {
  capsuleToAabb(capsule, outBox);
  let best: CapsuleContact | null = null;

  for (const s of obstacles) {
    if (!s.isStatic) continue;
    if (!aabbIntersects(outBox, s.aabb)) continue;
    if (s.shape.kind !== 'box') continue;

    const contact = separateCapsuleVsBoxVolume(
      capsule,
      s.shape.center,
      s.shape.halfExtents,
      s.shape.rotation,
    );
    if (!contact || contact.depth <= 0) continue;

    const h = Math.hypot(contact.nx, contact.nz);
    const flat: CapsuleContact =
      h > 1e-8
        ? { nx: contact.nx / h, ny: 0, nz: contact.nz / h, depth: contact.depth, shapeKind: 'box' }
        : { ...contact, shapeKind: 'box' };

    if (!best || flat.depth > best.depth) best = flat;
  }

  return best;
};

const findDeepestContact = (
  capsule: CapsuleY,
  obstacles: Collider[],
  outBox: Aabb,
  predicate: (contact: CapsuleContact, floorMaxAngle: number) => boolean,
  floorMaxAngle: number,
): CapsuleContact | null => {
  capsuleToAabb(capsule, outBox);
  let best: CapsuleContact | null = null;

  for (const s of obstacles) {
    if (!s.isStatic) continue;
    if (!aabbIntersects(outBox, s.aabb)) continue;

    const hit = contactCapsuleVsCollider(capsule, s);
    if (!hit || hit.depth <= 0) continue;

    const contact: CapsuleContact = { ...hit, shapeKind: s.shape.kind };
    if (!predicate(contact, floorMaxAngle)) continue;
    if (!best || contact.depth > best.depth) best = contact;
  }

  return best;
};

const isFloorContact = (contact: CapsuleContact, floorMaxAngle: number) => {
  if (classifyContact(contact.ny, floorMaxAngle) === 'floor') return true;
  if (contact.shapeKind === 'box') return false;
  return contact.ny > SLIDE_MIN_NORMAL_Y;
};

const isBlockingContact = (contact: CapsuleContact, floorMaxAngle: number) =>
  !isFloorContact(contact, floorMaxAngle);

const applyContactPush = (capsule: CapsuleY, contact: CapsuleContact): CapsuleY => ({
  ...capsule,
  x: capsule.x + contact.nx * contact.depth,
  y: capsule.y + contact.ny * contact.depth,
  z: capsule.z + contact.nz * contact.depth,
});

const applyFloorPush = (capsule: CapsuleY, contact: CapsuleContact): CapsuleY => {
  if (contact.ny > 0.15) {
    return {
      ...capsule,
      y: capsule.y + contact.depth / contact.ny,
    };
  }

  return applyContactPush(capsule, contact);
};

const applyWallPush = (capsule: CapsuleY, contact: CapsuleContact): CapsuleY => {
  const h = Math.hypot(contact.nx, contact.nz);
  if (h < 1e-8) return applyContactPush(capsule, contact);

  const scale = contact.depth / h;
  return {
    ...capsule,
    x: capsule.x + contact.nx * scale,
    z: capsule.z + contact.nz * scale,
  };
};

const slideVelocityOnWall = (velocity: Vec3, contact: CapsuleContact) => {
  const h = Math.hypot(contact.nx, contact.nz);
  if (h < 1e-8) {
    projectOutOfNormal(velocity, contact);
    return;
  }

  const nx = contact.nx / h;
  const nz = contact.nz / h;
  const speed = Math.hypot(velocity[0], velocity[2]);
  if (speed < 1e-8) return;

  const headOn = -(velocity[0] * nx + velocity[2] * nz) / speed;
  const into = velocity[0] * nx + velocity[2] * nz;
  if (into < 0) {
    velocity[0] -= nx * into;
    velocity[2] -= nz * into;
  }

  if (headOn >= WALL_HEAD_ON_DOT) {
    velocity[0] = 0;
    velocity[2] = 0;
    return;
  }

  const along = Math.hypot(velocity[0], velocity[2]);
  if (along < 1e-8) return;

  const scale = speed / along;
  velocity[0] *= scale;
  velocity[2] *= scale;
};

const downhillFromNormal = (
  out: Vec3,
  nx: number,
  ny: number,
  nz: number,
): Vec3 | null => {
  const sx = nx * ny;
  const sy = ny * ny - 1;
  const sz = nz * ny;
  const slen = Math.hypot(sx, sy, sz);
  if (slen < 1e-8) return null;

  const inv = 1 / slen;
  return v3Set(out, sx * inv, sy * inv, sz * inv);
};

const stopOnWalkableFloor = (velocity: Vec3, contact: CapsuleContact) => {
  projectOutOfNormal(velocity, contact);

  const horiz = Math.hypot(velocity[0], velocity[2]);
  if (horiz > 1e-4) return;

  const down = downhillFromNormal(_downhill, contact.nx, contact.ny, contact.nz);
  if (!down) {
    if (velocity[1] < 0) velocity[1] = 0;
    return;
  }

  const along = velocity[0] * down[0] + velocity[1] * down[1] + velocity[2] * down[2];
  if (along <= 0) return;

  velocity[0] -= down[0] * along;
  velocity[1] -= down[1] * along;
  velocity[2] -= down[2] * along;
};

const trySurfaceSnap = (
  capsule: CapsuleY,
  obstacles: Collider[],
  groundY: number,
  floorMaxAngle: number,
  outBox: Aabb,
): { capsule: CapsuleY; contact: CapsuleContact } | null => {
  const foot = capsule.y - capsule.halfHeight - capsule.radius;
  const ext = capsule.halfHeight + capsule.radius;

  let bestY = -Infinity;
  let bestCapsule: CapsuleY | null = null;
  let bestContact: CapsuleContact | null = null;

  const consider = (surfaceY: number, contact: CapsuleContact) => {
    if (surfaceY > foot + SURFACE_EPS) return;
    if (foot - surfaceY > FLOOR_SNAP_DISTANCE + SURFACE_EPS) return;
    if (surfaceY <= bestY + 1e-4) return;

    bestY = surfaceY;
    bestContact = contact;
    bestCapsule = { ...capsule, y: surfaceY + ext };
  };

  if (foot - groundY <= FLOOR_SNAP_DISTANCE + SURFACE_EPS) {
    consider(groundY, { nx: 0, ny: 1, nz: 0, depth: 0 });
  }

  const probe: CapsuleY = { ...capsule, y: capsule.y - FLOOR_SNAP_DISTANCE };
  const contact = findDeepestContact(probe, obstacles, outBox, isFloorContact, floorMaxAngle);
  if (contact) {
    const snapped = applyFloorPush(probe, contact);
    consider(snapped.y - snapped.halfHeight - snapped.radius, contact);
  }

  if (!bestCapsule || !bestContact) return null;

  return { capsule: bestCapsule, contact: bestContact };
};

const isCeilingContact = (contact: CapsuleContact, floorMaxAngle: number) =>
  classifyContact(contact.ny, floorMaxAngle) === 'ceiling';

const tryStepUp = (
  capsule: CapsuleY,
  velocity: Vec3,
  obstacles: Collider[],
  floorMaxAngle: number,
  outBox: Aabb,
): { capsule: CapsuleY; contact: CapsuleContact } | null => {
  if (Math.hypot(velocity[0], velocity[2]) < 1e-8) return null;

  const foot = capsule.y - capsule.halfHeight - capsule.radius;
  const raised: CapsuleY = { ...capsule, y: capsule.y + STEP_HEIGHT };

  if (findDeepestContact(raised, obstacles, outBox, isCeilingContact, floorMaxAngle)) return null;

  const floor = findDeepestContact(raised, obstacles, outBox, isFloorContact, floorMaxAngle);
  if (!floor) return null;

  const stepped = applyFloorPush(raised, floor);
  const steppedFoot = stepped.y - stepped.halfHeight - stepped.radius;
  if (steppedFoot <= foot + SURFACE_EPS) return null;
  if (steppedFoot > foot + STEP_HEIGHT + SURFACE_EPS) return null;

  const wall = findDeepestContact(stepped, obstacles, outBox, isBlockingContact, floorMaxAngle);
  if (
    wall &&
    !isCeilingContact(wall, floorMaxAngle) &&
    !(wall.shapeKind === 'box' && isSlideSlope(wall.ny, floorMaxAngle)) &&
    wall.depth > 0.05
  ) {
    return null;
  }

  return { capsule: stepped, contact: floor };
};

export type MoveAndSlideResult = {
  capsule: CapsuleY;
  onGround: boolean;
  groundNormal: Vec3;
  sliding: boolean;
};

export const resolveCapsuleMoveAndSlide = (
  capsule: CapsuleY,
  velocity: Vec3,
  obstacles: Collider[],
  groundY: number,
  floorMaxAngle = DEFAULT_FLOOR_MAX_ANGLE,
  alreadySliding = false,
  alreadyOnGround = false,
  outBox: Aabb = _box,
): MoveAndSlideResult => {
  let next = capsule;
  let onGround = false;
  let sliding = false;
  v3Set(_groundNormal, 0, 1, 0);

  const foot = next.y - next.halfHeight - next.radius;
  if (foot < groundY) {
    next = { ...next, y: groundY + next.halfHeight + next.radius };
    if (velocity[1] < 0) velocity[1] = 0;
    onGround = true;
  }

  for (let iter = 0; iter < CONTACT_ITERS; iter++) {
    const floor = findDeepestContact(next, obstacles, outBox, isFloorContact, floorMaxAngle);
    const wall = findDeepestContact(next, obstacles, outBox, isBlockingContact, floorMaxAngle);
    const steepBox =
      wall && wall.shapeKind === 'box' && isSlideSlope(wall.ny, floorMaxAngle) ? wall : null;
    const volume =
      floor || steepBox ? null : findDeepestBoxVolumeContact(next, obstacles, outBox);
    if (!volume && !wall && !floor) break;

    const startSlopeSlide =
      !!steepBox && (alreadySliding || sliding || !(alreadyOnGround || onGround));

    const blocking = steepBox
      ? steepBox
      : volume && wall
        ? volume.depth >= wall.depth
          ? volume
          : wall
        : (volume ?? wall);

    if (blocking) {
      if (classifyContact(blocking.ny, floorMaxAngle) === 'ceiling') {
        next = applyContactPush(next, blocking);
        projectOutOfNormal(velocity, blocking);
        if (velocity[1] > 0) velocity[1] = 0;
      } else if (startSlopeSlide) {
        next = applyContactPush(next, blocking);
        sliding = true;
        onGround = false;
        v3Set(_groundNormal, blocking.nx, blocking.ny, blocking.nz);
        projectOutOfNormal(velocity, blocking);
      } else {
        const step =
          (alreadyOnGround || onGround) && !sliding
            ? tryStepUp(next, velocity, obstacles, floorMaxAngle, outBox)
            : null;

        if (step) {
          next = step.capsule;
          onGround = true;
          sliding = false;
          v3Set(_groundNormal, step.contact.nx, step.contact.ny, step.contact.nz);
          stopOnWalkableFloor(velocity, step.contact);
        } else {
          next = applyWallPush(next, blocking);
          slideVelocityOnWall(velocity, blocking);
        }
      }
    }

    if (floor && !sliding) {
      next = applyFloorPush(next, floor);
      onGround = true;
      sliding = false;
      v3Set(_groundNormal, floor.nx, floor.ny, floor.nz);
      stopOnWalkableFloor(velocity, floor);
    }
  }

  if (!sliding && velocity[1] < SNAP_MAX_UP_SPEED) {
    const snap = trySurfaceSnap(next, obstacles, groundY, floorMaxAngle, outBox);
    if (snap) {
      next = snap.capsule;
      onGround = true;
      sliding = false;
      v3Set(_groundNormal, snap.contact.nx, snap.contact.ny, snap.contact.nz);
      stopOnWalkableFloor(velocity, snap.contact);
    }
  }

  return {
    capsule: next,
    onGround,
    sliding,
    groundNormal: v3(_groundNormal[0], _groundNormal[1], _groundNormal[2]),
  };
};

export const applySlideVelocity = (
  velocity: Vec3,
  nx: number,
  ny: number,
  nz: number,
  slideSpeed: number,
) => {
  const down = downhillFromNormal(_downhill, nx, ny, nz);
  if (!down) return;

  velocity[0] = down[0] * slideSpeed;
  velocity[1] = down[1] * slideSpeed;
  velocity[2] = down[2] * slideSpeed;
};

export { projectOutOfNormal };
