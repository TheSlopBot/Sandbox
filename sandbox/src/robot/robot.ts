import {
  type Registry,
  createTransform,
  createCharacterController,
  createMovementIntent,
  createSkeletalRig,
  type TextureCache,
  type GltfCache,
  COMPONENT_KEYS,
} from 'viberanium';
import { assembleSkeletalCharacter, type CharacterAnimAssets } from '../character/assembleCharacter.ts';
import { createRobotAi, ROBOT_AI_KEY, type RobotAiOpts } from './components/robotAi.ts';

export type RobotSpawnOpts = RobotAiOpts & {
  bodyGlb: string;
  materialPrefix: string;
  y?: number;
};

export const createRobot = async (
  registry: Registry,
  gl: WebGL2RenderingContext,
  textures: TextureCache,
  gltfCache: GltfCache,
  animAssets: Pick<CharacterAnimAssets, 'animGeneralGlb' | 'animMovementGlb'>,
  opts: RobotSpawnOpts,
) => {
  const charT = createTransform();
  charT.position[0] = opts.x;
  charT.position[1] = opts.y ?? 1.6;
  charT.position[2] = opts.z;
  charT.dirty = true;

  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.transform] = charT;
  entity.components[COMPONENT_KEYS.character] = createCharacterController();
  entity.components[COMPONENT_KEYS.movementIntent] = createMovementIntent();
  entity.components[ROBOT_AI_KEY] = createRobotAi(opts);

  const { bodyScene, characterParts, renderEntityIds, clips } = await assembleSkeletalCharacter(
    registry, gl, textures, gltfCache, charT,
    { bodyGlb: opts.bodyGlb, ...animAssets, materialPrefix: opts.materialPrefix },
  );

  const cc = entity.components[COMPONENT_KEYS.character] as ReturnType<typeof createCharacterController>;
  cc.jumpStartDuration = clips.jumpStart.duration;
  cc.jumpLandDuration = clips.jumpLand.duration;
  cc.moveSpeed = 3.8;

  entity.components[COMPONENT_KEYS.skeletalRig] = createSkeletalRig(
    bodyScene, characterParts, renderEntityIds, clips,
  );

  return { entity };
};
