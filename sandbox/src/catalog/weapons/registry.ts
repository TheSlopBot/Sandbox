import { SPACE_RANGER_BLADE, ANIM_GENERAL_GLB, ANIM_COMBAT_MELEE_GLB } from '../assets/kaykit.ts';
import { resolveLocalEquipment } from '../../storage/equipmentLocalStore.ts';
import { type WeaponDefinition } from 'viberanium';

const identity = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

export const RANGER_BLADE_WEAPON: WeaponDefinition = {
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
  torsoYawCurve: {
    windUpEnd: 0.12,
    swingEnd: 0.55,
    windUpYaw: 0.55,
    swingYaw: -0.75,
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
};

export const PISTOL_WEAPON: WeaponDefinition = {
  id: 'pistol',
  displayName: 'Pistol',
  kind: 'ranged',
  slotTags: ['slot:rightHand'],
  mesh: {
    url: SPACE_RANGER_BLADE,
    materialPrefix: 'spaceranger_blade',
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [0.55, 0.55, 0.55],
  },
  colliders: [],
  projectile: {
    shape: 'sphere',
    radius: 0.1,
    localOffset: [0, 1.25, 0.55],
    speed: 32,
  },
  stats: {
    damage: 18,
    fireRate: 0.35,
  },
  clips: {
    aim: 'pistol_aim',
    attack: 'pistol_shoot',
    reload: 'pistol_reload',
    idleHold: 'pistol_idle',
  },
};

export const SHIELD_WEAPON: WeaponDefinition = {
  id: 'shield',
  displayName: 'Shield',
  kind: 'shield',
  slotTags: ['slot:leftHand'],
  mesh: {
    url: SPACE_RANGER_BLADE,
    materialPrefix: 'spaceranger_blade',
    position: [0, 0.1, 0.1],
    rotation: [0, 0, 0, 1],
    scale: [0.8, 1.2, 0.15],
  },
  colliders: [
    {
      role: 'shield',
      shape: 'box',
      halfExtents: [0.35, 0.45, 0.08],
      ...identity,
      position: [0, 0.2, 0.15],
    },
  ],
  stats: {
    damage: 0,
    blockAngleDeg: 100,
  },
  clips: {
    block: 'shield_block',
    idleHold: 'shield_idle',
  },
};

export const WEAPON_CATALOG: Record<string, WeaponDefinition> = {
  [RANGER_BLADE_WEAPON.id]: RANGER_BLADE_WEAPON,
  [PISTOL_WEAPON.id]: PISTOL_WEAPON,
  [SHIELD_WEAPON.id]: SHIELD_WEAPON,
};

export const getWeaponDef = (id: string): WeaponDefinition | undefined => {
  const local = resolveLocalEquipment(id);
  const catalog = WEAPON_CATALOG[id];
  if (!local) return catalog;
  if (!catalog) return local;

  return {
    ...local,
    torsoYawCurve: local.torsoYawCurve ?? catalog.torsoYawCurve,
  };
};
