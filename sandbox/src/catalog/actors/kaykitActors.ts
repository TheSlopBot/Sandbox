import {
  COMBAT_MECH_GLB,
  COMBAT_MECH_TEX_ALT,
  COMBAT_MECH_TEX_PRIMARY,
  DUMMY_GLB,
  ROBOT_ONE_GLB,
  SPACE_RANGER_BLADE,
  SPACE_RANGER_GLB,
  SPACE_RANGER_HELMET,
  SPACE_RANGER_JETPACK,
} from '../assets/kaykit.ts';
import { type ActorDefinition } from './actorDefinition.ts';
import { buildSimpleActor } from './buildSimpleActor.ts';

export type CombatMechVariant = 'primary' | 'alt';

export const SPACE_RANGER_ACTOR: ActorDefinition = buildSimpleActor(
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

export const ROBOT_ONE_ACTOR: ActorDefinition = buildSimpleActor(
  'robot_one',
  'Robot One',
  ROBOT_ONE_GLB,
  'robot_one',
  {
    tags: ['robot'],
    aiPackage: 'testAi',
  },
);

export const ROBOT_OME_ACTOR: ActorDefinition = buildSimpleActor(
  'robot_ome',
  'Robot Ome',
  ROBOT_ONE_GLB,
  'robot_ome',
  {
    tags: ['robot'],
    aiPackage: 'testAi',
  },
);

export const COMBAT_MECH_PRIMARY_ACTOR: ActorDefinition = buildSimpleActor(
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

export const COMBAT_MECH_ALT_ACTOR: ActorDefinition = buildSimpleActor(
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

export const COMBAT_MECH_ACTORS: Record<CombatMechVariant, ActorDefinition> = {
  primary: COMBAT_MECH_PRIMARY_ACTOR,
  alt: COMBAT_MECH_ALT_ACTOR,
};

export const DUMMY_ACTOR: ActorDefinition = buildSimpleActor(
  'dummy',
  'Dummy',
  DUMMY_GLB,
  'dummy',
  {
    tags: ['dummy'],
    aiPackage: 'testAi',
  },
);

export const KAYKIT_ACTORS: readonly ActorDefinition[] = [
  SPACE_RANGER_ACTOR,
  ROBOT_ONE_ACTOR,
  ROBOT_OME_ACTOR,
  COMBAT_MECH_PRIMARY_ACTOR,
  COMBAT_MECH_ALT_ACTOR,
  DUMMY_ACTOR,
];
