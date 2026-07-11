import { type Mat4 } from '../math/mat4.ts';
import { type Mesh } from '../render/gl/mesh.ts';

export type GroundPlaneMesh = Mesh;

export type GroundPlane = {
  mesh: GroundPlaneMesh;
  model: Mat4;
};

export const createGroundPlane = (mesh: GroundPlaneMesh, model: Mat4): GroundPlane => ({
  mesh,
  model,
});
