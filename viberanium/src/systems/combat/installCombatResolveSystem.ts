import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type Transform } from '../../components/transform.ts';
import { type Collider } from '../../components/collider.ts';
import { type EquipmentSlots } from '../../components/equipmentSlots.ts';
import { type Weapon } from '../../components/weapon.ts';
import { type RightHandStateMachine } from '../../components/rightHandStateMachine.ts';
import { type LeftHandStateMachine } from '../../components/leftHandStateMachine.ts';
import { type CombatIntent } from '../../components/combatIntent.ts';
import { COMBAT_LAYER } from '../../combat/combatLayers.ts';
import {
  rebuildCombatBroadphase,
  findCombatOverlaps,
} from '../../combat/combatBroadphase.ts';
import { colliderCenter } from '../../combat/combatContact.ts';
import { pushCombatEvent } from '../../combat/combatEvents.ts';
import {
  attachWeaponHitbox,
  detachWeaponHitbox,
} from '../../spawn/combat/attachWeaponHitbox.ts';
import { type WeaponDefinition } from '../../definitions/weapons/weaponDefinition.ts';
import { v3 } from '../../math/vec3.ts';
import {
  trySpawnGunProjectile,
  type TrySpawnGunProjectileDeps,
} from './trySpawnGunProjectile.ts';
import { type GpuDevice } from '../../render/gl/device.ts';
import { type TextureCache } from '../../render/gl/texture.ts';
import { type GltfCache } from '../../assets/gltf/cache.ts';

export type CombatResolveDeps = {
  getWeaponDef: (id: string) => WeaponDefinition | undefined;
  device?: GpuDevice;
  textures?: TextureCache;
  gltfCache?: GltfCache;
};

const _center = v3();

const readWeaponEntity = (registry: Registry, entityId: number | null): Weapon | undefined => {
  if (entityId === null) return undefined;
  const entity = registry.get(entityId);
  return entity?.components[COMPONENT_KEYS.weapon] as Weapon | undefined;
};

const resolveMeleeHitWindow = (
  registry: Registry,
  allColliders: Collider[],
  e: { id: number },
  slots: EquipmentSlots,
  rightWeapon: Weapon,
  rightFsm: RightHandStateMachine,
  t: Transform,
  getWeaponDef: CombatResolveDeps['getWeaponDef'],
): void => {
  if (rightFsm.current === 'attack' && rightWeapon.state !== 'attacking') {
    rightWeapon.state = 'attacking';
    rightWeapon.stateTime = 0;
    rightWeapon.hitConsumed.clear();
    rightWeapon.swingOrigin[0] = t.position[0];
    rightWeapon.swingOrigin[1] = t.position[1] + 1.2;
    rightWeapon.swingOrigin[2] = t.position[2];
  }

  if (rightFsm.current === 'attack') {
    rightWeapon.stateTime = rightFsm.stateTime;
    const progress =
      rightFsm.attackDuration > 0 ? rightFsm.stateTime / rightFsm.attackDuration : 1;
    const inWindow =
      progress >= rightWeapon.hitWindowStart && progress <= rightWeapon.hitWindowEnd;

    if (inWindow && rightWeapon.hitboxEntityId === null && slots.right.entityId !== null) {
      const def = getWeaponDef(rightWeapon.defId);
      const hitCol = def?.colliders.find((c) => c.role === 'weapon') ?? def?.colliders[0];
      if (hitCol) {
        rightWeapon.hitboxEntityId = attachWeaponHitbox(
          registry,
          slots.right.entityId,
          e.id,
          hitCol,
        );
      }
    }

    if ((!inWindow || rightFsm.current !== 'attack') && rightWeapon.hitboxEntityId !== null) {
      if (slots.right.entityId !== null) {
        detachWeaponHitbox(registry, slots.right.entityId, rightWeapon.hitboxEntityId);
      }
      rightWeapon.hitboxEntityId = null;
    }

    if (inWindow && rightWeapon.hitboxEntityId !== null) {
      const hitboxEntity = registry.get(rightWeapon.hitboxEntityId);
      const hitbox = hitboxEntity?.components[COMPONENT_KEYS.collider] as Collider | undefined;
      if (hitbox) {
        const overlaps = findCombatOverlaps(hitbox, allColliders);
        let blocked = false;
        for (const other of overlaps) {
          if ((other.combatLayer ?? 0) & COMBAT_LAYER.SHIELD) {
            pushCombatEvent({
              kind: 'blocked',
              attackerId: e.id,
              defenderId: other.ownerId ?? other.entityId ?? -1,
            });
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          let best: Collider | null = null;
          let bestDist = Infinity;
          for (const other of overlaps) {
            if (!((other.combatLayer ?? 0) & COMBAT_LAYER.HURTBOX)) continue;
            const targetId = other.ownerId ?? other.entityId;
            if (targetId === undefined || rightWeapon.hitConsumed.has(targetId)) continue;
            colliderCenter(other, _center);
            const dx = _center[0] - rightWeapon.swingOrigin[0];
            const dy = _center[1] - rightWeapon.swingOrigin[1];
            const dz = _center[2] - rightWeapon.swingOrigin[2];
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bestDist) {
              bestDist = d;
              best = other;
            }
          }

          if (best) {
            const targetId = best.ownerId ?? best.entityId;
            if (targetId !== undefined) {
              rightWeapon.hitConsumed.add(targetId);
              pushCombatEvent({
                kind: 'damageApplied',
                targetId,
                amount: rightWeapon.damage,
                sourceId: e.id,
              });
            }
          }
        }
      }
    }
  } else if (rightWeapon.state === 'attacking') {
    rightWeapon.state = 'idle';
    if (rightWeapon.hitboxEntityId !== null && slots.right.entityId !== null) {
      detachWeaponHitbox(registry, slots.right.entityId, rightWeapon.hitboxEntityId);
      rightWeapon.hitboxEntityId = null;
    }
  }
};

