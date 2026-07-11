import { type Registry } from '../engine/registry.ts';
import { type Collider } from '../components/collider.ts';
import {
  ensureCollisionBroadphase,
  isCollisionBroadphaseDirty,
  markCollisionBroadphaseDirty,
  queryNearbyStaticColliders,
} from '../collision/collisionBroadphase.ts';
import { onCollisionStaticDirty } from './collisionStaticDirty.ts';

const _obstacles: Collider[] = [];
let broadphaseHooked = false;

const ensureBroadphaseHook = () => {
  if (broadphaseHooked) return;
  broadphaseHooked = true;
  onCollisionStaticDirty(() => markCollisionBroadphaseDirty());
  markCollisionBroadphaseDirty();
};

export const getObstacles = (registry: Registry, keys: readonly string[]): Collider[] => {
  ensureBroadphaseHook();
  _obstacles.length = 0;
  for (const key of keys) {
    for (const c of registry.getComponentsByName(key)) {
      _obstacles.push(c as Collider);
    }
  }
  ensureCollisionBroadphase(_obstacles);
  return _obstacles;
};

export const getNearbyObstacles = (
  registry: Registry,
  keys: readonly string[],
  x: number,
  z: number,
  radius: number,
): Collider[] => {
  ensureBroadphaseHook();
  if (isCollisionBroadphaseDirty()) getObstacles(registry, keys);
  return queryNearbyStaticColliders(x, z, radius);
};
