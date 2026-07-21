import {
  type Registry,
  type GpuDevice,
  type TextureCache,
  type GltfCache,
  type Input,
  installProjectileSystem,
  installCombatResolveSystem,
  installHealthSystem,
  installFullBodyAnimationSystem,
  installHitboxFollowSystem,
  installRightHandAnimationFsmSystem,
  installLeftHandAnimationFsmSystem,
  installAnimationAimOffsetSystem,
  installAnimationPoseOverlaySystem,
  installCombatFacingSystem,
  pushCombatEvent,
  COMPONENT_KEYS,
  type Health,
  type Transform,
} from 'viberanium';
import { getWeaponDef } from '../../../catalog/weapons/registry.ts';
import { installPlayerCombatInputSystem } from './installPlayerCombatInputSystem.ts';
import { installActorDeathStripSystem } from './installActorDeathStripSystem.ts';

const explodeBarrel = (entityId: number, registry: Registry) => {
  const entity = registry.get(entityId);
  if (!entity) return;
  const t = entity.components[COMPONENT_KEYS.transform] as Transform | undefined;
  if (!t) return;

  const radius = 4;
  const radiusSq = radius * radius;
  for (const other of registry.view(COMPONENT_KEYS.health)) {
    if (other.id === entityId) continue;
    const ot = other.components[COMPONENT_KEYS.transform] as Transform | undefined;
    const health = other.components[COMPONENT_KEYS.health] as Health | undefined;
    if (!ot || !health || health.dead) continue;
    const dx = ot.position[0] - t.position[0];
    const dy = ot.position[1] - t.position[1];
    const dz = ot.position[2] - t.position[2];
    if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
    pushCombatEvent({
      kind: 'damageApplied',
      targetId: other.id,
      amount: 60,
      sourceId: entityId,
    });
  }
};

export const installCombatSystems = (
  registry: Registry,
  deps: {
    input: Input;
    device: GpuDevice;
    textures: TextureCache;
    gltfCache: GltfCache;
  },
): void => {
  installPlayerCombatInputSystem(
    registry,
    deps.input,
    deps.device,
    deps.textures,
    deps.gltfCache,
  );
  installProjectileSystem(registry);
  installRightHandAnimationFsmSystem(registry);
  installLeftHandAnimationFsmSystem(registry);
  installCombatFacingSystem(registry);
  installAnimationAimOffsetSystem(registry);
  installAnimationPoseOverlaySystem(registry, { getWeaponDef });
  installCombatResolveSystem(registry, {
    getWeaponDef,
    device: deps.device,
    textures: deps.textures,
    gltfCache: deps.gltfCache,
  });
  installHealthSystem(registry, {
    onDestructible: (hookId, entityId, reg) => {
      if (hookId === 'explosiveBarrel') explodeBarrel(entityId, reg);
    },
  });
  installFullBodyAnimationSystem(registry);
  installActorDeathStripSystem(registry);
  installHitboxFollowSystem(registry);
};
