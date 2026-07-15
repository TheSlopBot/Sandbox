export const COMBAT_LAYER = {
  PHYSICS: 1 << 0,
  HURTBOX: 1 << 1,
  HITBOX: 1 << 2,
  SHIELD: 1 << 3,
  PROJECTILE: 1 << 4,
} as const;

export type CombatLayerBits = number;

export const COMBAT_MASK = {
  NONE: 0,
  HURTBOX: COMBAT_LAYER.HURTBOX,
  SHIELD: COMBAT_LAYER.SHIELD,
  HITBOX_TARGETS: COMBAT_LAYER.HURTBOX | COMBAT_LAYER.SHIELD,
  PROJECTILE_TARGETS: COMBAT_LAYER.HURTBOX | COMBAT_LAYER.SHIELD | COMBAT_LAYER.PHYSICS,
} as const;

export const isPhysicsLayer = (layer: CombatLayerBits | undefined): boolean =>
  layer === undefined || (layer & COMBAT_LAYER.PHYSICS) !== 0;

export const combatLayersOverlap = (
  aLayer: CombatLayerBits,
  aMask: CombatLayerBits,
  bLayer: CombatLayerBits,
  bMask: CombatLayerBits,
): boolean => (aMask & bLayer) !== 0 || (bMask & aLayer) !== 0;
