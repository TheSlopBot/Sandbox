export type CameraFollow = {
  distance: number;
  height: number;
  pitchRad: number;
  yawRad: number;
  smooth: number;
};

export function createCameraFollow(): CameraFollow {
  return { distance: 9.5, height: 2.2, pitchRad: -0.85, yawRad: 0.0, smooth: 12.0 };
}

