import { type Aabb, type Collider } from '../components/collider.ts';
import { type Vec3, v3, v3Set } from '../math/vec3.ts';
import { aabbIntersects } from './aabb.ts';
import {
  type BodyContact,
  type BodyY,
  bodyFeetY,
  contactBodyVsCollider,
  footprintOverlapsShape,
  isBodyOnBoxWalkableTop,
  projectOutOfNormal,
  separateBodyVsBoxVolume,
  snapBoxFaceNormal,
} from './characterContact.ts';

export type { BodyY, BodyContact } from './characterContact.ts';

export const DEFAULT_FLOOR_MAX_ANGLE = (50 * Math.PI) / 180;
export const SLIDE_START_SPEED_FACTOR = 1.35;
export const SLIDE_MAX_SPEED_FACTOR = 3.5;
export const SLIDE_ACCEL_TIME_SEC = 0.55;

const CONTACT_ITERS = 3;
const SURFACE_EPS = 0.05;
const SLIDE_MAX_ANGLE = (80 * Math.PI) / 180;
const SLIDE_MIN_NORMAL_Y = Math.cos(SLIDE_MAX_ANGLE);
const WALL_HEAD_ON_DOT = Math.cos((40 * Math.PI) / 180);

const _box: Aabb = {
  min: new Float32Array(3),
  max: new Float32Array(3),
};

const _groundNormal = v3(0, 1, 0);
const _downhill = v3();

export const bodyToAabb = (body: BodyY, out: Aabb): Aabb => {
  const extY = body.halfHeight + body.radius;
  out.min[0] = body.x - body.radius;
  out.min[1] = body.y - extY;
  out.min[2] = body.z - body.radius;
  out.max[0] = body.x + body.radius;
  out.max[1] = body.y + extY;
  out.max[2] = body.z + body.radius;
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
  body: BodyY,
  obstacles: Collider[],
  outBox: Aabb,
): BodyContact | null => {
  bodyToAabb(body, outBox);
  let best: BodyContact | null = null;

  for (const s of obstacles) {
    if (!s.isStatic) continue;
    if (!aabbIntersects(outBox, s.aabb)) continue;
    if (s.shape.kind !== 'box') continue;

    const contact = separateBodyVsBoxVolume(
      body,
      s.shape.center,
      s.shape.halfExtents,
      s.shape.rotation,
    );
    if (!contact || contact.depth <= 0) continue;

    const h = Math.hypot(contact.nx, contact.nz);
    const flat: BodyContact =
      h > 1e-8
        ? { nx: contact.nx / h, ny: 0, nz: contact.nz / h, depth: contact.depth, shapeKind: 'box' }
        : { ...contact, shapeKind: 'box' };

    if (!best || flat.depth > best.depth) best = flat;
  }

  return best;
};

type ContactPredicate = (
  contact: BodyContact,
  collider: Collider,
  floorMaxAngle: number,
) => boolean;

type ContactHit = {
  contact: BodyContact;
  collider: Collider;
};

const findDeepestContact = (
  body: BodyY,
  obstacles: Collider[],
  outBox: Aabb,
  predicate: ContactPredicate,
  floorMaxAngle: number,
): ContactHit | null => {
  bodyToAabb(body, outBox);
  let best: ContactHit | null = null;

  for (const s of obstacles) {
    if (!s.isStatic) continue;
    if (!aabbIntersects(outBox, s.aabb)) continue;

    const hit = contactBodyVsCollider(body, s);
    if (!hit || hit.depth <= 0) continue;

    const contact: BodyContact = { ...hit, shapeKind: s.shape.kind };
    if (!predicate(contact, s, floorMaxAngle)) continue;
    if (!best || contact.depth > best.contact.depth) best = { contact, collider: s };
  }

  return best;
};

const boxSlopeSlideContact = (
  hit: ContactHit,
  floorMaxAngle: number,
): BodyContact | null => {
  const shape = hit.collider.shape;
  if (shape.kind !== 'box') return null;

  const face = snapBoxFaceNormal(
    shape.rotation,
    hit.contact.nx,
    hit.contact.ny,
    hit.contact.nz,
  );
  if (!face || !isSlideSlope(face.ny, floorMaxAngle)) return null;

  return {
    ...hit.contact,
    nx: face.nx,
    ny: face.ny,
    nz: face.nz,
  };
};

