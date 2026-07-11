import {
  type Registry,
  type TextureCache,
  type GltfCache,
} from 'viberanium';
import { DUMMY_ACTORS, type DummyVariant } from '../../../catalog/actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../../../catalog/actors/actorDefinitionToSkeletalDef.ts';
import { GAME_COMPONENT_KEYS } from '../../../catalog/keys/components.ts';
import { spawnActor } from '../../actor/spawnActor.ts';
import { createDummy as createDummyComponent } from '../components/dummy.ts';
import { createTestAi, type TestAiOpts } from '../components/testAi.ts';

export type { DummyVariant };

export type DummySpawnOpts = TestAiOpts & {
  variant?: DummyVariant;
  y?: number;
};

export const createDummyNpc = async (
  registry: Registry,
  gl: WebGL2RenderingContext,
  textures: TextureCache,
  gltfCache: GltfCache,
  opts: DummySpawnOpts,
) => {
  const variant = opts.variant ?? 'primary';

  return spawnActor(
    registry,
    gl,
    textures,
    gltfCache,
    actorDefinitionToSkeletalDef(DUMMY_ACTORS[variant]),
    {
      ...opts,
      extraComponents: {
        [GAME_COMPONENT_KEYS.testAi]: createTestAi(opts),
        [GAME_COMPONENT_KEYS.dummy]: createDummyComponent(variant),
      },
    },
  );
};
