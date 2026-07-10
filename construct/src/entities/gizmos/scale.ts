import {
  type Registry,
  createTransform,
  m4,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { createConstructGizmoHandle } from './gizmoHandle.ts';
import {
  type Axis,
  TIP_SIZE,
  axisMaterial,
  createBoxMesh,
  createShaftMesh,
} from './meshes.ts';

export type ScaleGizmoMeshes = {
  shaft: ReturnType<typeof createShaftMesh>;
  cube: ReturnType<typeof createBoxMesh>;
};

export const createScaleGizmoMeshes = (gl: WebGL2RenderingContext): ScaleGizmoMeshes => ({
  shaft: createShaftMesh(gl),
  cube: createBoxMesh(gl, TIP_SIZE * 0.45, TIP_SIZE * 0.45, TIP_SIZE * 0.45),
});

export type ScaleGizmoHandleRef = {
  id: number;
  axis: Axis;
  role: 'shaft' | 'tip';
};

export const spawnScaleGizmo = (
  registry: Registry,
  meshes: ScaleGizmoMeshes,
): ScaleGizmoHandleRef[] => {
  const handles: ScaleGizmoHandleRef[] = [];

  for (const axis of ['x', 'y', 'z'] as const) {
    for (const role of ['shaft', 'tip'] as const) {
      const ent = registry.createBare();
      const t = createTransform();
      t.dirty = false;
      ent.components[COMPONENT_KEYS.transform] = t;
      ent.components[CONSTRUCT_KEYS.gizmoHandle] = createConstructGizmoHandle(axis, role, 'scale');
      ent.components[COMPONENT_KEYS.renderable] = {
        mesh: role === 'shaft' ? meshes.shaft : meshes.cube,
        material: axisMaterial(axis, `construct-gizmo-scale-${axis}-${role}`),
        model: m4(),
        visible: false,
        castShadow: false,
        overlay: true,
      };
      registry.register(ent);
      handles.push({ id: ent.id, axis, role });
    }
  }

  return handles;
};
