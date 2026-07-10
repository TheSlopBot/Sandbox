import { type Mat4 } from '../math/mat4.ts';

export type GroundPlaneMesh = {
  vao: WebGLVertexArrayObject;
  indexCount: number;
  boundsMin: readonly [number, number, number];
  boundsMax: readonly [number, number, number];
  boundsCenter: readonly [number, number, number];
  boundsRadius: number;
};

export type GroundPlane = {
  mesh: GroundPlaneMesh;
  model: Mat4;
};

export const createGroundPlane = (mesh: GroundPlaneMesh, model: Mat4): GroundPlane => ({
  mesh,
  model,
});
