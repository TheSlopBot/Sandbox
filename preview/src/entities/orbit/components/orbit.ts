export type PreviewOrbit = {
  yawRad: number;
  pitchRad: number;
  distance: number;
  target: [number, number, number];
  minPitchRad: number;
  maxPitchRad: number;
  minDistance: number;
  maxDistance: number;
  dragging: boolean;
  dragButton: 0 | 2 | null;
  lastX: number;
  lastY: number;
  pendingDx: number;
  pendingDy: number;
  pendingPanDx: number;
  pendingPanDy: number;
  pendingWheel: number;
};

export const createPreviewOrbit = (): PreviewOrbit => ({
  yawRad: Math.PI * 0.2,
  pitchRad: Math.PI * 0.2,
  distance: 12.8,
  target: [0, 0, 0],
  minPitchRad: -Math.PI * 0.48,
  maxPitchRad: Math.PI * 0.48,
  minDistance: 0.6,
  maxDistance: 48,
  dragging: false,
  dragButton: null,
  lastX: 0,
  lastY: 0,
  pendingDx: 0,
  pendingDy: 0,
  pendingPanDx: 0,
  pendingPanDy: 0,
  pendingWheel: 0,
});

export const frameOrbitOnBounds = (
  orbit: PreviewOrbit,
  center: [number, number, number],
  radius: number,
) => {
  orbit.target[0] = center[0];
  orbit.target[1] = center[1];
  orbit.target[2] = center[2];
  orbit.pendingPanDx = 0;
  orbit.pendingPanDy = 0;

  const fitted = Math.max(radius * 2.4, orbit.minDistance);
  orbit.distance = Math.min(orbit.maxDistance, Math.max(orbit.distance, fitted));
};
