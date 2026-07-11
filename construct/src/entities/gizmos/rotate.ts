import {
  type GpuDevice,
  type Registry,
  createTransform,
  m4,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { createConstructGizmoHandle } from './gizmoHandle.ts';
import {
  type Axis,
  RING_RADIUS,
  RING_TUBE,
  axisMaterial,
  createTorusMesh,
} from './meshes.ts';

export type RotateGizmoMeshes = {
  ring: ReturnType<typeof createTorusMesh>;
};

export const createRotateGizmoMeshes = (device: GpuDevice): RotateGizmoMeshes => ({
  ring: createTorusMesh(device, RING_RADIUS, RING_TUBE),
});

export type RotateGizmoHandleRef = {
  id: number;
  axis: Axis;
  role: 'ring';
};

export const spawnRotateGizmo = (
  registry: Registry,
  meshes: RotateGizmoMeshes,
): RotateGizmoHandleRef[] => {
  const handles: RotateGizmoHandleRef[] = [];

  for (const axis of ['x', 'y', 'z'] as const) {
    const ent = registry.createBare();
    const t = createTransform();
    t.dirty = false;
    ent.components[COMPONENT_KEYS.transform] = t;
    ent.components[CONSTRUCT_KEYS.gizmoHandle] = createConstructGizmoHandle(axis, 'ring', 'rotate');
    ent.components[COMPONENT_KEYS.renderable] = {
      mesh: meshes.ring,
      material: axisMaterial(axis, `construct-gizmo-rotate-${axis}`),
      model: m4(),
      visible: false,
      castShadow: false,
      overlay: true,
    };
    registry.register(ent);
    handles.push({ id: ent.id, axis, role: 'ring' });
  }

  return handles;
};
