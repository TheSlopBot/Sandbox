import {
  buildSimpleActor,
  DEFAULT_CHARACTER_BODY_CYLINDER,
  DEFAULT_CHARACTER_HURTBOX,
} from 'viberanium';

const DEFAULT_CHARACTER_COLLIDERS = [
  { ...DEFAULT_CHARACTER_BODY_CYLINDER },
  { ...DEFAULT_CHARACTER_HURTBOX },
];
import { KAYKIT_MEDIUM_ANIM_PACK, KAYKIT_MEDIUM_CLIPS } from '../manifest/kaykitMediumDefaults.ts';
import { fromActorDefinition, type ActorDocument } from './actorDocument.ts';

const KAYKIT_BASE = `${import.meta.env.BASE_URL}assets/kaykit`;

const SPACE_RANGER_GLB = `${KAYKIT_BASE}/KayKit Mystery Monthly Series 4/7 - January 2024 - Space Ranger/character/SpaceRanger.glb`;
const SPACE_RANGER_BLADE = `${KAYKIT_BASE}/KayKit Mystery Monthly Series 4/7 - January 2024 - Space Ranger/assets/gltf/SpaceRanger_Blade.gltf`;
const ROBOT_ONE_GLB = `${KAYKIT_BASE}/KayKit Mystery Monthly Series 4/12 - June 2024 - Robot/characters/Robot_One.glb`;
const COMBAT_MECH_GLB = `${KAYKIT_BASE}/KayKit Mystery Monthly Series 5/1 - July 2024 - Combat Mech/characters/CombatMech.glb`;
const COMBAT_MECH_TEX_PRIMARY = `${KAYKIT_BASE}/KayKit Mystery Monthly Series 5/textures/combatmech_texture.png`;
const COMBAT_MECH_TEX_ALT = `${KAYKIT_BASE}/KayKit Mystery Monthly Series 5/textures/combatmech_texture_alt.png`;
const DUMMY_GLB = `${KAYKIT_BASE}/KayKit Prototype Bits 1.1/Character/Dummy.glb`;
const DUMMY_TEX_PRIMARY = `${KAYKIT_BASE}/KayKit Prototype Bits 1.1/textures/prototypebits_texture.png`;
const DUMMY_TEX_ALT_A = `${KAYKIT_BASE}/KayKit Prototype Bits 1.1/textures/prototypebits_texture_alt_A.png`;
const DUMMY_TEX_ALT_B = `${KAYKIT_BASE}/KayKit Prototype Bits 1.1/textures/prototypebits_texture_alt_B.png`;
const DUMMY_TEX_ALT_C = `${KAYKIT_BASE}/KayKit Prototype Bits 1.1/textures/prototypebits_texture_alt_C.png`;

const withKaykitAnim = {
  animPack: KAYKIT_MEDIUM_ANIM_PACK,
  clips: KAYKIT_MEDIUM_CLIPS,
};

const HAND_SLOT_PLACEHOLDERS = [
  {
    id: 'rightHandSlot',
    name: 'Right Hand Slot',
    boneName: 'hand.r',
    url: SPACE_RANGER_BLADE,
    materialPrefix: 'spaceranger_blade',
    tags: ['slot:rightHand'],
    placeholder: true,
    position: [0, 0.1, 0] as [number, number, number],
    rotation: [-0.7071067690849304, 0.7071067690849304, 0, 0] as [number, number, number, number],
    scale: [1, 1, 1] as [number, number, number],
  },
  {
    id: 'leftHandSlot',
    name: 'Left Hand Slot',
    boneName: 'hand.l',
    url: SPACE_RANGER_BLADE,
    materialPrefix: 'spaceranger_blade',
    tags: ['slot:leftHand'],
    placeholder: true,
    position: [0, 0.1, 0] as [number, number, number],
    rotation: [0, 0, -0.7071067690849304, 0.7071067690849304] as [number, number, number, number],
    scale: [1, 1, 1] as [number, number, number],
  },
];

export const ACTOR_SEED_DOCUMENTS: ActorDocument[] = [
  fromActorDefinition(
    buildSimpleActor('space_ranger', 'Space Ranger', SPACE_RANGER_GLB, 'spaceranger_body', {
      ...withKaykitAnim,
      tags: ['player'],
      colliders: DEFAULT_CHARACTER_COLLIDERS,
      attachments: HAND_SLOT_PLACEHOLDERS,
    }),
    'none',
  ),
  fromActorDefinition(
    buildSimpleActor('robot_one', 'Robot One', ROBOT_ONE_GLB, 'robot_one', {
      ...withKaykitAnim,
      tags: ['robot'],
      colliders: DEFAULT_CHARACTER_COLLIDERS,
      attachments: HAND_SLOT_PLACEHOLDERS,
    }),
    'testAi',
  ),
  fromActorDefinition(
    buildSimpleActor('combat_mech_primary', 'Combat Mech Primary', COMBAT_MECH_GLB, 'combat_mech_primary', {
      ...withKaykitAnim,
      tags: ['combatMech'],
      baseColorTextureUrl: COMBAT_MECH_TEX_PRIMARY,
      colliders: DEFAULT_CHARACTER_COLLIDERS,
      attachments: HAND_SLOT_PLACEHOLDERS,
    }),
    'testAi',
  ),
  fromActorDefinition(
    buildSimpleActor('combat_mech_alt', 'Combat Mech Alt', COMBAT_MECH_GLB, 'combat_mech_alt', {
      ...withKaykitAnim,
      tags: ['combatMech'],
      baseColorTextureUrl: COMBAT_MECH_TEX_ALT,
      colliders: DEFAULT_CHARACTER_COLLIDERS,
      attachments: HAND_SLOT_PLACEHOLDERS,
    }),
    'testAi',
  ),
  fromActorDefinition(
    buildSimpleActor('dummy_primary', 'Dummy Primary', DUMMY_GLB, 'dummy_primary', {
      ...withKaykitAnim,
      tags: ['dummy'],
      baseColorTextureUrl: DUMMY_TEX_PRIMARY,
      colliders: DEFAULT_CHARACTER_COLLIDERS,
      attachments: HAND_SLOT_PLACEHOLDERS,
    }),
    'testAi',
  ),
  fromActorDefinition(
    buildSimpleActor('dummy_alt_a', 'Dummy Alt A', DUMMY_GLB, 'dummy_alt_a', {
      ...withKaykitAnim,
      tags: ['dummy'],
      baseColorTextureUrl: DUMMY_TEX_ALT_A,
      colliders: DEFAULT_CHARACTER_COLLIDERS,
      attachments: HAND_SLOT_PLACEHOLDERS,
    }),
    'testAi',
  ),
  fromActorDefinition(
    buildSimpleActor('dummy_alt_b', 'Dummy Alt B', DUMMY_GLB, 'dummy_alt_b', {
      ...withKaykitAnim,
      tags: ['dummy'],
      baseColorTextureUrl: DUMMY_TEX_ALT_B,
      colliders: DEFAULT_CHARACTER_COLLIDERS,
      attachments: HAND_SLOT_PLACEHOLDERS,
    }),
    'testAi',
  ),
  fromActorDefinition(
    buildSimpleActor('dummy_alt_c', 'Dummy Alt C', DUMMY_GLB, 'dummy_alt_c', {
      ...withKaykitAnim,
      tags: ['dummy'],
      baseColorTextureUrl: DUMMY_TEX_ALT_C,
      colliders: DEFAULT_CHARACTER_COLLIDERS,
      attachments: HAND_SLOT_PLACEHOLDERS,
    }),
    'testAi',
  ),
];
