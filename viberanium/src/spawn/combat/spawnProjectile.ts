import { type Registry } from '../../engine/registry.ts';
import { type EntityId } from '../../engine/entity.ts';
import { createTransform } from '../../components/transform.ts';
import { createSphereCollider } from '../../components/collider.ts';
import { createProjectile } from '../../components/projectile.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { COMBAT_LAYER, COMBAT_MASK } from '../../combat/combatLayers.ts';
import { v3 } from '../../math/vec3.ts';

export const spawnProjectile = (
  registry: Registry,
  opts: {
    ownerId: EntityId;
    position: [number, number, number];
    velocity: [number, number, number];
    damage: number;
    radius?: number;
    lifetime?: number;
  },
): number => {
  const entity = registry.createBare();
  const t = createTransform();
  t.position[0] = opts.position[0];
  t.position[1] = opts.position[1];
  t.position[2] = opts.position[2];
  t.dirty = true;

  const radius = opts.radius ?? 0.12;
  const collider = createSphereCollider({
    center: v3(opts.position[0], opts.position[1], opts.position[2]),
    radius,
    isStatic: false,
  });
  collider.combatLayer = COMBAT_LAYER.PROJECTILE;
  collider.combatMask = COMBAT_MASK.PROJECTILE_TARGETS;
  collider.ownerId = opts.ownerId;
  collider.entityId = entity.id;

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.collider] = collider;
  entity.components[COMPONENT_KEYS.projectile] = createProjectile({
    ownerId: opts.ownerId,
    damage: opts.damage,
    velocity: opts.velocity,
    radius,
    lifetime: opts.lifetime,
  });

  registry.register(entity);
  return entity.id;
};