const applyContactPush = (body: BodyY, contact: BodyContact): BodyY => ({
  ...body,
  x: body.x + contact.nx * contact.depth,
  y: body.y + contact.ny * contact.depth,
  z: body.z + contact.nz * contact.depth,
});

const applyFloorPush = (body: BodyY, contact: BodyContact): BodyY => {
  if (contact.ny > 0.15) {
    return {
      ...body,
      y: body.y + contact.depth / contact.ny,
    };
  }

  return applyContactPush(body, contact);
};

const isWithinFloorSnap = (foot: number, surfaceFoot: number): boolean =>
  foot <= surfaceFoot + SURFACE_EPS &&
  surfaceFoot - foot <= SURFACE_EPS;

const contactSurfaceFootY = (body: BodyY, contact: BodyContact): number =>
  bodyFeetY(applyFloorPush(body, contact));

const makeIsFloorContact =
  (body: BodyY): ContactPredicate =>
  (contact, collider, floorMaxAngle) => {
    if (classifyContact(contact.ny, floorMaxAngle) !== 'floor') {
      if (collider.shape.kind === 'box') return false;
      return contact.ny > SLIDE_MIN_NORMAL_Y;
    }

    const shape = collider.shape;
    if (shape.kind === 'box') {
      if (!footprintOverlapsShape(shape, body.x, body.z, body.radius)) return false;
      if (!isBodyOnBoxWalkableTop(shape.center, shape.halfExtents, shape.rotation, body, SURFACE_EPS)) {
        return false;
      }

      const foot = bodyFeetY(body);
      const surfaceFoot = contactSurfaceFootY(body, contact);
      return isWithinFloorSnap(foot, surfaceFoot);
    }

    return true;
  };

const makeIsBlockingContact = (body: BodyY): ContactPredicate => {
  const isFloor = makeIsFloorContact(body);
  return (contact, collider, floorMaxAngle) => !isFloor(contact, collider, floorMaxAngle);
};

const isUndersideBoxHit = (body: BodyY, collider: Collider, contact: BodyContact, floorMaxAngle: number): boolean => {
  const shape = collider.shape;
  if (shape.kind !== 'box') return false;
  if (classifyContact(contact.ny, floorMaxAngle) !== 'floor') return false;
  return !isBodyOnBoxWalkableTop(shape.center, shape.halfExtents, shape.rotation, body, SURFACE_EPS);
};

const findSupportFloorContact = (
  body: BodyY,
  obstacles: Collider[],
  outBox: Aabb,
  floorMaxAngle: number,
): BodyContact | null => {
  const isFloor = makeIsFloorContact(body);
  const foot = bodyFeetY(body);
  let best: BodyContact | null = null;
  let bestTop = -Infinity;

  bodyToAabb(body, outBox);

  for (const s of obstacles) {
    if (!s.isStatic) continue;
    if (!aabbIntersects(outBox, s.aabb)) continue;

    const hit = contactBodyVsCollider(body, s);
    if (!hit || hit.depth <= 0) continue;

    const contact: BodyContact = { ...hit, shapeKind: s.shape.kind };
    if (!isFloor(contact, s, floorMaxAngle)) continue;

    const topY = contactSurfaceFootY(body, contact);
    if (!isWithinFloorSnap(foot, topY)) continue;
    if (topY <= bestTop + 1e-4) continue;

    bestTop = topY;
    best = contact;
  }

  return best;
};

const applyWallPush = (body: BodyY, contact: BodyContact): BodyY => {
  const h = Math.hypot(contact.nx, contact.nz);
  if (h < 1e-8) return applyContactPush(body, contact);

  const scale = contact.depth / h;
  return {
    ...body,
    x: body.x + contact.nx * scale,
    z: body.z + contact.nz * scale,
  };
};

