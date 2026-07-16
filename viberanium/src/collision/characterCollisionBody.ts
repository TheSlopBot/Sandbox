import { type Registry } from '../engine/registry.ts';
import { type Entity } from '../engine/entity.ts';
import { type Children } from '../components/children.ts';
import { type Collider } from '../components/collider.ts';
import { type CharacterBodyCylinder } from '../components/characterController.ts';
import { type Vec3 } from '../math/vec3.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';

type CharacterColliderCache = {
  colliders: Collider[];
  childrenLength: number;
};

const _cacheByCharacter = new WeakMap<Entity, CharacterColliderCache>();

const collectFromChildren = (registry: Registry, ids: readonly number[], out: Collider[]): void => {
  for (const id of ids) {
    const entity = registry.get(id);
    if (!entity) continue;

    const collider = entity.components[COMPONENT_KEYS.collider] as Collider | undefined;
    if (collider?.characterCollision) out.push(collider);

    const children = entity.components[COMPONENT_KEYS.children] as Children | undefined;
    if (children && children.ids.length > 0) collectFromChildren(registry, children.ids, out);
  }
};

// A character's `characterCollision` collider set is fixed at spawn time (spawnActorColliders
// runs once); the child-tree walk below is only redone when the character's direct child count
// changes, so the hot per-tick physics path is a single WeakMap lookup instead of a tree walk.
export const collectCharacterCollisionColliders = (
  registry: Registry,
  character: Entity,
): Collider[] => {
  const children = character.components[COMPONENT_KEYS.children] as Children | undefined;
  const childrenLength = children?.ids.length ?? 0;

  const cached = _cacheByCharacter.get(character);
  if (cached && cached.childrenLength === childrenLength) return cached.colliders;

  const colliders: Collider[] = [];
  const self = character.components[COMPONENT_KEYS.collider] as Collider | undefined;
  if (self?.characterCollision) colliders.push(self);
  if (children && childrenLength > 0) collectFromChildren(registry, children.ids, colliders);

  _cacheByCharacter.set(character, { colliders, childrenLength });
  return colliders;
};

const expandAabb = (collider: Collider, min: Vec3, max: Vec3, first: boolean): void => {
  const a = collider.aabb;
  if (first) {
    min[0] = a.min[0];
    min[1] = a.min[1];
    min[2] = a.min[2];
    max[0] = a.max[0];
    max[1] = a.max[1];
    max[2] = a.max[2];
    return;
  }

  if (a.min[0] < min[0]) min[0] = a.min[0];
  if (a.min[1] < min[1]) min[1] = a.min[1];
  if (a.min[2] < min[2]) min[2] = a.min[2];
  if (a.max[0] > max[0]) max[0] = a.max[0];
  if (a.max[1] > max[1]) max[1] = a.max[1];
  if (a.max[2] > max[2]) max[2] = a.max[2];
};

const _unionMin = new Float32Array(3) as Vec3;
const _unionMax = new Float32Array(3) as Vec3;

export const readCharacterBodyFromCollisionColliders = (
  colliders: readonly Collider[],
  characterPosition: Vec3,
): CharacterBodyCylinder | null => {
  if (colliders.length === 0) return null;

  if (colliders.length === 1) {
    const shape = colliders[0]!.shape;
    if (shape.kind === 'cylinder' && shape.radius > 0 && shape.halfHeight > 0) {
      return {
        radius: shape.radius,
        halfHeight: shape.halfHeight,
        centerX: shape.center[0] - characterPosition[0],
        centerY: shape.center[1] - characterPosition[1],
        centerZ: shape.center[2] - characterPosition[2],
      };
    }
  }

  let first = true;
  for (const collider of colliders) {
    expandAabb(collider, _unionMin, _unionMax, first);
    first = false;
  }

  const halfHeight = (_unionMax[1]! - _unionMin[1]!) * 0.5;
  const radius = Math.max(_unionMax[0]! - _unionMin[0]!, _unionMax[2]! - _unionMin[2]!) * 0.5;
  if (!(halfHeight > 0) || !(radius > 0)) return null;

  const cx = (_unionMin[0]! + _unionMax[0]!) * 0.5;
  const cy = (_unionMin[1]! + _unionMax[1]!) * 0.5;
  const cz = (_unionMin[2]! + _unionMax[2]!) * 0.5;

  return {
    radius,
    halfHeight,
    centerX: cx - characterPosition[0],
    centerY: cy - characterPosition[1],
    centerZ: cz - characterPosition[2],
  };
};
