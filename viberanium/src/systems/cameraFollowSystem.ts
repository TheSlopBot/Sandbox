import { type Registry } from '../engine/registry.ts';
import { type Input } from '../input/input.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform } from '../components/transform.ts';
import { type Collider } from '../components/collider.ts';
import { type CameraFollow } from '../components/cameraFollow.ts';
import { type RenderPipeline } from '../render/pipeline.ts';
import { rayAabbDistance } from '../collision/aabb.ts';
import { v3Set } from '../math/vec3.ts';

const MIN_DIST = 1.0;
const GROUND_Y = 0;
const CAM_RADIUS = 0.15;
const SPATIAL_CELL = 4;

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

        const hit = rayAabbDistance(
          ox,
          oy,
          oz,
          dx,
          dy,
          dz,
          aabb.min[0] - CAM_RADIUS,
          aabb.min[1] - CAM_RADIUS,
          aabb.min[2] - CAM_RADIUS,
          aabb.max[0] + CAM_RADIUS,
          aabb.max[1] + CAM_RADIUS,
          aabb.max[2] + CAM_RADIUS,
          best,
        );
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
        const groundT = (GROUND_Y + CAM_RADIUS - pivotY) / rayY;
        if (groundT >= MIN_DIST) dist = Math.min(dist, groundT);
      }

      const hit = closestStaticHit(spatial, colliders, pivotX, pivotY, pivotZ, rayX, rayY, rayZ, dist);
      if (hit < dist) dist = Math.max(MIN_DIST, hit - CAM_RADIUS);

      const k = 1 - Math.exp(-15.0 * ctx.dt);
      cf.currentDist += (dist - cf.currentDist) * k;

      let camX = pivotX + rayX * cf.currentDist;
      let camY = pivotY + rayY * cf.currentDist;
      let camZ = pivotZ + rayZ * cf.currentDist;

      if (camY < GROUND_Y + CAM_RADIUS) camY = GROUND_Y + CAM_RADIUS;

      v3Set(pipeline.camera.position, camX, camY, camZ);
      v3Set(pipeline.target, pivotX, pivotY, pivotZ);
    }
  }, 15);
};
