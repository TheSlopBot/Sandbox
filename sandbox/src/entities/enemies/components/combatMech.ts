import { type CombatMechVariant } from '../../../catalog/characters/combatMech.ts';

export type CombatMech = {
  variant: CombatMechVariant;
};

export const createCombatMech = (variant: CombatMechVariant): CombatMech => ({ variant });
