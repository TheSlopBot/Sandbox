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
import { loadSkeletalCharacter } from '../character/loadSkeletalCharacter.ts';
import { spawnSkeletalCharacter } from '../character/spawnSkeletalCharacter.ts';
import { SPACE_RANGER_DEF } from '../character/defs/spaceRanger.ts';
import { PLAYER_CONTROLLER_KEY, createPlayerController } from './components/playerController.ts';
import { PLAYER_HELMET_KEY } from './components/playerHelmet.ts';
import { PLAYER_JETPACK_KEY } from './components/playerJetpack.ts';
import { PLAYER_BLADE_KEY } from './components/playerBlade.ts';

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
  entity.components[PLAYER_CONTROLLER_KEY] = createPlayerController();

  const loaded = await loadSkeletalCharacter({ gl, textures, gltfCache }, SPACE_RANGER_DEF);

  spawnSkeletalCharacter(registry, entity, loaded, {
    gl,
    attachmentTags: {
      helmet: PLAYER_HELMET_KEY,
      jetpack: PLAYER_JETPACK_KEY,
      blade: PLAYER_BLADE_KEY,
    },
  });

  registry.register(entity);

  const pc = entity.components[PLAYER_CONTROLLER_KEY] as ReturnType<typeof createPlayerController>;
  const children = entity.components[COMPONENT_KEYS.children] as { ids: number[] };

  for (const childId of children.ids) {
    const child = registry.get(childId);
    if (!child) continue;

    if (child.components[PLAYER_HELMET_KEY]) pc.helmetEntityId = childId;
  }

  pc.stowedHelmet = loaded.attachments.find((attachment) => attachment.id === 'helmet') ?? null;

  return { entity };
};
