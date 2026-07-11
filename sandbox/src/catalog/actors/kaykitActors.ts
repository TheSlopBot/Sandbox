import {
  COMBAT_MECH_GLB,
  COMBAT_MECH_TEX_ALT,
  COMBAT_MECH_TEX_PRIMARY,
  DUMMY_GLB,
  DUMMY_TEX_ALT_A,
  DUMMY_TEX_ALT_B,
  DUMMY_TEX_ALT_C,
  DUMMY_TEX_PRIMARY,
  ROBOT_ONE_GLB,
  SPACE_RANGER_BLADE,
  SPACE_RANGER_GLB,
  SPACE_RANGER_HELMET,
  SPACE_RANGER_JETPACK,
} from '../assets/kaykit.ts';
import { type GameActorDefinition } from './actorDefinition.ts';
import { buildSimpleActor } from './buildSimpleActor.ts';

export type CombatMechVariant = 'primary' | 'alt';
export type DummyVariant = 'primary' | 'altA' | 'altB' | 'altC';

export const SPACE_RANGER_ACTOR: GameActorDefinition = buildSimpleActor(
  'space_ranger',
  'Space Ranger',
  SPACE_RANGER_GLB,
  'spaceranger_body',
  {
    tags: ['player'],
    aiPackage: 'none',
    attachments: [
      {
        id: 'helmet',
        name: 'Helmet',
        boneName: 'head',
        url: SPACE_RANGER_HELMET,
        materialPrefix: 'spaceranger_helmet',
        position: [0, -0.02555268658183585, 0],
      },
      {
        id: 'jetpack',
        name: 'Jetpack',
        boneName: 'chest',
        url: SPACE_RANGER_JETPACK,
        materialPrefix: 'spaceranger_jetpack',
        position: [0, -0.00195912904760126, -0.3929741382598877],
      },
      {
        id: 'blade',
        name: 'Blade',
        boneName: 'hand.r',
        url: SPACE_RANGER_BLADE,
        materialPrefix: 'spaceranger_blade',
        rotation: [-0.8, 1, 0, 0],
      },
    ],
  },
);

export const ROBOT_ONE_ACTOR: GameActorDefinition = buildSimpleActor(
  'robot_one',
  'Robot One',
  ROBOT_ONE_GLB,
  'robot_one',
  {
    tags: ['robot'],
    aiPackage: 'testAi',
  },
);

export const ROBOT_OME_ACTOR: GameActorDefinition = buildSimpleActor(
  'robot_ome',
  'Robot Ome',
  ROBOT_ONE_GLB,
  'robot_ome',
  {
    tags: ['robot'],
    aiPackage: 'testAi',
  },
);

export const COMBAT_MECH_PRIMARY_ACTOR: GameActorDefinition = buildSimpleActor(
  'combat_mech_primary',
  'Combat Mech Primary',
  COMBAT_MECH_GLB,
  'combat_mech_primary',
  {
    tags: ['combatMech'],
    aiPackage: 'testAi',
    baseColorTextureUrl: COMBAT_MECH_TEX_PRIMARY,
  },
);

export const COMBAT_MECH_ALT_ACTOR: GameActorDefinition = buildSimpleActor(
  'combat_mech_alt',
  'Combat Mech Alt',
  COMBAT_MECH_GLB,
  'combat_mech_alt',
  {
    tags: ['combatMech'],
    aiPackage: 'testAi',
    baseColorTextureUrl: COMBAT_MECH_TEX_ALT,
  },
);

export const COMBAT_MECH_ACTORS: Record<CombatMechVariant, GameActorDefinition> = {
  primary: COMBAT_MECH_PRIMARY_ACTOR,
  alt: COMBAT_MECH_ALT_ACTOR,
};

export const DUMMY_PRIMARY_ACTOR: GameActorDefinition = buildSimpleActor(
  'dummy_primary',
  'Dummy Primary',
  DUMMY_GLB,
  'dummy_primary',
  {
    tags: ['dummy'],
    aiPackage: 'testAi',
    baseColorTextureUrl: DUMMY_TEX_PRIMARY,
  },
);

export const DUMMY_ALT_A_ACTOR: GameActorDefinition = buildSimpleActor(
  'dummy_alt_a',
  'Dummy Alt A',
  DUMMY_GLB,
  'dummy_alt_a',
  {
    tags: ['dummy'],
    aiPackage: 'testAi',
    baseColorTextureUrl: DUMMY_TEX_ALT_A,
  },
);

export const DUMMY_ALT_B_ACTOR: GameActorDefinition = buildSimpleActor(
  'dummy_alt_b',
  'Dummy Alt B',
  DUMMY_GLB,
  'dummy_alt_b',
  {
    tags: ['dummy'],
    aiPackage: 'testAi',
    baseColorTextureUrl: DUMMY_TEX_ALT_B,
  },
);

export const DUMMY_ALT_C_ACTOR: GameActorDefinition = buildSimpleActor(
  'dummy_alt_c',
  'Dummy Alt C',
  DUMMY_GLB,
  'dummy_alt_c',
  {
    tags: ['dummy'],
    aiPackage: 'testAi',
    baseColorTextureUrl: DUMMY_TEX_ALT_C,
  },
);

export const DUMMY_ACTORS: Record<DummyVariant, GameActorDefinition> = {
  primary: DUMMY_PRIMARY_ACTOR,
  altA: DUMMY_ALT_A_ACTOR,
  altB: DUMMY_ALT_B_ACTOR,
  altC: DUMMY_ALT_C_ACTOR,
};

export const DUMMY_ACTOR = DUMMY_PRIMARY_ACTOR;

export const KAYKIT_ACTORS: readonly GameActorDefinition[] = [
  SPACE_RANGER_ACTOR,
  ROBOT_ONE_ACTOR,
  ROBOT_OME_ACTOR,
  COMBAT_MECH_PRIMARY_ACTOR,
  COMBAT_MECH_ALT_ACTOR,
  DUMMY_PRIMARY_ACTOR,
  DUMMY_ALT_A_ACTOR,
  DUMMY_ALT_B_ACTOR,
  DUMMY_ALT_C_ACTOR,
];
