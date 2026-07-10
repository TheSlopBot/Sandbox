import { type Registry } from '../engine/registry.ts';
import { type Collider } from '../components/collider.ts';

const _obstacles: Collider[] = [];

export const getObstacles = (registry: Registry, keys: readonly string[]): Collider[] => {
  _obstacles.length = 0;
  for (const key of keys) {
    for (const c of registry.getComponentsByName(key)) {
      _obstacles.push(c as Collider);
    }
  }
  return _obstacles;
};

export const installCollisionSystem = (_registry: Registry): void => {};
