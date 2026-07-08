import { COMPONENT_KEYS } from 'viberanium';

export const PREVIEW_KEYS = {
  orbit: `${COMPONENT_KEYS.transform}.previewOrbit`,
  previewAnim: `${COMPONENT_KEYS.transform}.previewAnim`,
  orbitOriginMarker: `${COMPONENT_KEYS.transform}.previewOrbitOriginMarker`,
} as const;

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

export type PreviewOrbitOriginMarker = {
  alpha: number;
  idleSeconds: number;
  maxAlpha: number;
  fadeInPerSecond: number;
  fadeOutPerSecond: number;
  fadeOutDelaySeconds: number;
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

export const createPreviewOrbitOriginMarker = (): PreviewOrbitOriginMarker => ({
  alpha: 0,
  idleSeconds: 999,
  maxAlpha: 0.95,
  fadeInPerSecond: 18,
  fadeOutPerSecond: 18,
  fadeOutDelaySeconds: 0.5,
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

  // Keep the user-perceived "starting zoom" (currently set in `createPreviewOrbit`),
  // but ensure the model is still framed when bounds imply a larger distance.
  const fitted = Math.max(radius * 2.4, orbit.minDistance);
  orbit.distance = Math.min(orbit.maxDistance, Math.max(orbit.distance, fitted));
};

export type PreviewAnim = {
  selectedAnimUrl: string | null;
  selectedClipName: string | null;
  availableClipNames: string[];
};

export const createPreviewAnim = (): PreviewAnim => ({
  selectedAnimUrl: null,
  selectedClipName: null,
  availableClipNames: [],
});

