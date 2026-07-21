import { type WeaponDefinition } from 'viberanium';
import {
  ANIM_COMBAT_MELEE_GLB,
  ANIM_COMBAT_RANGED_GLB,
  ANIM_GENERAL_GLB,
  BULLET,
  GUN_PISTOL,
  SPACE_RANGER_BLADE,
} from '../assets/kaykit.ts';

export type EquipmentSeedDocument = {
  version: 1;
  id: string;
  displayName: string;
  kind: WeaponDefinition['kind'];
  slotTags: string[];
  mesh: WeaponDefinition['mesh'];
  colliders: Array<
    WeaponDefinition['colliders'][number] & {
      id: string;
      name: string;
    }
  >;
  projectile?: WeaponDefinition['projectile'];
  stats: WeaponDefinition['stats'];
  clips: {
    attack?: { animPackUrl?: string; clipName?: string };
    aim?: { animPackUrl?: string; clipName?: string };
    reload?: { animPackUrl?: string; clipName?: string };
    block?: { animPackUrl?: string; clipName?: string };
    idleHold?: { animPackUrl?: string; clipName?: string };
  };
  animPack?: { generalGlb: string };
};

export const EQUIPMENT_SEED_DOCUMENTS: EquipmentSeedDocument[] = [
  {
    version: 1,
    id: 'ranger_blade',
    displayName: 'Space Ranger Blade',
    kind: 'melee',
    slotTags: ['slot:rightHand', 'sword'],
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
  {
    version: 1,
    id: 'space_ranger_pistol',
    displayName: 'Space Ranger Pistol',
    kind: 'gun',
    slotTags: ['slot:rightHand', 'pistol'],
    mesh: {
      url: GUN_PISTOL,
      materialPrefix: 'prop',
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    colliders: [],
    projectile: {
      equipmentId: 'space_ranger_bullet',
      localOffset: [0, 1.25, 0.55],
    },
    stats: {
      damage: 10,
      fireRate: 0.35,
    },
    clips: {
      attack: {
        clipName: 'Ranged_1H_Shoot',
        animPackUrl: ANIM_COMBAT_RANGED_GLB,
      },
      aim: {
        clipName: 'Ranged_1H_Aiming',
        animPackUrl: ANIM_COMBAT_RANGED_GLB,
      },
      idleHold: {
        clipName: 'Ranged_1H_Aiming',
        animPackUrl: ANIM_COMBAT_RANGED_GLB,
      },
    },
  },
  {
    version: 1,
    id: 'space_ranger_bullet',
    displayName: 'Space Ranger Bullet',
    kind: 'projectile',
    slotTags: ['slot:projectile'],
    mesh: {
      url: BULLET,
      materialPrefix: 'prop',
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    colliders: [
      {
        id: 'bullet',
        name: 'Bullet',
        role: 'weapon',
        shape: 'box',
        halfExtents: [0.5, 0.5, 0.5],
        position: [0, 0, -0.2],
        rotation: [0, 0, 0, 1],
        scale: [0.2, 0.2, 0.6],
      },
    ],
    stats: {
      damage: 0,
      moveSpeed: 25,
    },
    clips: {},
  },
];
