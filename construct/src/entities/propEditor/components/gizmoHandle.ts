export type ConstructGizmoHandle = {
  axis: 'x' | 'y' | 'z';
  role: 'shaft' | 'tip' | 'ring';
};

export const createConstructGizmoHandle = (
  axis: 'x' | 'y' | 'z',
  role: 'shaft' | 'tip' | 'ring',
): ConstructGizmoHandle => ({
  axis,
  role,
});
