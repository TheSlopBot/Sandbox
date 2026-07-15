import {
  type GpuDevice,
  type Registry,
  createTransform,
  createCharacterController,
  createCameraFollow,
  createMovementIntent,
  attachActorBodyCollider,
  spawnActorColliders,
  type TextureCache,
  type GltfCache,
  COMPONENT_KEYS,
} from 'viberanium';
import { getActorDefinition } from '../../catalog/actors/registry.ts';
import { actorDefinitionToSkeletalDef } from '../../catalog/actors/actorDefinitionToSkeletalDef.ts';
import { GAME_COMPONENT_KEYS } from '../../catalog/keys/components.ts';
import { loadSkeletalCharacter } from '../actor/loadSkeletalCharacter.ts';
import { spawnSkeletalCharacter } from '../actor/spawnSkeletalCharacter.ts';
import { createPlayerController } from './components/playerController.ts';
import { attachCombatActor } from '../combat/attachCombatActor.ts';
import { getWeaponDef } from '../../catalog/weapons/registry.ts';
import { equipWeapon } from '../combat/equipWeapon.ts';

export const createPlayer = async (
  registry: Registry,
  device: GpuDevice,
  textures: TextureCache,
  gltfCache: GltfCache,
  spawn: {
    position: [number, number, number];
    rotation?: [number, number, number, number];
  },
) => {
  const charT = createTransform();
  const position = spawn.position;
  const rotation = spawn.rotation ?? [0, 0, 0, 1];
  charT.position[0] = position[0];
  charT.position[1] = position[1];
  charT.position[2] = position[2];
  const siny = 2 * (rotation[3] * rotation[1] + rotation[0] * rotation[2]);
  const cosy = 1 - 2 * (rotation[1] * rotation[1] + rotation[0] * rotation[0]);
  charT.yaw = Math.atan2(siny, cosy);
  charT.dirty = true;

  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.transform] = charT;
  entity.components[COMPONENT_KEYS.character] = createCharacterController();
  entity.components[COMPONENT_KEYS.movementIntent] = createMovementIntent();
  entity.components[COMPONENT_KEYS.cameraFollow] = createCameraFollow();
  entity.components[GAME_COMPONENT_KEYS.playerController] = createPlayerController();

  const playerActor = getActorDefinition('space_ranger');

  const loaded = await loadSkeletalCharacter(
    { device, textures, gltfCache },
    actorDefinitionToSkeletalDef(playerActor),
  );

  const attachmentEntityIds = spawnSkeletalCharacter(registry, entity, loaded, { device });
  attachActorBodyCollider(entity, playerActor.colliders);
  spawnActorColliders(registry, entity, playerActor.colliders, {
    attachmentEntityIds,
    attachments: playerActor.attachments,
  });
  attachCombatActor(entity, playerActor);

  registry.register(entity);

  const blade = getWeaponDef('ranger_blade');
  if (blade) await equipWeapon(registry, device, textures, gltfCache, entity, blade);

  return { entity };
};
