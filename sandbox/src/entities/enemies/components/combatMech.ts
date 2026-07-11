import { type CombatMechVariant } from '../../../catalog/actors/kaykitActors.ts';

export type CombatMech = {
  variant: CombatMechVariant;
};

export const createCombatMech = (variant: CombatMechVariant): CombatMech => ({ variant });
