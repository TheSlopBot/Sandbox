import { type CombatMechVariant } from '../../character/defs/combatMech.ts';

export const COMBAT_MECH_KEY = 'combatMech';

export type CombatMech = {
  variant: CombatMechVariant;
};

export const createCombatMech = (variant: CombatMechVariant): CombatMech => ({ variant });
