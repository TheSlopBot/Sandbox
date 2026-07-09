import {
  type Registry,
  type TextureCache,
  type GltfCache,
} from 'viberanium';
import { COMBAT_MECH_DEFS, type CombatMechVariant } from '../../../catalog/characters/combatMech.ts';
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
  gl: WebGL2RenderingContext,
  textures: TextureCache,
  gltfCache: GltfCache,
  opts: CombatMechSpawnOpts,
) => {
  const variant = opts.variant ?? 'primary';

  return spawnActor(registry, gl, textures, gltfCache, COMBAT_MECH_DEFS[variant], {
    ...opts,
    extraComponents: {
      [GAME_COMPONENT_KEYS.testAi]: createTestAi(opts),
      [GAME_COMPONENT_KEYS.combatMech]: createCombatMechComponent(variant),
    },
  });
};
