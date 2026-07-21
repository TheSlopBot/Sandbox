import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type Transform } from '../../components/transform.ts';
import { type Collider, bakeColliderWorldFromLocal } from '../../components/collider.ts';
import { type Projectile } from '../../components/projectile.ts';
import { COMBAT_LAYER } from '../../combat/combatLayers.ts';
import {
  rebuildCombatBroadphase,
  findCombatOverlaps,
} from '../../combat/combatBroadphase.ts';
import { sweptSphereHitsAabb } from '../../combat/combatContact.ts';
import { pushCombatEvent } from '../../combat/combatEvents.ts';
import { orientTransformAlongVelocity } from '../../combat/orientTransformAlongVelocity.ts';

const MAX_STEP = 1 / 120;

export const installProjectileSystem = (registry: Registry) => {
  registry.addAction('update', (ctx) => {
    const allColliders = registry.getComponentsByName(COMPONENT_KEYS.collider) as Collider[];
    rebuildCombatBroadphase(allColliders);

    const staticPhysics = allColliders.filter((c) => c.isStatic);

    const toRemove: number[] = [];

    for (const e of registry.view(COMPONENT_KEYS.projectile)) {
      const projectile = e.components[COMPONENT_KEYS.projectile] as Projectile;
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const collider = e.components[COMPONENT_KEYS.collider] as Collider | undefined;
      if (!t || !collider) continue;

      let remaining = ctx.dt;
      let hit = false;

      while (remaining > 0 && !hit) {
        const step = Math.min(remaining, MAX_STEP);
        const dx = projectile.velocity[0] * step;
        const dy = projectile.velocity[1] * step;
        const dz = projectile.velocity[2] * step;
        const stepDist = Math.hypot(dx, dy, dz);
        if (stepDist < 1e-12) {
          remaining -= step;
          continue;
        }

        const ndx = dx / stepDist;
        const ndy = dy / stepDist;
        const ndz = dz / stepDist;

        let earliest = stepDist;
        for (const obstacle of staticPhysics) {
          const tHit = sweptSphereHitsAabb(
            t.position[0],
            t.position[1],
            t.position[2],
            ndx,
            ndy,
            ndz,
            projectile.radius,
            obstacle.aabb.min[0],
            obstacle.aabb.min[1],
            obstacle.aabb.min[2],
            obstacle.aabb.max[0],
            obstacle.aabb.max[1],
            obstacle.aabb.max[2],
            stepDist,
          );
          if (tHit >= 0 && tHit < earliest) {
            earliest = tHit;
            hit = true;
          }
        }

        t.position[0] += ndx * earliest;
        t.position[1] += ndy * earliest;
        t.position[2] += ndz * earliest;
        orientTransformAlongVelocity(t, projectile.velocity);
        if (collider.localShape) bakeColliderWorldFromLocal(collider, t.world);
        else {
          collider.shape.center[0] = t.position[0];
          collider.shape.center[1] = t.position[1];
          collider.shape.center[2] = t.position[2];
          const hx = projectile.radius;
          collider.aabb.min[0] = t.position[0] - hx;
          collider.aabb.min[1] = t.position[1] - hx;
          collider.aabb.min[2] = t.position[2] - hx;
          collider.aabb.max[0] = t.position[0] + hx;
          collider.aabb.max[1] = t.position[1] + hx;
          collider.aabb.max[2] = t.position[2] + hx;
        }

        remaining -= step;
        if (hit) break;

        const overlaps = findCombatOverlaps(collider, allColliders);
        for (const other of overlaps) {
          if ((other.combatLayer ?? 0) & COMBAT_LAYER.SHIELD) {
            pushCombatEvent({
              kind: 'blocked',
              attackerId: projectile.ownerId,
              defenderId: other.ownerId ?? other.entityId ?? -1,
            });
            hit = true;
            break;
          }
          if ((other.combatLayer ?? 0) & COMBAT_LAYER.HURTBOX) {
            const targetId = other.ownerId ?? other.entityId;
            if (targetId !== undefined) {
              pushCombatEvent({
                kind: 'damageApplied',
                targetId,
                amount: projectile.damage,
                sourceId: projectile.ownerId,
              });
            }
            hit = true;
            break;
          }
        }
      }

      const dxo = t.position[0] - projectile.origin[0];
      const dyo = t.position[1] - projectile.origin[1];
      const dzo = t.position[2] - projectile.origin[2];
      const traveledSq = dxo * dxo + dyo * dyo + dzo * dzo;
      const maxDist = projectile.maxDistance;
      if (hit || traveledSq >= maxDist * maxDist) toRemove.push(e.id);
    }

    for (const id of toRemove) registry.deregister(id);
  }, 7);
};
