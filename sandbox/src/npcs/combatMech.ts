import {
  type Registry,
  createTransform,
  createCharacterController,
  createMovementIntent,
  type TextureCache,
  type GltfCache,
  COMPONENT_KEYS,
} from 'viberanium';
import { loadSkeletalCharacter } from '../character/loadSkeletalCharacter.ts';
import { spawnSkeletalCharacter } from '../character/spawnSkeletalCharacter.ts';
import { createKaykitMediumDef } from '../character/defs/kaykitMedium.ts';
import { createTestAi, TEST_AI_KEY, type TestAiOpts } from './components/testAi.ts';
import {
  COMBAT_MECH_GLB,
  COMBAT_MECH_TEX_ALT,
  COMBAT_MECH_TEX_PRIMARY,
} from '../levels/assets.ts';

export type CombatMechVariant = 'primary' | 'alt';

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
  const charT = createTransform();
  charT.position[0] = opts.x;
  charT.position[1] = opts.y ?? 1.6;
  charT.position[2] = opts.z;
  charT.dirty = true;

  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.transform] = charT;
  entity.components[COMPONENT_KEYS.character] = createCharacterController();
  entity.components[COMPONENT_KEYS.movementIntent] = createMovementIntent();
  entity.components[TEST_AI_KEY] = createTestAi(opts);

  const variant = opts.variant ?? 'primary';
  const def = createKaykitMediumDef(
    COMBAT_MECH_GLB,
    variant === 'alt' ? 'combat_mech_alt' : 'combat_mech_primary',
    { baseColorTextureUrl: variant === 'alt' ? COMBAT_MECH_TEX_ALT : COMBAT_MECH_TEX_PRIMARY },
  );
  const loaded = await loadSkeletalCharacter({ gl, textures, gltfCache }, def);

  spawnSkeletalCharacter(registry, entity, loaded, { gl });

  const cc = entity.components[COMPONENT_KEYS.character] as ReturnType<typeof createCharacterController>;
  cc.moveSpeed = 3.8;

  registry.register(entity);

  return { entity };
};
