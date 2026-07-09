import {
  type Registry,
  type TextureCache,
  type GltfCache,
} from 'viberanium';
import { GAME_COMPONENT_KEYS } from '../../../catalog/keys/components.ts';
import { buildKaykitMediumDef } from '../../actor/buildKaykitMediumDef.ts';
import { spawnActor } from '../../actor/spawnActor.ts';
import { createRobot as createRobotComponent } from '../components/robot.ts';
import { createTestAi, type TestAiOpts } from '../components/testAi.ts';

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
) =>
  spawnActor(registry, gl, textures, gltfCache, buildKaykitMediumDef(opts.bodyGlb, opts.materialPrefix), {
    ...opts,
    extraComponents: {
      [GAME_COMPONENT_KEYS.testAi]: createTestAi(opts),
      [GAME_COMPONENT_KEYS.robot]: createRobotComponent(),
    },
  });
