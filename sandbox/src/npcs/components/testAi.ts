import { v3, type Vec3 } from 'viberanium';

export const TEST_AI_KEY = 'testAi';

export type TestPathWaypoint = { x: number; z: number };

export type TestAiState = 'navigating' | 'pausing';

export type TestAi = {
  target: Vec3;
  path: TestPathWaypoint[];
  pathIndex: number;
  objectiveRadius: number;
  state: TestAiState;
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

export type TestAiOpts = {
  x: number;
  z: number;
  roamMinX?: number;
  roamMaxX?: number;
  roamMinZ?: number;
  roamMaxZ?: number;
  pauseMin?: number;
  pauseMax?: number;
};

export const createTestAi = (opts: TestAiOpts): TestAi => ({
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
