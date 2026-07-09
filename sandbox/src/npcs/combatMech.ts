import {
  type Registry,
  type TextureCache,
  type GltfCache,
} from 'viberanium';
import { createCombatMechDef, type CombatMechVariant } from '../character/defs/combatMech.ts';
import { createCombatMech as createCombatMechComponent, COMBAT_MECH_KEY } from './components/combatMech.ts';
import { type TestAiOpts } from './components/testAi.ts';
import { spawnTestNpc } from './spawnTestNpc.ts';

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

  return spawnTestNpc(registry, gl, textures, gltfCache, createCombatMechDef(variant), {
    ...opts,
    tagKey: COMBAT_MECH_KEY,
    tag: createCombatMechComponent(variant),
  });
};
