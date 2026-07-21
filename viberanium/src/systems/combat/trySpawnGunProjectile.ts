import { type Registry } from '../../engine/registry.ts';
import { type EntityId } from '../../engine/entity.ts';
import { type Transform } from '../../components/transform.ts';
import { type Weapon } from '../../components/weapon.ts';
import { type WeaponDefinition } from '../../definitions/weapons/weaponDefinition.ts';
import { spawnProjectile } from '../../spawn/combat/spawnProjectile.ts';
import { type GpuDevice } from '../../render/gl/device.ts';
import { type TextureCache } from '../../render/gl/texture.ts';
import { type GltfCache } from '../../assets/gltf/cache.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type BoneAttachment } from '../../components/boneAttachment.ts';
import { type ChildOf } from '../../components/childOf.ts';
import { type SkeletalModel } from '../../components/skeletalModel.ts';
import { m4, m4Mul, m4Copy } from '../../math/mat4.ts';
import { updateWorldMatrix } from '../../components/transform.ts';

export type TrySpawnGunProjectileDeps = {
  getWeaponDef: (id: string) => WeaponDefinition | undefined;
  device?: GpuDevice;
  textures?: TextureCache;
  gltfCache?: GltfCache;
};

const _root = m4();
const _boneWorld = m4();
const _weaponWorld = m4();

const readWeaponWorldPosition = (
  registry: Registry,
  weaponEntityId: number | null,
  fallback: Transform,
): [number, number, number] => {
  if (weaponEntityId !== null) {
    const weaponEntity = registry.get(weaponEntityId);
    if (weaponEntity) {
      const wt = weaponEntity.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (wt && !wt.dirty) {
        return [wt.world[12]!, wt.world[13]!, wt.world[14]!];
      }

      const boneAtt = weaponEntity.components[COMPONENT_KEYS.boneAttachment] as
        | BoneAttachment
        | undefined;
      const childOf = weaponEntity.components[COMPONENT_KEYS.childOf] as ChildOf | undefined;
      if (boneAtt && childOf) {
        const parent = registry.get(childOf.parentId);
        const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;
        const parentModel = parent?.components[COMPONENT_KEYS.skeletalModel] as
          | SkeletalModel
          | undefined;
        if (parentT && parentModel) {
          updateWorldMatrix(parentT);
          m4Copy(_root, parentT.world);
          _root[13]! += parentModel.visualYOffset;
          const boneNode = parentModel.bodyScene.nodes[boneAtt.boneNodeIndex];
          if (boneNode) {
            m4Mul(_boneWorld, _root, boneNode.worldM);
            m4Mul(_weaponWorld, _boneWorld, boneAtt.localOffset);
            if (wt) {
              m4Copy(wt.world, _weaponWorld);
              wt.dirty = false;
            }
            return [_weaponWorld[12]!, _weaponWorld[13]!, _weaponWorld[14]!];
          }
        }
      }

      if (wt) {
        return [wt.world[12]!, wt.world[13]!, wt.world[14]!];
      }
    }
  }

  return [fallback.position[0], fallback.position[1] + 1.2, fallback.position[2]];
};

export const trySpawnGunProjectile = (
  registry: Registry,
  deps: TrySpawnGunProjectileDeps,
  opts: {
    ownerId: EntityId;
    transform: Transform;
    weaponEntityId: number | null;
    intentAimYawRad: number;
    intentAimPitchRad: number;
    weapon: Weapon;
    firePressed: boolean;
  },
): boolean => {
  if (opts.weapon.kind !== 'gun') return false;
  if (!opts.firePressed) return false;
  if (opts.weapon.cooldownRemaining > 0) return false;

  const def = deps.getWeaponDef(opts.weapon.defId);
  const yaw = opts.intentAimYawRad;
  const pitch = opts.intentAimPitchRad;
  const cosPitch = Math.cos(pitch);
  const dirX = Math.sin(yaw) * cosPitch;
  const dirY = -Math.sin(pitch);
  const dirZ = Math.cos(yaw) * cosPitch;
  const position = readWeaponWorldPosition(registry, opts.weaponEntityId, opts.transform);

  let radius = def?.projectile?.radius ?? 0.12;
  let projectileDef: WeaponDefinition | undefined;
  const equipmentId = def?.projectile?.equipmentId;
  if (equipmentId) {
    projectileDef = deps.getWeaponDef(equipmentId);
    const col = projectileDef?.colliders.find((c) => c.role === 'weapon') ?? projectileDef?.colliders[0];
    if (col?.shape === 'box' && col.halfExtents) {
      const hx = Math.abs(col.halfExtents[0] * col.scale[0]);
      const hy = Math.abs(col.halfExtents[1] * col.scale[1]);
      const hz = Math.abs(col.halfExtents[2] * col.scale[2]);
      radius = Math.max(hx, hy, hz, 0.05);
    } else if (col?.shape === 'sphere' && col.radius !== undefined) {
      radius = Math.abs(col.radius * Math.max(col.scale[0], col.scale[1], col.scale[2]));
    }
  }

  const speed =
    projectileDef?.stats.moveSpeed ??
    def?.projectile?.speed ??
    opts.weapon.projectileSpeed;

  spawnProjectile(registry, {
    ownerId: opts.ownerId,
    position,
    velocity: [dirX * speed, dirY * speed, dirZ * speed],
    damage: opts.weapon.damage,
    radius,
    maxDistance: 100,
    projectileDef,
    device: deps.device,
    textures: deps.textures,
    gltfCache: deps.gltfCache,
  });

  opts.weapon.cooldownRemaining = opts.weapon.fireRate;
  return true;
};
