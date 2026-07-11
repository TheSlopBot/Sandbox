import {
  type GpuDevice,
  type Registry,
  type TextureCache,
  type GltfCache,
} from 'viberanium';
import { COMBAT_MECH_ACTORS, type CombatMechVariant } from '../../../catalog/actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../../../catalog/actors/actorDefinitionToSkeletalDef.ts';
import { GAME_COMPONENT_KEYS } from '../../../catalog/keys/components.ts';
import { spawnActor } from '../../actor/spawnActor.ts';
import { createCombatMech as createCombatMechComponent } from '../components/combatMech.ts';
import { createTestAi, type TestAiOpts } from '../components/testAi.ts';

export type { CombatMechVariant };

export type CombatMechSpawnOpts = TestAiOpts & {
  variant?: CombatMechVariant;
  y?: number;
};

export const createCombatMech = async (
  registry: Registry,
  device: GpuDevice,
  textures: TextureCache,
  gltfCache: GltfCache,
  opts: CombatMechSpawnOpts,
) => {
  const variant = opts.variant ?? 'primary';

  return spawnActor(
    registry,
    device,
    textures,
    gltfCache,
    actorDefinitionToSkeletalDef(COMBAT_MECH_ACTORS[variant]),
    {
      ...opts,
      extraComponents: {
        [GAME_COMPONENT_KEYS.testAi]: createTestAi(opts),
        [GAME_COMPONENT_KEYS.combatMech]: createCombatMechComponent(variant),
      },
    },
  );
};
