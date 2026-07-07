import {
  type Registry,
  createTransform,
  createCharacterController,
  createCameraFollow,
  createMovementIntent,
  createSkeletalRig,
  TextureCache,
  COMPONENT_KEYS,
} from 'viberanium';
import { assembleSkeletalCharacter, type CharacterAnimAssets } from '../character/assembleCharacter.ts';
import { PLAYER_CONTROLLER_KEY, createPlayerController } from './components/playerController.ts';

export type PlayerAssets = CharacterAnimAssets;

export const createPlayer = async (
  registry: Registry,
  gl: WebGL2RenderingContext,
  textures: TextureCache,
  assets: PlayerAssets,
) => {
  const charT = createTransform();
  charT.position[1] = 1.6;
  charT.dirty = true;

  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.transform] = charT;
  entity.components[COMPONENT_KEYS.character] = createCharacterController();
  entity.components[COMPONENT_KEYS.movementIntent] = createMovementIntent();
  entity.components[PLAYER_CONTROLLER_KEY] = createPlayerController();
  entity.components[COMPONENT_KEYS.cameraFollow] = createCameraFollow();

  const { bodyScene, characterParts, renderEntityIds, clips } = await assembleSkeletalCharacter(
    registry, gl, textures, charT, assets,
  );

  const cc = entity.components[COMPONENT_KEYS.character] as ReturnType<typeof createCharacterController>;
  cc.jumpStartDuration = clips.jumpStart.duration;
  cc.jumpLandDuration = clips.jumpLand.duration;

  entity.components[COMPONENT_KEYS.skeletalRig] = createSkeletalRig(
    bodyScene, characterParts, renderEntityIds, clips,
  );

  return { entity };
};
