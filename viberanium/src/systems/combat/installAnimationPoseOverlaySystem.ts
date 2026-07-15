import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type EquipmentSlots } from '../../components/equipmentSlots.ts';
import { type Weapon } from '../../components/weapon.ts';
import {
  createAnimationPoseOverlay,
  type AnimationPoseOverlay,
} from '../../components/animationPoseOverlay.ts';
import { type RightHandStateMachine } from '../../components/rightHandStateMachine.ts';
import { type WeaponDefinition } from '../../definitions/weapons/weaponDefinition.ts';
import {
  DEFAULT_MELEE_TORSO_YAW_CURVE,
  sampleMeleeTorsoYaw,
  type MeleeTorsoYawCurve,
} from '../../combat/meleeTorsoYawCurve.ts';

export type AnimationPoseOverlayDeps = {
  getWeaponDef: (id: string) => WeaponDefinition | undefined | null;
};

const smoothToward = (current: number, target: number, rate: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

const readRightWeapon = (registry: Registry, slots: EquipmentSlots): Weapon | undefined => {
  if (slots.right.entityId === null) return undefined;
  const weaponEntity = registry.get(slots.right.entityId);
  return weaponEntity?.components[COMPONENT_KEYS.weapon] as Weapon | undefined;
};

const curveForWeapon = (
  weapon: Weapon,
  getWeaponDef: AnimationPoseOverlayDeps['getWeaponDef'],
): MeleeTorsoYawCurve => {
  const def = getWeaponDef(weapon.defId);
  return def?.torsoYawCurve ?? DEFAULT_MELEE_TORSO_YAW_CURVE;
};

export const installAnimationPoseOverlaySystem = (
  registry: Registry,
  deps: AnimationPoseOverlayDeps,
) => {
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.equipmentSlots)) {
      const slots = e.components[COMPONENT_KEYS.equipmentSlots] as EquipmentSlots;
      let overlay = e.components[COMPONENT_KEYS.animationPoseOverlay] as
        | AnimationPoseOverlay
        | undefined;
      if (!overlay) {
        overlay = createAnimationPoseOverlay();
        e.components[COMPONENT_KEYS.animationPoseOverlay] = overlay;
      }

      const right = e.components[COMPONENT_KEYS.rightHandStateMachine] as
        | RightHandStateMachine
        | undefined;
      const weapon = readRightWeapon(registry, slots);
      const meleeAttacking = right?.current === 'attack' && weapon?.kind === 'melee';

      if (meleeAttacking && right && weapon) {
        const duration = Math.max(1e-4, right.attackDuration);
        const spineYaw = sampleMeleeTorsoYaw(
          right.stateTime / duration,
          curveForWeapon(weapon, deps.getWeaponDef),
        );
        overlay.spineYawRad = spineYaw;
        overlay.headYawRad = -spineYaw;
        continue;
      }

      overlay.spineYawRad = smoothToward(overlay.spineYawRad, 0, 14, ctx.dt);
      overlay.headYawRad = smoothToward(overlay.headYawRad, 0, 14, ctx.dt);
    }
  }, 11);
};
