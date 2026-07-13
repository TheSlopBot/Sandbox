import { type Registry } from '../engine/registry.ts';
import { type Input } from '../input/input.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform } from '../components/transform.ts';
import { type Collider, type ColliderShape } from '../components/collider.ts';
import { type CameraFollow } from '../components/cameraFollow.ts';
import { type RenderPipeline } from '../render/pipeline.ts';
import { rayAabbDistance, rayAabbHitNormal } from '../collision/aabb.ts';
import { type Quat, q4Conjugate, q4TransformVec3 } from '../math/quat.ts';
import { type Vec3, v3, v3Set } from '../math/vec3.ts';
import { readGroundPlaneY } from './readGroundPlaneY.ts';

const MIN_DIST = 1.0;
const CAM_RADIUS = 0.15;
const SPATIAL_CELL = 4;
const IGNORE_FLOOR_NORMAL_Y = 0.2;

const wrapTwoPi = (a: number): number => {
  a = a % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a;
};

const cellKey = (cx: number, cz: number): number => ((cx * 73856093) ^ (cz * 19349663)) | 0;

type StaticSpatialIndex = {
  cellSize: number;
  cells: Map<number, Collider[]>;
  sourceCount: number;
  stamp: number;
  seen: WeakMap<Collider, number>;
};

const _invQ = new Float32Array(4) as Quat;
const _localO = v3();
const _localD = v3();
const _worldN = v3();
const _tmp = v3();

const createStaticSpatialIndex = (): StaticSpatialIndex => ({
  cellSize: SPATIAL_CELL,
  cells: new Map(),
  sourceCount: -1,
  stamp: 1,
  seen: new WeakMap(),
});

const rebuildStaticSpatialIndex = (index: StaticSpatialIndex, colliders: Collider[]): void => {
  index.cells.clear();
  index.sourceCount = colliders.length;
  const inv = 1 / index.cellSize;

  for (const collider of colliders) {
    if (!collider.isStatic) continue;

    const aabb = collider.aabb;
    const minCx = Math.floor(aabb.min[0] * inv);
    const maxCx = Math.floor(aabb.max[0] * inv);
    const minCz = Math.floor(aabb.min[2] * inv);
    const maxCz = Math.floor(aabb.max[2] * inv);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = cellKey(cx, cz);
        let bucket = index.cells.get(key);
        if (!bucket) {
          bucket = [];
          index.cells.set(key, bucket);
        }
        bucket.push(collider);
      }
    }
  }
};

const raySphereDistance = (
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  maxDist: number,
): number => {
  const fx = ox - cx;
  const fy = oy - cy;
  const fz = oz - cz;
  const b = fx * dx + fy * dy + fz * dz;
  const c = fx * fx + fy * fy + fz * fz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return Number.POSITIVE_INFINITY;

  const s = Math.sqrt(disc);
  const t0 = -b - s;
  const t1 = -b + s;
  if (t0 >= 0 && t0 <= maxDist) return t0;
  if (t1 >= 0 && t1 <= maxDist) return t1;
  return Number.POSITIVE_INFINITY;
};

const rayObbDistance = (
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  center: Vec3,
  halfExtents: Vec3,
  rotation: Quat,
  radius: number,
  maxDist: number,
): { t: number; nx: number; ny: number; nz: number } | null => {
  q4Conjugate(_invQ, rotation);
  v3Set(_tmp, ox - center[0], oy - center[1], oz - center[2]);
  q4TransformVec3(_localO, _invQ, _tmp);
  v3Set(_tmp, dx, dy, dz);
  q4TransformVec3(_localD, _invQ, _tmp);

  const hx = halfExtents[0] + radius;
  const hy = halfExtents[1] + radius;
  const hz = halfExtents[2] + radius;
  const t = rayAabbDistance(
    _localO[0],
    _localO[1],
    _localO[2],
    _localD[0],
    _localD[1],
    _localD[2],
    -hx,
    -hy,
    -hz,
    hx,
    hy,
    hz,
    maxDist,
  );
  if (!(t < maxDist)) return null;

  const localN = rayAabbHitNormal(
    _localO[0],
    _localO[1],
    _localO[2],
    _localD[0],
    _localD[1],
    _localD[2],
    -hx,
    -hy,
    -hz,
    hx,
    hy,
    hz,
    t,
  );
  v3Set(_tmp, localN.nx, localN.ny, localN.nz);
  q4TransformVec3(_worldN, rotation, _tmp);
  return { t, nx: _worldN[0], ny: _worldN[1], nz: _worldN[2] };
};

