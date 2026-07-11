import {
  type GpuDevice,
  type Material,
  type Mat4,
  type Quat,
  type Registry,
  type RenderPipeline,
  type Transform,
  type Vec3,
  destroyMesh,
  m4,
  m4Copy,
  m4FromTRS,
  m4FromTRSQuat,
  m4Mul,
  q4,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ConstructGizmoHandle } from './gizmoHandle.ts';
import { type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import { type Axis, AXIS_COLORS, AXIS_COLORS_HOVER, SHAFT_TIP_OVERLAP } from './meshes.ts';
import { createMoveGizmoMeshes, spawnMoveGizmo, type MoveGizmoHandleRef } from './move.ts';
import { createRotateGizmoMeshes, spawnRotateGizmo, type RotateGizmoHandleRef } from './rotate.ts';
import { createScaleGizmoMeshes, spawnScaleGizmo, type ScaleGizmoHandleRef } from './scale.ts';
import { type GizmoFrame, gizmoWorldScale, shaftEndDistance, tipAnchor } from './gizmoFrame.ts';
import { resolveGizmoSelection } from './gizmoTarget.ts';
import { type ConstructGizmoInputController } from './gizmoInput.ts';

type HandleRole = 'shaft' | 'tip' | 'ring';

const RING_ROT: Record<Axis, Quat> = {
  x: q4(0, 0, 0.70710678, 0.70710678),
  y: q4(0, 0, 0, 1),
  z: q4(0.70710678, 0, 0, 0.70710678),
};

const ROT_POS_Y_TO_AXIS: Record<Axis, Quat> = {
  x: q4(0, 0, -0.70710678, 0.70710678),
  y: q4(0, 0, 0, 1),
  z: q4(0.70710678, 0, 0, 0.70710678),
};

const ROT_POS_Y_TO_NEG_AXIS: Record<Axis, Quat> = {
  x: q4(0, 0, 0.70710678, 0.70710678),
  y: q4(1, 0, 0, 0),
  z: q4(-0.70710678, 0, 0, 0.70710678),
};

type HandleRef = {
  id: number;
  axis: Axis;
  role: HandleRole;
  gizmo: 'move' | 'rotate' | 'scale';
};

export type ConstructGizmoPoseController = {
  destroy: () => void;
};

const setHandleHighlight = (material: Material, axis: Axis, highlighted: boolean) => {
  const color = highlighted ? AXIS_COLORS_HOVER[axis] : AXIS_COLORS[axis];
  material.baseColorFactor[0] = color[0];
  material.baseColorFactor[1] = color[1];
  material.baseColorFactor[2] = color[2];
  material.baseColorFactor[3] = color[3];
};

export const installConstructGizmoPose = (
  device: GpuDevice,
  registry: Registry,
  pipeline: RenderPipeline,
  input: ConstructGizmoInputController,
): ConstructGizmoPoseController => {
  const moveMeshes = createMoveGizmoMeshes(device);
  const rotateMeshes = createRotateGizmoMeshes(device);
  const scaleMeshes = createScaleGizmoMeshes(device);

  let moveHandles: MoveGizmoHandleRef[] = [];
  let rotateHandles: RotateGizmoHandleRef[] = [];
  let scaleHandles: ScaleGizmoHandleRef[] = [];
  let handles: HandleRef[] = [];

  const _handleLocal = m4();
  const _frameAtOrigin = m4();
  const _localPos = v3();

  const rebuildHandleList = () => {
    handles = [
      ...moveHandles.map((h) => ({ ...h, gizmo: 'move' as const })),
      ...rotateHandles.map((h) => ({ ...h, gizmo: 'rotate' as const })),
      ...scaleHandles.map((h) => ({ ...h, gizmo: 'scale' as const })),
    ];
  };

  const ensureHandles = () => {
    if (handles.length >= 9) {
      let missing = false;
      for (const h of handles) {
        if (!registry.get(h.id)) {
          missing = true;
          break;
        }
      }
      if (!missing) return;
    }

    const existing = [...registry.view(CONSTRUCT_KEYS.gizmoHandle)];
    if (existing.length >= 9) {
      moveHandles = [];
      rotateHandles = [];
      scaleHandles = [];
      for (const e of existing) {
        const h = e.components[CONSTRUCT_KEYS.gizmoHandle] as ConstructGizmoHandle | undefined;
        if (!h) continue;
        const renderable = e.components[COMPONENT_KEYS.renderable] as {
          overlay?: boolean;
          castShadow?: boolean;
          material?: Material;
        } | undefined;
        if (renderable) {
          renderable.overlay = true;
          renderable.castShadow = false;
        }
        if (renderable?.material) setHandleHighlight(renderable.material, h.axis, false);
        if (h.gizmo === 'move' && (h.role === 'shaft' || h.role === 'tip')) {
          moveHandles.push({ id: e.id, axis: h.axis, role: h.role });
        } else if (h.gizmo === 'rotate' && h.role === 'ring') {
          rotateHandles.push({ id: e.id, axis: h.axis, role: 'ring' });
        } else if (h.gizmo === 'scale' && (h.role === 'shaft' || h.role === 'tip')) {
          scaleHandles.push({ id: e.id, axis: h.axis, role: h.role });
        } else if (h.role === 'ring') {
          rotateHandles.push({ id: e.id, axis: h.axis, role: 'ring' });
        } else {
          moveHandles.push({ id: e.id, axis: h.axis, role: h.role === 'tip' ? 'tip' : 'shaft' });
        }
      }
      rebuildHandleList();
      return;
    }

    for (const h of handles) {
      if (registry.get(h.id)) registry.deregister(h.id);
    }

    moveHandles = spawnMoveGizmo(registry, moveMeshes);
    rotateHandles = spawnRotateGizmo(registry, rotateMeshes);
    scaleHandles = spawnScaleGizmo(registry, scaleMeshes);
    rebuildHandleList();
  };

  const orientHandle = (
    t: Transform,
    model: Mat4,
    origin: Vec3,
    axis: Axis,
    role: HandleRole,
    gizmoScale: number,
    mode: PropEditorTransformMode,
    sign: 1 | -1,
    frame: GizmoFrame,
  ) => {
    m4Copy(_frameAtOrigin, frame.rot);
    _frameAtOrigin[12] = origin[0];
    _frameAtOrigin[13] = origin[1];
    _frameAtOrigin[14] = origin[2];

    if (role === 'ring') {
      t.position[0] = origin[0];
      t.position[1] = origin[1];
      t.position[2] = origin[2];
      const s = gizmoScale;
      m4FromTRSQuat(_handleLocal, v3(0, 0, 0), RING_ROT[axis], v3(s, s, s));
      m4Mul(model, _frameAtOrigin, _handleLocal);
      m4Copy(t.world, model);
      t.dirty = false;
      return;
    }

    const rot = sign > 0 ? ROT_POS_Y_TO_AXIS[axis] : ROT_POS_Y_TO_NEG_AXIS[axis];
    const shaftEnd = shaftEndDistance(gizmoScale);

    if (role === 'shaft') {
      const length = Math.max(0.05, shaftEnd + SHAFT_TIP_OVERLAP * gizmoScale);
      const along = (length * 0.5) * sign;
      _localPos[0] = axis === 'x' ? along : 0;
      _localPos[1] = axis === 'y' ? along : 0;
      _localPos[2] = axis === 'z' ? along : 0;
      m4FromTRSQuat(_handleLocal, _localPos, rot, v3(gizmoScale, length, gizmoScale));
      m4Mul(model, _frameAtOrigin, _handleLocal);
      t.position[0] = model[12]!;
      t.position[1] = model[13]!;
      t.position[2] = model[14]!;
      m4Copy(t.world, model);
      t.dirty = false;
      return;
    }

    const along = tipAnchor(mode, gizmoScale) * sign;
    _localPos[0] = axis === 'x' ? along : 0;
    _localPos[1] = axis === 'y' ? along : 0;
    _localPos[2] = axis === 'z' ? along : 0;
    const s = gizmoScale;
    if (mode === 'scale') {
      m4FromTRS(_handleLocal, _localPos, 0, v3(s, s, s));
    } else {
      m4FromTRSQuat(_handleLocal, _localPos, rot, v3(s, s, s));
    }
    m4Mul(model, _frameAtOrigin, _handleLocal);
    t.position[0] = model[12]!;
    t.position[1] = model[13]!;
    t.position[2] = model[14]!;
    m4Copy(t.world, model);
    t.dirty = false;
  };

  const removeAction = registry.addAction('update', () => {
    ensureHandles();

    const ctx = resolveGizmoSelection(registry, pipeline);
    input.setSelectionVisible(ctx !== null);
    const activeAxis = input.getActiveAxis();
    const scale = gizmoWorldScale();

    for (const h of handles) {
      const ent = registry.get(h.id);
      if (!ent) continue;
      const t = ent.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const renderable = ent.components[COMPONENT_KEYS.renderable] as {
        mesh: unknown;
        model?: Mat4;
        visible?: boolean;
        material?: Material;
      } | undefined;
      if (!t || !renderable?.model || !renderable.material) continue;

      if (!ctx) {
        renderable.visible = false;
        setHandleHighlight(renderable.material, h.axis, false);
        continue;
      }

      const wantVisible =
        (ctx.mode === 'move' && h.gizmo === 'move') ||
        (ctx.mode === 'rotate' && h.gizmo === 'rotate') ||
        (ctx.mode === 'scale' && h.gizmo === 'scale');

      renderable.visible = wantVisible;
      if (!wantVisible) {
        setHandleHighlight(renderable.material, h.axis, false);
        continue;
      }

      setHandleHighlight(renderable.material, h.axis, activeAxis === h.axis);
      orientHandle(t, renderable.model, ctx.origin, h.axis, h.role, scale, ctx.mode, ctx.signs[h.axis], ctx.frame);
    }
  }, 25);

  return {
    destroy: () => {
      removeAction();
      for (const h of handles) {
        if (registry.get(h.id)) registry.deregister(h.id);
      }
      destroyMesh(device, moveMeshes.shaft);
      destroyMesh(device, moveMeshes.cone);
      destroyMesh(device, rotateMeshes.ring);
      destroyMesh(device, scaleMeshes.shaft);
      destroyMesh(device, scaleMeshes.cube);
    },
  };
};
