import {
  type GpuDevice,
  type Registry,
  type TextureCache,
  type GltfCache,
} from 'viberanium';
import { ROBOT_ONE_ACTOR } from '../../../catalog/actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../../../catalog/actors/actorDefinitionToSkeletalDef.ts';
import { GAME_COMPONENT_KEYS } from '../../../catalog/keys/components.ts';
import { spawnActor } from '../../actor/spawnActor.ts';
import { createRobot as createRobotComponent } from '../components/robot.ts';
import { createTestAi, type TestAiOpts } from '../components/testAi.ts';

export type RobotSpawnOpts = TestAiOpts & {
  y: number;
};

export const createRobot = async (
  registry: Registry,
  device: GpuDevice,
  textures: TextureCache,
  gltfCache: GltfCache,
  opts: RobotSpawnOpts,
) => {
  return spawnActor(
    registry,
    device,
    textures,
    gltfCache,
    actorDefinitionToSkeletalDef(ROBOT_ONE_ACTOR),
    {
      x: opts.x,
      y: opts.y,
      z: opts.z,
      colliders: ROBOT_ONE_ACTOR.colliders,
      combatActor: ROBOT_ONE_ACTOR,
      extraComponents: {
        [GAME_COMPONENT_KEYS.testAi]: createTestAi(opts),
        [GAME_COMPONENT_KEYS.robot]: createRobotComponent(),
      },
    },
  );
};
