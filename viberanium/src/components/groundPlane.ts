import { type Mat4 } from '../math/mat4.ts';
import { type Mesh } from '../render/gl/mesh.ts';
import { type LevelGroundVariant } from '../definitions/levels/levelDefinition.ts';

export type GroundPlaneMesh = Mesh;

export type GroundPlane = {
  mesh: GroundPlaneMesh;
  model: Mat4;
  variant: LevelGroundVariant;
};

export const createGroundPlane = (
  mesh: GroundPlaneMesh,
  model: Mat4,
  variant: LevelGroundVariant = 'blue',
): GroundPlane => ({
  mesh,
  model,
  variant,
});
