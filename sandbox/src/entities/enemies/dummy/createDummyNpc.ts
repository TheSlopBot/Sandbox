import {
  type GpuDevice,
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
  y: number;
};

export const createDummyNpc = async (
  registry: Registry,
  device: GpuDevice,
  textures: TextureCache,
  gltfCache: GltfCache,
  opts: DummySpawnOpts,
) => {
  const variant = opts.variant ?? 'primary';
  const actor = DUMMY_ACTORS[variant];

  return spawnActor(
    registry,
    device,
    textures,
    gltfCache,
    actorDefinitionToSkeletalDef(actor),
    {
      x: opts.x,
      y: opts.y,
      z: opts.z,
      colliders: actor.colliders,
      combatActor: actor,
      extraComponents: {
        [GAME_COMPONENT_KEYS.testAi]: createTestAi(opts),
        [GAME_COMPONENT_KEYS.dummy]: createDummyComponent(variant),
      },
    },
  );
};
