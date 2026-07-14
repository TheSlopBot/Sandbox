import { type Aabb, type Collider } from '../components/collider.ts';
import { type Vec3, v3, v3Set } from '../math/vec3.ts';
import { aabbIntersects } from './aabb.ts';
import {
  type BodyContact,
  type BodyY,
  bodyFeetY,
  contactBodyVsCollider,
  footprintOverlapsShape,
  projectOutOfNormal,
} from './characterContact.ts';

export type { BodyY, BodyContact } from './characterContact.ts';

export const DEFAULT_FLOOR_MAX_ANGLE = (50 * Math.PI) / 180;
export const SLIDE_START_SPEED_FACTOR = 1.35;
export const SLIDE_MAX_SPEED_FACTOR = 3.5;
export const SLIDE_ACCEL_TIME_SEC = 0.55;

const CONTACT_ITERS = 3;
const SURFACE_EPS = 0.05;

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
  const slideMinNormalY = Math.cos((80 * Math.PI) / 180);
  return normalY > slideMinNormalY && normalY < cosFloor;
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

type ContactPredicate = (
  contact: BodyContact,
  collider: Collider,
  floorMaxAngle: number,
) => boolean;

const depenetrate = (body: BodyY, contact: BodyContact): BodyY => ({
  ...body,
  x: body.x + contact.nx * contact.depth,
  y: body.y + contact.ny * contact.depth,
  z: body.z + contact.nz * contact.depth,
});

const isWithinFloorSnap = (foot: number, surfaceFoot: number): boolean =>
  foot <= surfaceFoot + SURFACE_EPS &&
  surfaceFoot - foot <= SURFACE_EPS;

const contactSurfaceFootY = (body: BodyY, contact: BodyContact): number =>
  bodyFeetY(depenetrate(body, contact));

const isWalkableFloorContact = (
  body: BodyY,
  contact: BodyContact,
  collider: Collider,
  floorMaxAngle: number,
): boolean => {
  if (classifyContact(contact.ny, floorMaxAngle) !== 'floor') return false;
  if (!footprintOverlapsShape(collider.shape, body.x, body.z, body.radius)) return false;

  const foot = bodyFeetY(body);
  const surfaceFoot = contactSurfaceFootY(body, contact);
  return isWithinFloorSnap(foot, surfaceFoot);
};

const isBlockingContact = (
  body: BodyY,
  contact: BodyContact,
  collider: Collider,
  floorMaxAngle: number,
): boolean => !isWalkableFloorContact(body, contact, collider, floorMaxAngle);

const findDeepestContact = (
  body: BodyY,
  obstacles: Collider[],
  outBox: Aabb,
  predicate: ContactPredicate,
  floorMaxAngle: number,
): BodyContact | null => {
  bodyToAabb(body, outBox);
  let best: BodyContact | null = null;

  for (const s of obstacles) {
    if (!s.isStatic) continue;
    if (!aabbIntersects(outBox, s.aabb)) continue;

    const hit = contactBodyVsCollider(body, s);
    if (!hit || hit.depth <= 0) continue;

    const contact: BodyContact = { ...hit, shapeKind: s.shape.kind };
    if (!predicate(contact, s, floorMaxAngle)) continue;
    if (!best || contact.depth > best.depth) best = contact;
  }

  return best;
};

const findSupportFloorContact = (
  body: BodyY,
  obstacles: Collider[],
  outBox: Aabb,
  floorMaxAngle: number,
): BodyContact | null => {
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
    if (!isWalkableFloorContact(body, contact, s, floorMaxAngle)) continue;

    const topY = contactSurfaceFootY(body, contact);
    if (!isWithinFloorSnap(foot, topY)) continue;
    if (topY <= bestTop + 1e-4) continue;

    bestTop = topY;
    best = contact;
  }

  return best;
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

const shouldSlopeSlide = (
  contact: BodyContact,
  floor: BodyContact | null,
  velocity: Vec3,
  alreadySliding: boolean,
  sliding: boolean,
  floorMaxAngle: number,
): boolean =>
  isSlideSlope(contact.ny, floorMaxAngle) &&
  !floor &&
  !isUphillOnSlope(velocity, contact) &&
  (alreadySliding || sliding || velocity[1] <= 0);

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
    const snapped = depenetrate(body, contact);
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
  _alreadyOnGround = false,
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
    const floor = findSupportFloorContact(next, obstacles, outBox, floorMaxAngle);
    const blocking = findDeepestContact(
      next,
      obstacles,
      outBox,
      (contact, collider, angle) => isBlockingContact(next, contact, collider, angle),
      floorMaxAngle,
    );

    if (!blocking && !floor) break;

    if (blocking) {
      const kind = classifyContact(blocking.ny, floorMaxAngle);
      next = depenetrate(next, blocking);

      if (kind === 'ceiling') {
        projectOutOfNormal(velocity, blocking);
        if (velocity[1] > 0) velocity[1] = 0;
      } else if (shouldSlopeSlide(blocking, floor, velocity, alreadySliding, sliding, floorMaxAngle)) {
        sliding = true;
        onGround = false;
        v3Set(_groundNormal, blocking.nx, blocking.ny, blocking.nz);
        projectOutOfNormal(velocity, blocking);
      } else {
        projectOutOfNormal(velocity, blocking);
      }
    }

    if (floor && !sliding) {
      next = depenetrate(next, floor);
      onGround = true;
      sliding = false;
      v3Set(_groundNormal, floor.nx, floor.ny, floor.nz);
      projectOutOfNormal(velocity, floor);
      if (velocity[1] < 0) velocity[1] = 0;
    }
  }

  if (!sliding && velocity[1] <= 0) {
    const snap = trySurfaceSnap(next, obstacles, groundY, floorMaxAngle, outBox);
    if (snap) {
      next = snap.body;
      onGround = true;
      sliding = false;
      v3Set(_groundNormal, snap.contact.nx, snap.contact.ny, snap.contact.nz);
      projectOutOfNormal(velocity, snap.contact);
      if (velocity[1] < 0) velocity[1] = 0;
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
