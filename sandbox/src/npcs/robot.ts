import {
  type Registry,
  createTransform,
  createCharacterController,
  createMovementIntent,
  type TextureCache,
  type GltfCache,
  COMPONENT_KEYS,
} from 'viberanium';
import { loadSkeletalCharacter } from '../character/loadSkeletalCharacter.ts';
import { spawnSkeletalCharacter } from '../character/spawnSkeletalCharacter.ts';
import { createKaykitMediumDef } from '../character/defs/kaykitMedium.ts';
import { createTestAi, TEST_AI_KEY, type TestAiOpts } from './components/testAi.ts';

export type RobotSpawnOpts = TestAiOpts & {
  bodyGlb: string;
  materialPrefix: string;
  y?: number;
};

export const createRobot = async (
  registry: Registry,
  gl: WebGL2RenderingContext,
  textures: TextureCache,
  gltfCache: GltfCache,
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
  entity.components[TEST_AI_KEY] = createTestAi(opts);

  const def = createKaykitMediumDef(opts.bodyGlb, opts.materialPrefix);
  const loaded = await loadSkeletalCharacter({ gl, textures, gltfCache }, def);

  spawnSkeletalCharacter(registry, entity, loaded, { gl });

  const cc = entity.components[COMPONENT_KEYS.character] as ReturnType<typeof createCharacterController>;
  cc.moveSpeed = 3.8;

  registry.register(entity);

  return { entity };
};
