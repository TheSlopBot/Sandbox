import {
  type Registry,
  type TextureCache,
  type GltfCache,
} from 'viberanium';
import { DUMMY_ACTOR } from '../../../catalog/actors/kaykitActors.ts';
import { actorDefinitionToSkeletalDef } from '../../../catalog/actors/actorDefinitionToSkeletalDef.ts';
import { GAME_COMPONENT_KEYS } from '../../../catalog/keys/components.ts';
import { spawnActor } from '../../actor/spawnActor.ts';
import { createDummy as createDummyComponent } from '../components/dummy.ts';
import { createTestAi, type TestAiOpts } from '../components/testAi.ts';

export type DummySpawnOpts = TestAiOpts & {
  y?: number;
};

export const createDummyNpc = async (
  registry: Registry,
  gl: WebGL2RenderingContext,
  textures: TextureCache,
  gltfCache: GltfCache,
  opts: DummySpawnOpts,
) =>
  spawnActor(
    registry,
    gl,
    textures,
    gltfCache,
    actorDefinitionToSkeletalDef(DUMMY_ACTOR),
    {
      ...opts,
      extraComponents: {
        [GAME_COMPONENT_KEYS.testAi]: createTestAi(opts),
        [GAME_COMPONENT_KEYS.dummy]: createDummyComponent(),
      },
    },
  );
