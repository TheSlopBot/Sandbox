export type CombatIntent = {
  attackPressed: boolean;
  aimHeld: boolean;
  aimYawRad: number;
  aimPitchRad: number;
  walkingBackwards: boolean;
  equipMeleePressed: boolean;
  equipRangedPressed: boolean;
  toggleShieldPressed: boolean;
  stowRightPressed: boolean;
};

export const createCombatIntent = (): CombatIntent => ({
  attackPressed: false,
  aimHeld: false,
  aimYawRad: 0,
  aimPitchRad: 0,
  walkingBackwards: false,
  equipMeleePressed: false,
  equipRangedPressed: false,
  toggleShieldPressed: false,
  stowRightPressed: false,
});

export const clearCombatIntentEdges = (intent: CombatIntent): void => {
  intent.attackPressed = false;
  intent.equipMeleePressed = false;
  intent.equipRangedPressed = false;
  intent.toggleShieldPressed = false;
  intent.stowRightPressed = false;
};
