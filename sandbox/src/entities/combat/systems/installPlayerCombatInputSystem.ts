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
    let camPitch = 0;
    for (const e of registry.view(COMPONENT_KEYS.cameraFollow)) {
      const cam = e.components[COMPONENT_KEYS.cameraFollow] as CameraFollow;
      camYaw = cam.yawRad;
      camPitch = cam.pitchRad;
      break;
    }

    for (const e of registry.view(GAME_COMPONENT_KEYS.playerController)) {
      const intent = e.components[COMPONENT_KEYS.combatIntent] as CombatIntent | undefined;
      const slots = e.components[COMPONENT_KEYS.equipmentSlots] as EquipmentSlots | undefined;
      if (!intent || !slots) continue;

      clearCombatIntentEdges(intent);
      intent.aimYawRad = camYaw + Math.PI;
      intent.aimPitchRad = camPitch;
      intent.aimHeld = input.mouseDown(2);
      intent.attackPressed = input.mousePressed(0);
      intent.equipMeleePressed = input.pressed('Digit1');
      intent.equipRangedPressed = input.pressed('Digit2');
      intent.toggleShieldPressed = false;
      intent.stowRightPressed = input.pressed('KeyZ');

      if (intent.equipMeleePressed) {
        const blade = getWeaponDef('ranger_blade');
        if (blade) void equipWeapon(registry, device, textures, gltfCache, e, blade);
      }

      if (intent.equipRangedPressed) {
        const pistol = getWeaponDef('space_ranger_pistol');
        if (pistol) void equipWeapon(registry, device, textures, gltfCache, e, pistol);
      }

      if (intent.stowRightPressed) stowRightWeapon(registry, e);
    }
  }, 5);
};
