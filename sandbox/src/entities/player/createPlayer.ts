import {
  type Registry,
  createTransform,
  createCharacterController,
  createCameraFollow,
  createMovementIntent,
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
  gl: WebGL2RenderingContext,
  textures: TextureCache,
  gltfCache: GltfCache,
) => {
  const charT = createTransform();
  charT.position[1] = 1.6;
  charT.dirty = true;

  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.transform] = charT;
  entity.components[COMPONENT_KEYS.character] = createCharacterController();
  entity.components[COMPONENT_KEYS.movementIntent] = createMovementIntent();
  entity.components[COMPONENT_KEYS.cameraFollow] = createCameraFollow();
  entity.components[GAME_COMPONENT_KEYS.playerController] = createPlayerController();

  const loaded = await loadSkeletalCharacter(
    { gl, textures, gltfCache },
    actorDefinitionToSkeletalDef(SPACE_RANGER_ACTOR),
  );

  spawnSkeletalCharacter(registry, entity, loaded, {
    gl,
    attachmentTags: PLAYER_ATTACHMENT_TAGS,
  });

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