const slideVelocityOnWall = (velocity: Vec3, contact: BodyContact) => {
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

const isUphillOnSlope = (velocity: Vec3, contact: BodyContact): boolean => {
  const down = downhillFromNormal(_downhill, contact.nx, contact.ny, contact.nz);
  if (!down) return false;

  return velocity[0] * down[0] + velocity[1] * down[1] + velocity[2] * down[2] < -1e-4;
};

const stopOnWalkableFloor = (velocity: Vec3, contact: BodyContact) => {
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
  body: BodyY,
  obstacles: Collider[],
  groundY: number,
  floorMaxAngle: number,
  outBox: Aabb,
): { body: BodyY; contact: BodyContact } | null => {
  const foot = body.y - body.halfHeight - body.radius;
  const ext = body.halfHeight + body.radius;

  let bestY = -Infinity;
  let bestBody: BodyY | null = null;
  let bestContact: BodyContact | null = null;

  const consider = (surfaceY: number, contact: BodyContact) => {
    if (surfaceY > foot + SURFACE_EPS) return;
    if (foot - surfaceY > SURFACE_EPS) return;
    if (surfaceY <= bestY + 1e-4) return;

    bestY = surfaceY;
    bestContact = contact;
    bestBody = { ...body, y: surfaceY + ext };
  };

  if (foot - groundY <= SURFACE_EPS) {
    consider(groundY, { nx: 0, ny: 1, nz: 0, depth: 0 });
  }

  const contact = findSupportFloorContact(body, obstacles, outBox, floorMaxAngle);
  if (contact) {
    const snapped = applyFloorPush(body, contact);
    consider(snapped.y - snapped.halfHeight - snapped.radius, contact);
  }

  if (!bestBody || !bestContact) return null;

  return { body: bestBody, contact: bestContact };
};

export type MoveAndSlideResult = {
  body: BodyY;
  onGround: boolean;
  groundNormal: Vec3;
  sliding: boolean;
};

export const resolveCylinderMoveAndSlide = (
  body: BodyY,
  velocity: Vec3,
  obstacles: Collider[],
  groundY: number,
  floorMaxAngle = DEFAULT_FLOOR_MAX_ANGLE,
  alreadySliding = false,
  alreadyOnGround = false,
  outBox: Aabb = _box,
): MoveAndSlideResult => {
  let next = body;
  let onGround = false;
  let sliding = false;
  v3Set(_groundNormal, 0, 1, 0);

  const foot = next.y - next.halfHeight - next.radius;
  if (foot <= groundY + 1e-4) {
    next = { ...next, y: groundY + next.halfHeight + next.radius };
    if (velocity[1] < 0) velocity[1] = 0;
    onGround = true;
  }

  for (let iter = 0; iter < CONTACT_ITERS; iter++) {
    let floor = findSupportFloorContact(next, obstacles, outBox, floorMaxAngle);
    const wallHit = findDeepestContact(next, obstacles, outBox, makeIsBlockingContact(next), floorMaxAngle);
    const wall = wallHit?.contact ?? null;
    const steepBox = wallHit ? boxSlopeSlideContact(wallHit, floorMaxAngle) : null;
    const uphillSteep =
      steepBox && isUphillOnSlope(velocity, steepBox) ? steepBox : null;

    const volume =
      floor || steepBox ? null : findDeepestBoxVolumeContact(next, obstacles, outBox);
    if (!volume && !wall && !floor) break;

    const startSlopeSlide =
      !!steepBox &&
      !floor &&
      (alreadySliding ||
        sliding ||
        (!(alreadyOnGround || onGround) && velocity[1] <= 0));

    const blocking = steepBox
      ? steepBox
      : volume && wall
        ? volume.depth >= wall.depth
          ? volume
          : wall
        : (volume ?? wall);

    if (blocking) {
      const underside = wallHit ? isUndersideBoxHit(next, wallHit.collider, blocking, floorMaxAngle) : false;
      if (underside || classifyContact(blocking.ny, floorMaxAngle) === 'ceiling') {
        next = applyContactPush(next, blocking);
        projectOutOfNormal(velocity, blocking);
        if (velocity[1] > 0) velocity[1] = 0;
      } else if (startSlopeSlide) {
        next = applyContactPush(next, blocking);
        sliding = true;
        onGround = false;
        v3Set(_groundNormal, blocking.nx, blocking.ny, blocking.nz);
        projectOutOfNormal(velocity, blocking);
      } else if (uphillSteep && blocking === uphillSteep) {
        next = applyContactPush(next, uphillSteep);
        slideVelocityOnWall(velocity, uphillSteep);
      } else if (
        blocking !== floor &&
        classifyContact(blocking.ny, floorMaxAngle) === 'wall'
      ) {
        next = applyWallPush(next, blocking);
        slideVelocityOnWall(velocity, blocking);
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

  if (!sliding && velocity[1] <= 0) {
    const snap = trySurfaceSnap(next, obstacles, groundY, floorMaxAngle, outBox);
    if (snap) {
      next = snap.body;
      onGround = true;
      sliding = false;
      v3Set(_groundNormal, snap.contact.nx, snap.contact.ny, snap.contact.nz);
      stopOnWalkableFloor(velocity, snap.contact);
    }
  }

  return {
    body: next,
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
