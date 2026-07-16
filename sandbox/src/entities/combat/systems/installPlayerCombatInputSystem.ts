import {
  type Registry,
  type Input,
  type GpuDevice,
  type TextureCache,
  type GltfCache,
  type CameraFollow,
  type CharacterController,
  type CombatIntent,
  type EquipmentSlots,
  type MovementImpulse,
  type RightHandStateMachine,
  type Weapon,
  addMovementImpulse,
  clearCombatIntentEdges,
  COMPONENT_KEYS,
} from 'viberanium';
import { GAME_COMPONENT_KEYS } from '../../../catalog/keys/components.ts';
import { getWeaponDef } from '../../../catalog/weapons/registry.ts';
import { equipWeapon, stowRightWeapon } from '../equipWeapon.ts';

const MELEE_LUNGE_SPEED_FACTOR = 3;

const readRightWeapon = (registry: Registry, entityId: number | null): Weapon | undefined => {
  if (entityId === null) return undefined;
  const entity = registry.get(entityId);
  return entity?.components[COMPONENT_KEYS.weapon] as Weapon | undefined;
};

export const installPlayerCombatInputSystem = (
  registry: Registry,
  input: Input,
  device: GpuDevice,
  textures: TextureCache,
  gltfCache: GltfCache,
) => {
  registry.addAction('update', () => {
    let camYaw = 0;
    for (const e of registry.view(COMPONENT_KEYS.cameraFollow)) {
      camYaw = (e.components[COMPONENT_KEYS.cameraFollow] as CameraFollow).yawRad;
      break;
    }
    const sinY = Math.sin(camYaw);
    const cosY = Math.cos(camYaw);

    for (const e of registry.view(GAME_COMPONENT_KEYS.playerController)) {
      const intent = e.components[COMPONENT_KEYS.combatIntent] as CombatIntent | undefined;
      const slots = e.components[COMPONENT_KEYS.equipmentSlots] as EquipmentSlots | undefined;
      if (!intent || !slots) continue;

      clearCombatIntentEdges(intent);
      intent.aimYawRad = camYaw + Math.PI;
      intent.aimHeld = input.mouseDown(2);
      intent.attackPressed = input.mousePressed(0);
      intent.releasePressed = input.pressed('KeyR');
      intent.equipMeleePressed = input.pressed('Digit1');
      intent.equipRangedPressed = false;
      intent.toggleShieldPressed = false;
      intent.stowRightPressed = input.pressed('KeyZ');

      if (intent.equipMeleePressed) {
        const blade = getWeaponDef('ranger_blade');
        if (blade) void equipWeapon(registry, device, textures, gltfCache, e, blade);
      }

      if (intent.stowRightPressed) stowRightWeapon(registry, e);

      if (!intent.attackPressed) continue;

      const rightWeapon = readRightWeapon(registry, slots.right.entityId);
      const rightFsm = e.components[COMPONENT_KEYS.rightHandStateMachine] as
        | RightHandStateMachine
        | undefined;
      const impulse = e.components[COMPONENT_KEYS.movementImpulse] as MovementImpulse | undefined;
      const cc = e.components[COMPONENT_KEYS.character] as CharacterController | undefined;
      if (!rightWeapon || rightWeapon.kind !== 'melee' || !impulse || !cc) continue;
      if (rightFsm?.current === 'attack' || rightFsm?.current === 'reload') continue;

      const speed = cc.moveSpeed * MELEE_LUNGE_SPEED_FACTOR;
      addMovementImpulse(impulse, -sinY * speed, 0, -cosY * speed);
    }
  }, 5);
};
