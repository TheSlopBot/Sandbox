import {
  type Registry,
  type TextureCache,
  type GltfCache,
} from 'viberanium';
import { createKaykitMediumDef } from '../character/defs/kaykitMedium.ts';
import { createRobot as createRobotComponent, ROBOT_KEY } from './components/robot.ts';
import { type TestAiOpts } from './components/testAi.ts';
import { spawnTestNpc } from './spawnTestNpc.ts';

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
  spawnTestNpc(registry, gl, textures, gltfCache, createKaykitMediumDef(opts.bodyGlb, opts.materialPrefix), {
    ...opts,
    tagKey: ROBOT_KEY,
    tag: createRobotComponent(),
  });
