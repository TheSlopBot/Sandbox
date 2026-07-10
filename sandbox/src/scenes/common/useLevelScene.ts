import { type Registry, type Scene } from 'viberanium';
import { type LevelDefinition } from '../../catalog/levels/levelDefinition.ts';
import { createCombatMech } from '../../entities/enemies/combatMech/createCombatMech.ts';
import { createDummyNpc } from '../../entities/enemies/dummy/createDummyNpc.ts';
import { createRobot } from '../../entities/enemies/robot/createRobot.ts';
import { createPlayableScene, type AddProp, type SceneDeps } from './createPlayableScene.ts';

export const useLevelScene = (deps: SceneDeps, definition: LevelDefinition): Scene => {
  const spawnProps = async (addProp: AddProp) => {
    for (const prop of definition.props) {
      await addProp(prop.propId, prop);
    }
  };

  const hasNpcs =
    (definition.robots?.length ?? 0) > 0
    || (definition.combatMechs?.length ?? 0) > 0
    || (definition.dummies?.length ?? 0) > 0;

  const spawnNpcs = hasNpcs
    ? async (registry: Registry, sceneDeps: SceneDeps) => {
        for (const robot of definition.robots ?? []) {
          await createRobot(registry, sceneDeps.gl, sceneDeps.textures, sceneDeps.gltfCache, robot);
        }

        for (const mech of definition.combatMechs ?? []) {
          await createCombatMech(registry, sceneDeps.gl, sceneDeps.textures, sceneDeps.gltfCache, mech);
        }

        for (const dummy of definition.dummies ?? []) {
          await createDummyNpc(registry, sceneDeps.gl, sceneDeps.textures, sceneDeps.gltfCache, dummy);
        }
      }
    : undefined;

  return createPlayableScene(deps, definition.navGrid, spawnProps, spawnNpcs);
};