export const installCombatResolveSystem = (registry: Registry, deps: CombatResolveDeps) => {
  const gunDeps: TrySpawnGunProjectileDeps = {
    getWeaponDef: deps.getWeaponDef,
    device: deps.device,
    textures: deps.textures,
    gltfCache: deps.gltfCache,
  };

  registry.addAction('update', (ctx) => {
    const allColliders = registry.getComponentsByName(COMPONENT_KEYS.collider) as Collider[];
    rebuildCombatBroadphase(allColliders);

    for (const e of registry.view(COMPONENT_KEYS.equipmentSlots)) {
      const slots = e.components[COMPONENT_KEYS.equipmentSlots] as EquipmentSlots;
      const intent = e.components[COMPONENT_KEYS.combatIntent] as CombatIntent | undefined;
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const rightFsm = e.components[COMPONENT_KEYS.rightHandStateMachine] as
        | RightHandStateMachine
        | undefined;
      const leftFsm = e.components[COMPONENT_KEYS.leftHandStateMachine] as
        | LeftHandStateMachine
        | undefined;
      if (!t || !intent) continue;

      const rightWeapon = readWeaponEntity(registry, slots.right.entityId);
      const leftWeapon = readWeaponEntity(registry, slots.left.entityId);

      if (leftWeapon && leftWeapon.kind === 'shield') {
        const blocking = leftFsm?.current === 'block';
        leftWeapon.state = blocking ? 'blocking' : 'idle';
        leftWeapon.stateTime += ctx.dt;

        if (blocking && leftWeapon.hitboxEntityId === null && slots.left.entityId !== null) {
          const def = deps.getWeaponDef(leftWeapon.defId);
          const shieldCol = def?.colliders.find((c) => c.role === 'shield') ?? def?.colliders[0];
          if (shieldCol) {
            leftWeapon.hitboxEntityId = attachWeaponHitbox(
              registry,
              slots.left.entityId,
              e.id,
              shieldCol,
            );
          }
        }

        if (!blocking && leftWeapon.hitboxEntityId !== null && slots.left.entityId !== null) {
          detachWeaponHitbox(registry, slots.left.entityId, leftWeapon.hitboxEntityId);
          leftWeapon.hitboxEntityId = null;
        }
      }

      if (!rightWeapon) continue;

      rightWeapon.cooldownRemaining = Math.max(0, rightWeapon.cooldownRemaining - ctx.dt);

      if (rightWeapon.kind === 'melee' && rightFsm) {
        resolveMeleeHitWindow(
          registry,
          allColliders,
          e,
          slots,
          rightWeapon,
          rightFsm,
          t,
          deps.getWeaponDef,
        );
      }

      if (rightWeapon.kind === 'gun') {
        trySpawnGunProjectile(registry, gunDeps, {
          ownerId: e.id,
          transform: t,
          weaponEntityId: slots.right.entityId,
          intentAimYawRad: intent.aimYawRad,
          intentAimPitchRad: intent.aimPitchRad,
          weapon: rightWeapon,
          firePressed: intent.attackPressed,
        });
      }
    }
  }, 11);
};
