import { type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import { type Axis } from './meshes.ts';

export type ConstructGizmoMoveOrientation = 'world' | 'local';

export type ConstructGizmoMode = {
  mode: PropEditorTransformMode;
  moveOrientation: ConstructGizmoMoveOrientation;
  allowedAxes: Axis[] | null;
};

export const createConstructGizmoMode = (
  mode: PropEditorTransformMode = 'move',
  moveOrientation: ConstructGizmoMoveOrientation = 'world',
): ConstructGizmoMode => ({
  mode,
  moveOrientation,
  allowedAxes: null,
});
