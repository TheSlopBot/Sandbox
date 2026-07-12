import { type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';

export type ConstructGizmoMoveOrientation = 'world' | 'local';

export type ConstructGizmoMode = {
  mode: PropEditorTransformMode;
  moveOrientation: ConstructGizmoMoveOrientation;
};

export const createConstructGizmoMode = (
  mode: PropEditorTransformMode = 'move',
  moveOrientation: ConstructGizmoMoveOrientation = 'world',
): ConstructGizmoMode => ({
  mode,
  moveOrientation,
});
