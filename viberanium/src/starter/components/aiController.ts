import { type Vec3 } from '../../math/vec3.ts';

export type AiController = {
  target: Vec3;
  repathInterval: number;
  repathTimer: number;
};

export const createAiController = (target: Vec3): AiController => ({
  target,
  repathInterval: 0.5,
  repathTimer: 0,
});
