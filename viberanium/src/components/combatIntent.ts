export type CombatIntent = {
  attackPressed: boolean;
  aimHeld: boolean;
  releasePressed: boolean;
  aimYawRad: number;
  walkingBackwards: boolean;
  equipMeleePressed: boolean;
  equipRangedPressed: boolean;
  toggleShieldPressed: boolean;
  stowRightPressed: boolean;
};

export const createCombatIntent = (): CombatIntent => ({
  attackPressed: false,
  aimHeld: false,
  releasePressed: false,
  aimYawRad: 0,
  walkingBackwards: false,
  equipMeleePressed: false,
  equipRangedPressed: false,
  toggleShieldPressed: false,
  stowRightPressed: false,
});

export const clearCombatIntentEdges = (intent: CombatIntent): void => {
  intent.attackPressed = false;
  intent.releasePressed = false;
  intent.equipMeleePressed = false;
  intent.equipRangedPressed = false;
  intent.toggleShieldPressed = false;
  intent.stowRightPressed = false;
};
