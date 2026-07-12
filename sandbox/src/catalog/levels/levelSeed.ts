import {
  type LevelDefinition,
  DEFAULT_LEVEL_PLAYER_SPAWN,
} from './levelDefinition.ts';
import { type LevelAiPackage } from './levelFile.ts';

export type LevelBuild = {
  definition: LevelDefinition;
  aiPackages: Record<string, LevelAiPackage>;
};

export type LevelSeedPropInstance = LevelDefinition['composition']['props'][number] & {
  name: string;
  groupId: null;
};

export type LevelSeedActorInstance = LevelDefinition['composition']['actors'][number] & {
  name: string;
  aiPackage: LevelAiPackage;
  groupId: null;
};

export type LevelSeedColliderInstance = LevelDefinition['composition']['colliders'][number] & {
  name: string;
  groupId: null;
};

export type LevelSeedDocument = {
  version: 1;
  id: string;
  displayName: string;
  navGrid: LevelDefinition['navGrid'];
  index: LevelDefinition['index'];
  composition: {
    props: LevelSeedPropInstance[];
    actors: LevelSeedActorInstance[];
    colliders: LevelSeedColliderInstance[];
  };
  playerSpawn: LevelDefinition['playerSpawn'];
  groups: [];
};

export const buildLevelSeedDocument = (build: LevelBuild): LevelSeedDocument => {
  const { definition, aiPackages } = build;

  return {
    version: 1,
    id: definition.id,
    displayName: definition.displayName,
    navGrid: { ...definition.navGrid },
    index: definition.index,
    composition: {
      props: definition.composition.props.map((instance) => ({
        ...instance,
        name: instance.id,
        groupId: null,
      })),
      actors: definition.composition.actors.map((instance) => ({
        ...instance,
        name: instance.id,
        aiPackage: aiPackages[instance.id] ?? 'none',
        groupId: null,
      })),
      colliders: definition.composition.colliders.map((instance) => ({
        ...instance,
        name: instance.id,
        groupId: null,
      })),
    },
    playerSpawn: {
      position: [...(definition.playerSpawn?.position ?? DEFAULT_LEVEL_PLAYER_SPAWN.position)] as [
        number,
        number,
        number,
      ],
      rotation: [...(definition.playerSpawn?.rotation ?? DEFAULT_LEVEL_PLAYER_SPAWN.rotation)] as [
        number,
        number,
        number,
        number,
      ],
    },
    groups: [],
  };
};
