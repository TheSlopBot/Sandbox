export type ConstructColliderWireframe = {
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule';
};

export const createConstructColliderWireframe = (
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule',
): ConstructColliderWireframe => ({
  shape,
});
