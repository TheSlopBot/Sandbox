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
  CONE_HEIGHT,
  TIP_SIZE,
  axisMaterial,
  createConeMesh,
  createShaftMesh,
} from './meshes.ts';

export type MoveGizmoMeshes = {
  shaft: ReturnType<typeof createShaftMesh>;
  cone: ReturnType<typeof createConeMesh>;
};

export const createMoveGizmoMeshes = (gl: WebGL2RenderingContext): MoveGizmoMeshes => ({
  shaft: createShaftMesh(gl),
  cone: createConeMesh(gl, TIP_SIZE * 0.55, CONE_HEIGHT),
});

export type MoveGizmoHandleRef = {
  id: number;
  axis: Axis;
  role: 'shaft' | 'tip';
};

export const spawnMoveGizmo = (
  registry: Registry,
  meshes: MoveGizmoMeshes,
): MoveGizmoHandleRef[] => {
  const handles: MoveGizmoHandleRef[] = [];

  for (const axis of ['x', 'y', 'z'] as const) {
    for (const role of ['shaft', 'tip'] as const) {
      const ent = registry.createBare();
      const t = createTransform();
      t.dirty = false;
      ent.components[COMPONENT_KEYS.transform] = t;
      ent.components[CONSTRUCT_KEYS.gizmoHandle] = createConstructGizmoHandle(axis, role, 'move');
      ent.components[COMPONENT_KEYS.renderable] = {
        mesh: role === 'shaft' ? meshes.shaft : meshes.cone,
        material: axisMaterial(axis, `construct-gizmo-move-${axis}-${role}`),
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
