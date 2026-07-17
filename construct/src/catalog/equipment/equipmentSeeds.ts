import { type EquipmentDocument } from './equipmentDocument.ts';

const KAYKIT_BASE = `${import.meta.env.BASE_URL}assets/kaykit`;

const SPACE_RANGER_BLADE = `${KAYKIT_BASE}/KayKit Mystery Monthly Series 4/7 - January 2024 - Space Ranger/assets/gltf/SpaceRanger_Blade.gltf`;
const ANIM_GENERAL_GLB = `${KAYKIT_BASE}/KayKit Character Animations 1.1/Animations/gltf/Rig_Medium/Rig_Medium_General.glb`;
const ANIM_COMBAT_MELEE_GLB = `${KAYKIT_BASE}/KayKit Character Animations 1.1/Animations/gltf/Rig_Medium/Rig_Medium_CombatMelee.glb`;

export const EQUIPMENT_SEED_DOCUMENTS: EquipmentDocument[] = [
  {
    version: 1,
    id: 'ranger_blade',
    displayName: 'Space Ranger Blade',
    kind: 'melee',
    slotTags: ['slot:rightHand'],
    mesh: {
      url: SPACE_RANGER_BLADE,
      materialPrefix: 'prop',
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    colliders: [
      {
        id: 'blade',
        name: 'Blade',
        role: 'weapon',
        shape: 'box',
        halfExtents: [0.5, 0.5, 0.5],
        position: [0.6, 0.9, 0],
        rotation: [0, 0, 0, 1],
        scale: [1.9, 1.2, 0.1],
      },
    ],
    stats: {
      damage: 4,
      hitWindowStart: 0.2,
      hitWindowEnd: 0.8,
      attackSpeed: 2,
    },
    clips: {
      attack: {
        clipName: 'Melee_1H_Attack_Slice_Diagonal',
        animPackUrl: ANIM_COMBAT_MELEE_GLB,
      },
      idleHold: {
        clipName: 'Idle_A',
        animPackUrl: ANIM_GENERAL_GLB,
      },
    },
  },
];
