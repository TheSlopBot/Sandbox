export type MeleeTorsoYawCurve = {
  windUpEnd: number;
  swingEnd: number;
  windUpYaw: number;
  swingYaw: number;
};

export const DEFAULT_MELEE_TORSO_YAW_CURVE: MeleeTorsoYawCurve = {
  windUpEnd: 0.12,
  swingEnd: 0.55,
  windUpYaw: 0.55,
  swingYaw: -0.75,
};

export const sampleMeleeTorsoYaw = (
  progress: number,
  curve: MeleeTorsoYawCurve = DEFAULT_MELEE_TORSO_YAW_CURVE,
): number => {
  const u = Math.max(0, Math.min(1, progress));
  const windUpEnd = Math.max(1e-4, Math.min(curve.windUpEnd, 0.999));
  const swingEnd = Math.max(windUpEnd + 1e-4, Math.min(curve.swingEnd, 1));

  if (u <= windUpEnd) {
    const t = u / windUpEnd;
    const eased = 1 - (1 - t) * (1 - t);
    return curve.windUpYaw * eased;
  }

  if (u <= swingEnd) {
    const t = (u - windUpEnd) / (swingEnd - windUpEnd);
    const eased = t * t * (3 - 2 * t);
    return curve.windUpYaw + (curve.swingYaw - curve.windUpYaw) * eased;
  }

  const t = (u - swingEnd) / Math.max(1e-4, 1 - swingEnd);
  const eased = t * t * (3 - 2 * t);
  return curve.swingYaw * (1 - eased);
};
