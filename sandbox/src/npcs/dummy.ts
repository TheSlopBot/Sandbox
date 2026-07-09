import {
  type Registry,
  type TextureCache,
  type GltfCache,
} from 'viberanium';
import { DUMMY_DEF } from '../character/defs/dummy.ts';
import { createDummy as createDummyComponent, DUMMY_KEY } from './components/dummy.ts';
import { type TestAiOpts } from './components/testAi.ts';
import { spawnTestNpc } from './spawnTestNpc.ts';

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
  spawnTestNpc(registry, gl, textures, gltfCache, DUMMY_DEF, {
    ...opts,
    tagKey: DUMMY_KEY,
    tag: createDummyComponent(),
  });
