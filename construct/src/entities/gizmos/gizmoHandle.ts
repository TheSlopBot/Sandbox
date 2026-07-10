export type ConstructGizmoHandle = {
  axis: 'x' | 'y' | 'z';
  role: 'shaft' | 'tip' | 'ring';
  gizmo: 'move' | 'rotate' | 'scale';
};

export const createConstructGizmoHandle = (
  axis: 'x' | 'y' | 'z',
  role: 'shaft' | 'tip' | 'ring',
  gizmo: 'move' | 'rotate' | 'scale',
): ConstructGizmoHandle => ({
  axis,
  role,
  gizmo,
});
