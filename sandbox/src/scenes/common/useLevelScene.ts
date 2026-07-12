import { type Registry, type Scene, resolveLevelColliderPropDefinition } from 'viberanium';
import {
  type LevelActorInstance,
  type LevelDefinition,
  resolveLevelActorDefinition,
  resolveLevelPropDefinition,
} from '../../catalog/levels/levelDefinition.ts';
import { type LevelAiPackage } from '../../catalog/levels/levelFile.ts';
import { actorDefinitionToSkeletalDef } from '../../catalog/actors/actorDefinitionToSkeletalDef.ts';
import { GAME_COMPONENT_KEYS } from '../../catalog/keys/components.ts';
import { createTestAi } from '../../entities/enemies/components/testAi.ts';
import { spawnActor } from '../../entities/actor/spawnActor.ts';
import { createPlayableScene, type AddProp, type SceneDeps } from './createPlayableScene.ts';

export const useLevelScene = (
  deps: SceneDeps,
  definition: LevelDefinition,
  aiPackages: Record<string, LevelAiPackage>,
): Scene => {
  const spawnProps = async (addProp: AddProp) => {
    for (const instance of definition.composition.props) {
      const def = resolveLevelPropDefinition(definition, instance);
      if (!def) continue;

      await addProp(def, {
        x: instance.position[0],
        y: instance.position[1],
        z: instance.position[2],
        position: [instance.position[0], instance.position[1], instance.position[2]],
        rotation: instance.rotation,
        scale: instance.scale,
      });
    }

    for (const instance of definition.composition.colliders) {
      const def = resolveLevelColliderPropDefinition(instance);
      await addProp(def, {
        x: instance.position[0],
        y: instance.position[1],
        z: instance.position[2],
        position: [instance.position[0], instance.position[1], instance.position[2]],
        rotation: instance.rotation,
        scale: instance.scale,
      });
    }
  };

  const roam = {
    roamMinX: definition.navGrid.minX,
    roamMaxX: definition.navGrid.maxX,
    roamMinZ: definition.navGrid.minZ,
    roamMaxZ: definition.navGrid.maxZ,
  };

  const spawnActorInstance = async (registry: Registry, sceneDeps: SceneDeps, instance: LevelActorInstance) => {
    const actorDef = resolveLevelActorDefinition(definition, instance);
    if (!actorDef) return;

    const aiPackage = aiPackages[instance.id] ?? 'none';
    const extraComponents =
      aiPackage === 'testAi'
        ? {
            [GAME_COMPONENT_KEYS.testAi]: createTestAi({
              x: instance.position[0],
              z: instance.position[2],
              ...roam,
            }),
          }
        : undefined;

    await spawnActor(registry, sceneDeps.device, sceneDeps.textures, sceneDeps.gltfCache, actorDefinitionToSkeletalDef(actorDef), {
      x: instance.position[0],
      y: instance.position[1],
      z: instance.position[2],
      extraComponents,
    });
  };

  const hasNpcs = definition.composition.actors.length > 0;

  const spawnNpcs = hasNpcs
    ? async (registry: Registry, sceneDeps: SceneDeps) => {
        for (const instance of definition.composition.actors) {
          await spawnActorInstance(registry, sceneDeps, instance);
        }
      }
    : undefined;

  return createPlayableScene(deps, definition.navGrid, spawnProps, spawnNpcs, definition.playerSpawn);
};
