import { type Registry } from '../../engine/registry.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { type CombatIntent } from '../../components/combatIntent.ts';
import { type EquipmentSlots } from '../../components/equipmentSlots.ts';
import { type Weapon } from '../../components/weapon.ts';
import {
  createRightHandStateMachine,
  stepRightHandFsm,
  handCapsForWeaponKind,
  type RightHandStateMachine,
} from '../../components/rightHandStateMachine.ts';
import {
  createLeftHandStateMachine,
  stepLeftHandFsm,
  type LeftHandStateMachine,
} from '../../components/leftHandStateMachine.ts';

export const installRightHandAnimationFsmSystem = (registry: Registry) => {
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.equipmentSlots)) {
      const slots = e.components[COMPONENT_KEYS.equipmentSlots] as EquipmentSlots;
      let fsm = e.components[COMPONENT_KEYS.rightHandStateMachine] as
        | RightHandStateMachine
        | undefined;
      if (!fsm) {
        fsm = createRightHandStateMachine();
        e.components[COMPONENT_KEYS.rightHandStateMachine] = fsm;
      }

      const intent = e.components[COMPONENT_KEYS.combatIntent] as CombatIntent | undefined;
      const weaponEntityId = slots.right.entityId;
      let weapon: Weapon | undefined;
      if (weaponEntityId !== null) {
        const weaponEntity = registry.get(weaponEntityId);
        weapon = weaponEntity?.components[COMPONENT_KEYS.weapon] as Weapon | undefined;
      }

      stepRightHandFsm(fsm, ctx.dt, {
        hasWeapon: !!weapon && weapon.kind !== 'shield',
        attackPressed: intent?.attackPressed ?? false,
        aimHeld: intent?.aimHeld ?? false,
        caps: handCapsForWeaponKind(weapon?.kind),
        attackSpeed: weapon?.attackSpeed,
      });
    }
  }, 11);
};

export const installLeftHandAnimationFsmSystem = (registry: Registry) => {
  registry.addAction('update', (ctx) => {
    for (const e of registry.view(COMPONENT_KEYS.equipmentSlots)) {
      const slots = e.components[COMPONENT_KEYS.equipmentSlots] as EquipmentSlots;
      let fsm = e.components[COMPONENT_KEYS.leftHandStateMachine] as
        | LeftHandStateMachine
        | undefined;
      if (!fsm) {
        fsm = createLeftHandStateMachine();
        e.components[COMPONENT_KEYS.leftHandStateMachine] = fsm;
      }

      const intent = e.components[COMPONENT_KEYS.combatIntent] as CombatIntent | undefined;
      const weaponEntityId = slots.left.entityId;
      let hasShield = false;
      if (weaponEntityId !== null) {
        const weaponEntity = registry.get(weaponEntityId);
        const weapon = weaponEntity?.components[COMPONENT_KEYS.weapon] as Weapon | undefined;
        hasShield = weapon?.kind === 'shield';
      }

      stepLeftHandFsm(fsm, ctx.dt, {
        hasShield,
        blockHeld: (intent?.aimHeld ?? false) && hasShield,
      });
    }
  }, 11);
};
