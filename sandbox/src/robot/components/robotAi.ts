import { v3, type Vec3 } from 'viberanium';

export const ROBOT_AI_KEY = 'robotAi';

export type RobotPathWaypoint = { x: number; z: number };

export type RobotAiState = 'navigating' | 'pausing';

export type RobotAi = {
  target: Vec3;
  path: RobotPathWaypoint[];
  pathIndex: number;
  objectiveRadius: number;
  state: RobotAiState;
  pauseRemaining: number;
  pauseMin: number;
  pauseMax: number;
  roamMinX: number;
  roamMaxX: number;
  roamMinZ: number;
  roamMaxZ: number;
  jumpCooldown: number;
  jumpTimer: number;
  jumpChance: number;
};

export type RobotAiOpts = {
  x: number;
  z: number;
  roamMinX?: number;
  roamMaxX?: number;
  roamMinZ?: number;
  roamMaxZ?: number;
  pauseMin?: number;
  pauseMax?: number;
};

export const createRobotAi = (opts: RobotAiOpts): RobotAi => ({
  target: v3(opts.x, 0, opts.z),
  path: [],
  pathIndex: 0,
  objectiveRadius: 0.55,
  state: 'navigating',
  pauseRemaining: 0,
  pauseMin: opts.pauseMin ?? 1.0,
  pauseMax: opts.pauseMax ?? 2.5,
  roamMinX: opts.roamMinX ?? -18,
  roamMaxX: opts.roamMaxX ?? 18,
  roamMinZ: opts.roamMinZ ?? -18,
  roamMaxZ: opts.roamMaxZ ?? 18,
  jumpCooldown: 4 + Math.random() * 4,
  jumpTimer: 1 + Math.random() * 3,
  jumpChance: 0.35,
});
