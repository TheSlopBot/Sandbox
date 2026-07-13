import {
  type GpuDevice,
  type Registry,
  createTransform,
  createCharacterController,
  createCameraFollow,
  createMovementIntent,
  attachActorBodyCollider,
  type TextureCache,
  type GltfCache,
  COMPONENT_KEYS,
} from 'viberanium';
import { SPACE_RANGER_ACTOR } from '../../catalog/actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../../catalog/actors/actorDefinitionToSkeletalDef.ts';
import { GAME_COMPONENT_KEYS } from '../../catalog/keys/components.ts';
import { PLAYER_ATTACHMENT_TAGS } from '../../catalog/keys/attachments.ts';
import { loadSkeletalCharacter } from '../actor/loadSkeletalCharacter.ts';
import { spawnSkeletalCharacter } from '../actor/spawnSkeletalCharacter.ts';
import { createPlayerController } from './components/playerController.ts';

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

  const loaded = await loadSkeletalCharacter(
    { device, textures, gltfCache },
    actorDefinitionToSkeletalDef(SPACE_RANGER_ACTOR),
  );

  spawnSkeletalCharacter(registry, entity, loaded, {
    device,
    attachmentTags: PLAYER_ATTACHMENT_TAGS,
  });

  attachActorBodyCollider(entity, SPACE_RANGER_ACTOR.colliders);

  registry.register(entity);

  const pc = entity.components[GAME_COMPONENT_KEYS.playerController] as ReturnType<typeof createPlayerController>;
  const children = entity.components[COMPONENT_KEYS.children] as { ids: number[] };

  for (const childId of children.ids) {
    const child = registry.get(childId);
    if (!child) continue;

    if (child.components[GAME_COMPONENT_KEYS.playerHelmet]) pc.helmetEntityId = childId;
  }

  pc.stowedHelmet = loaded.attachments.find((attachment) => attachment.id === 'helmet') ?? null;

  return { entity };
};
