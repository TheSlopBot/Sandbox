import {
  type GpuDevice,
  type Registry,
  type TextureCache,
  type GltfCache,
} from 'viberanium';
import { ROBOT_ACTORS, type RobotVariant } from '../../../catalog/actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../../../catalog/actors/actorDefinitionToSkeletalDef.ts';
import { GAME_COMPONENT_KEYS } from '../../../catalog/keys/components.ts';
import { spawnActor } from '../../actor/spawnActor.ts';
import { createRobot as createRobotComponent } from '../components/robot.ts';
import { createTestAi, type TestAiOpts } from '../components/testAi.ts';

export type { RobotVariant };

export type RobotSpawnOpts = TestAiOpts & {
  variant?: RobotVariant;
  y?: number;
};

export const createRobot = async (
  registry: Registry,
  device: GpuDevice,
  textures: TextureCache,
  gltfCache: GltfCache,
  opts: RobotSpawnOpts,
) => {
  const variant = opts.variant ?? 'one';

  return spawnActor(
    registry,
    device,
    textures,
    gltfCache,
    actorDefinitionToSkeletalDef(ROBOT_ACTORS[variant]),
    {
      ...opts,
      extraComponents: {
        [GAME_COMPONENT_KEYS.testAi]: createTestAi(opts),
        [GAME_COMPONENT_KEYS.robot]: createRobotComponent(),
      },
    },
  );
};