const rayShapeDistance = (
  shape: ColliderShape,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): number => {
  if (shape.kind === 'sphere') {
    const t = raySphereDistance(
      ox,
      oy,
      oz,
      dx,
      dy,
      dz,
      shape.center[0],
      shape.center[1],
      shape.center[2],
      shape.radius + CAM_RADIUS,
      maxDist,
    );
    if (!(t < maxDist)) return Number.POSITIVE_INFINITY;

    const hx = ox + dx * t - shape.center[0];
    const hy = oy + dy * t - shape.center[1];
    const hz = oz + dz * t - shape.center[2];
    const len = Math.hypot(hx, hy, hz);
    if (len > 1e-8 && hy / len >= IGNORE_FLOOR_NORMAL_Y) return Number.POSITIVE_INFINITY;
    return t;
  }

  if (shape.kind === 'box') {
    const hit = rayObbDistance(
      ox,
      oy,
      oz,
      dx,
      dy,
      dz,
      shape.center,
      shape.halfExtents,
      shape.rotation,
      CAM_RADIUS,
      maxDist,
    );
    if (!hit) return Number.POSITIVE_INFINITY;
    if (hit.ny >= IGNORE_FLOOR_NORMAL_Y) return Number.POSITIVE_INFINITY;
    return hit.t;
  }

  if (shape.kind === 'cylinder') {
    const he = v3(shape.radius, shape.halfHeight, shape.radius);
    const hit = rayObbDistance(
      ox,
      oy,
      oz,
      dx,
      dy,
      dz,
      shape.center,
      he,
      shape.rotation,
      CAM_RADIUS,
      maxDist,
    );
    if (!hit) return Number.POSITIVE_INFINITY;
    if (hit.ny >= IGNORE_FLOOR_NORMAL_Y) return Number.POSITIVE_INFINITY;
    return hit.t;
  }

  const hit = rayObbDistance(
    ox,
    oy,
    oz,
    dx,
    dy,
    dz,
    shape.center,
    shape.radii,
    shape.rotation,
    CAM_RADIUS,
    maxDist,
  );
  if (!hit) return Number.POSITIVE_INFINITY;
  if (hit.ny >= IGNORE_FLOOR_NORMAL_Y) return Number.POSITIVE_INFINITY;
  return hit.t;
};

const closestStaticHit = (
  index: StaticSpatialIndex,
  colliders: Collider[],
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): number => {
  if (colliders.length !== index.sourceCount) rebuildStaticSpatialIndex(index, colliders);

  let best = maxDist;
  const endX = ox + dx * maxDist;
  const endY = oy + dy * maxDist;
  const endZ = oz + dz * maxDist;
  const inv = 1 / index.cellSize;
  const minCx = Math.floor((Math.min(ox, endX) - CAM_RADIUS) * inv);
  const maxCx = Math.floor((Math.max(ox, endX) + CAM_RADIUS) * inv);
  const minCz = Math.floor((Math.min(oz, endZ) - CAM_RADIUS) * inv);
  const maxCz = Math.floor((Math.max(oz, endZ) + CAM_RADIUS) * inv);
  const stamp = ++index.stamp;
  if (stamp > 1_000_000_000) index.stamp = 1;

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const bucket = index.cells.get(cellKey(cx, cz));
      if (!bucket) continue;

      for (const collider of bucket) {
        if (index.seen.get(collider) === stamp) continue;
        index.seen.set(collider, stamp);

        const aabb = collider.aabb;
        if (oy + CAM_RADIUS < aabb.min[1] && endY + CAM_RADIUS < aabb.min[1]) continue;
        if (oy - CAM_RADIUS > aabb.max[1] && endY - CAM_RADIUS > aabb.max[1]) continue;

        const hit = rayShapeDistance(collider.shape, ox, oy, oz, dx, dy, dz, best);
        if (hit < best) best = hit;
      }
    }
  }

  return best;
};

export const installCameraFollowSystem = (
  registry: Registry,
  pipeline: RenderPipeline,
  input: Input,
) => {
  const spatial = createStaticSpatialIndex();

  registry.addAction('postUpdate', (ctx) => {
    const colliders = registry.getComponentsByName(COMPONENT_KEYS.collider) as Collider[];
    const groundY = readGroundPlaneY(registry);

    for (const e of registry.view(COMPONENT_KEYS.cameraFollow)) {
      const cf = e.components[COMPONENT_KEYS.cameraFollow] as CameraFollow;
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (!t) continue;

      const { dx, dy } = input.mouseDelta();
      cf.yawRad = wrapTwoPi(cf.yawRad - dx * cf.mouseSensX);
      const minPitchRad = -Math.PI * 0.5 + cf.minOrbitElevationRad;
      cf.pitchRad = Math.max(minPitchRad, Math.min(cf.maxPitchRad, cf.pitchRad + dy * cf.mouseSensY));

      const sinYaw = Math.sin(cf.yawRad);
      const cosYaw = Math.cos(cf.yawRad);
      const sinPitch = Math.sin(cf.pitchRad);
      const cosPitch = Math.cos(cf.pitchRad);

      const idealDist = cf.distance;
      const pivotX = t.position[0];
      const pivotY = t.position[1] + cf.pivotHeight;
      const pivotZ = t.position[2];

      const rayX = sinYaw * cosPitch;
      const rayY = sinPitch;
      const rayZ = cosYaw * cosPitch;

      let dist = idealDist;

      if (rayY < 0) {
        const groundT = (groundY + CAM_RADIUS - pivotY) / rayY;
        if (groundT >= MIN_DIST) dist = Math.min(dist, groundT);
      }

      const hit = closestStaticHit(spatial, colliders, pivotX, pivotY, pivotZ, rayX, rayY, rayZ, dist);
      if (hit < dist) dist = Math.max(MIN_DIST, hit - CAM_RADIUS);

      const k = 1 - Math.exp(-15.0 * ctx.dt);
      cf.currentDist += (dist - cf.currentDist) * k;

      let camX = pivotX + rayX * cf.currentDist;
      let camY = pivotY + rayY * cf.currentDist;
      let camZ = pivotZ + rayZ * cf.currentDist;

      if (camY < groundY + CAM_RADIUS) camY = groundY + CAM_RADIUS;

      v3Set(pipeline.camera.position, camX, camY, camZ);
      v3Set(pipeline.target, pivotX, pivotY, pivotZ);
    }
  }, 15);
};
