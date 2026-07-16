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
} from '../assets/kaykit.ts';
import { type GameActorDefinition } from './actorDefinition.ts';
import { buildSimpleActor, type SimpleActorAttachment } from './buildSimpleActor.ts';

export type CombatMechVariant = 'primary' | 'alt';
export type DummyVariant = 'primary' | 'altA' | 'altB' | 'altC';

const HAND_SLOT_PLACEHOLDERS: SimpleActorAttachment[] = [
  {
    id: 'rightHandSlot',
    name: 'Right Hand Slot',
    boneName: 'hand.r',
    url: SPACE_RANGER_BLADE,
    materialPrefix: 'spaceranger_blade',
    tags: ['slot:rightHand'],
    placeholder: true,
    position: [0, 0.1, 0],
    rotation: [-0.7071067690849304, 0.7071067690849304, 0, 0],
    scale: [1, 1, 1],
  },
  {
    id: 'leftHandSlot',
    name: 'Left Hand Slot',
    boneName: 'hand.l',
    url: SPACE_RANGER_BLADE,
    materialPrefix: 'spaceranger_blade',
    tags: ['slot:leftHand'],
    placeholder: true,
    position: [0, 0.1, 0],
    rotation: [0, 0, -0.7071067690849304, 0.7071067690849304],
    scale: [1, 1, 1],
  },
];

export const SPACE_RANGER_ACTOR: GameActorDefinition = buildSimpleActor(
  'space_ranger',
  'Space Ranger',
  SPACE_RANGER_GLB,
  'spaceranger_body',
  {
    tags: ['player'],
    aiPackage: 'none',
    attachments: HAND_SLOT_PLACEHOLDERS,
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
    attachments: HAND_SLOT_PLACEHOLDERS,
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
    attachments: HAND_SLOT_PLACEHOLDERS,
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
    attachments: HAND_SLOT_PLACEHOLDERS,
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
    attachments: HAND_SLOT_PLACEHOLDERS,
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
    attachments: HAND_SLOT_PLACEHOLDERS,
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
    attachments: HAND_SLOT_PLACEHOLDERS,
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
    attachments: HAND_SLOT_PLACEHOLDERS,
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
  COMBAT_MECH_PRIMARY_ACTOR,
  COMBAT_MECH_ALT_ACTOR,
  DUMMY_PRIMARY_ACTOR,
  DUMMY_ALT_A_ACTOR,
  DUMMY_ALT_B_ACTOR,
  DUMMY_ALT_C_ACTOR,
];
