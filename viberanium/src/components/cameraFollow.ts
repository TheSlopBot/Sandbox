export type CameraFollow = {
  distance: number;
  currentDist: number;
  pivotHeight: number;
  pitchRad: number;
  yawRad: number;
  smooth: number;
  mouseSensX: number;
  mouseSensY: number;
  minOrbitElevationRad: number;
  maxPitchRad: number;
};

export const createCameraFollow = (): CameraFollow => ({
  distance: 9.5,
  currentDist: 9.5,
  pivotHeight: 1.1,
  pitchRad: 0.35,
  yawRad: 0.0,
  smooth: 12.0,
  mouseSensX: 0.003,
  mouseSensY: 0.003,
  minOrbitElevationRad: 0.45,
  maxPitchRad: 1.4,
});
