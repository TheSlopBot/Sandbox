export type ConstructOrbitOriginMarker = {
  alpha: number;
  idleSeconds: number;
  maxAlpha: number;
  fadeInPerSecond: number;
  fadeOutPerSecond: number;
  fadeOutDelaySeconds: number;
};

export const createConstructOrbitOriginMarker = (): ConstructOrbitOriginMarker => ({
  alpha: 0,
  idleSeconds: 999,
  maxAlpha: 0.95,
  fadeInPerSecond: 18,
  fadeOutPerSecond: 18,
  fadeOutDelaySeconds: 0.5,
});
