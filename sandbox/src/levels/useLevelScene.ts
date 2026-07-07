import { type Registry, type Scene } from 'viberanium';
import { createPlayableScene, type SceneDeps } from '../scenes/playableScene.ts';
import { createRobot } from '../robot/robot.ts';
import { ANIM_GENERAL_GLB, ANIM_MOVEMENT_GLB } from './assets.ts';
import { type LevelDefinition } from './catalog.ts';

export const useLevelScene = (deps: SceneDeps, definition: LevelDefinition): Scene => {
  const spawnProps = async (addProp: (url: string, prefix: string, opts?: { x?: number; y?: number; z?: number; scale?: number; yaw?: number }) => Promise<void>) => {
    for (const prop of definition.props) {
      await addProp(prop.url, prop.prefix, prop.opts);
    }
  };

  const spawnNpcs = definition.robots?.length
    ? async (registry: Registry, sceneDeps: SceneDeps) => {
        const anim = { animGeneralGlb: ANIM_GENERAL_GLB, animMovementGlb: ANIM_MOVEMENT_GLB };

        for (const robot of definition.robots!) {
          const { entity } = await createRobot(registry, sceneDeps.gl, sceneDeps.textures, sceneDeps.gltfCache, anim, robot);
          registry.register(entity);
        }
      }
    : undefined;

  return createPlayableScene(deps, definition.navGrid, spawnProps, spawnNpcs);
};
