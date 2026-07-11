import {
  type GpuDevice,
 type LocalTransform, type Registry, type RenderPipeline } from 'viberanium';
import { type PropDocument } from '../../catalog/props/propDocument.ts';
import { installConstructGizmoInput } from './gizmoInput.ts';
import { installConstructGizmoPose } from './gizmoPose.ts';

export type ConstructGizmoController = {
  isDragging: () => boolean;
  destroy: () => void;
};

export const installConstructGizmoSystem = (
  device: GpuDevice,
  registry: Registry,
  pipeline: RenderPipeline,
  canvas: HTMLCanvasElement,
  getDocument: () => PropDocument,
  setDocument: (doc: PropDocument) => void,
  isActive: () => boolean,
  onPartLocalCommit?: (partId: string, local: LocalTransform) => void,
): ConstructGizmoController => {
  const input = installConstructGizmoInput(
    registry,
    pipeline,
    canvas,
    isActive,
    getDocument,
    setDocument,
    onPartLocalCommit,
  );
  const pose = installConstructGizmoPose(device, registry, pipeline, input);

  return {
    isDragging: () => input.isDragging(),
    destroy: () => {
      input.destroy();
      pose.destroy();
    },
  };
};
