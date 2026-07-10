export type ConstructColliderWireframe = {
  shape: 'box' | 'cylinder' | 'sphere';
};

export const createConstructColliderWireframe = (
  shape: 'box' | 'cylinder' | 'sphere',
): ConstructColliderWireframe => ({
  shape,
});
