import { type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';

export type ConstructGizmoMode = {
  mode: PropEditorTransformMode;
};

export const createConstructGizmoMode = (
  mode: PropEditorTransformMode = 'move',
): ConstructGizmoMode => ({
  mode,
});
