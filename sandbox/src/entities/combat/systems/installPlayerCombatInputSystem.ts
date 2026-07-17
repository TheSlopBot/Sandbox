import {
  type Registry,
  type Input,
  type GpuDevice,
  type TextureCache,
  type GltfCache,
  type CameraFollow,
  type CombatIntent,
  type EquipmentSlots,
  clearCombatIntentEdges,
  COMPONENT_KEYS,
} from 'viberanium';
import { GAME_COMPONENT_KEYS } from '../../../catalog/keys/components.ts';
import { getWeaponDef } from '../../../catalog/weapons/registry.ts';
import { equipWeapon, stowRightWeapon } from '../equipWeapon.ts';

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
    }
  }, 5);
};
