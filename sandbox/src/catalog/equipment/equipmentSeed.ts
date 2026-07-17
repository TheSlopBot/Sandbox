import { type WeaponDefinition } from 'viberanium';
import { ANIM_COMBAT_MELEE_GLB, ANIM_GENERAL_GLB, SPACE_RANGER_BLADE } from '../assets/kaykit.ts';

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
