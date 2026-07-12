import {
  type LocalTransform,
  type Registry,
  type RenderPipeline,
  type Vec3,
  m4,
  q4,
  q4Normalize,
  q4TransformVec3,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { type PropDocument, type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import {
  localPivotFromTransform,
  partModelSpaceCenter,
  setLocalPositionForPivot,
} from '../propEditor/partPivot.ts';
import { type Axis } from './meshes.ts';
import {
  type GizmoFrame,
  frameAxis,
  gizmoWorldScale,
  setRotationMatFromAxes,
} from './gizmoFrame.ts';
import { pickHandle, unprojectScreenRay } from './gizmoPicking.ts';
import { commitPartLocal, findEditableTarget, resolveGizmoSelection, syncPartWorld } from './gizmoTarget.ts';
import { type ConstructGizmoMoveOrientation } from './gizmoMode.ts';

const SHIFT_SNAP = 0.1;
const SHIFT_ROTATE_SNAP = (15 * Math.PI) / 180;

const _axisLocal = v3();
const _rotatedAxis = v3();
const _rotQ = q4();

const snapToIncrement = (value: number, increment: number) =>
  Math.round(value / increment) * increment;

const axisIndex = (axis: Axis) => (axis === 'x' ? 0 : axis === 'y' ? 1 : 2);

const unitAxis = (out: Vec3, axis: Axis) => {
  out[0] = axis === 'x' ? 1 : 0;
  out[1] = axis === 'y' ? 1 : 0;
  out[2] = axis === 'z' ? 1 : 0;
  return out;
};

const applyLocalAxisMove = (
  local: LocalTransform,
  startPos: [number, number, number],
  startRot: [number, number, number, number],
  axis: Axis,
  delta: number,
) => {
  _rotQ[0] = startRot[0];
  _rotQ[1] = startRot[1];
  _rotQ[2] = startRot[2];
  _rotQ[3] = startRot[3];
  q4TransformVec3(_rotatedAxis, _rotQ, unitAxis(_axisLocal, axis));
  local.position[0] = startPos[0] + _rotatedAxis[0] * delta;
  local.position[1] = startPos[1] + _rotatedAxis[1] * delta;
  local.position[2] = startPos[2] + _rotatedAxis[2] * delta;
};

const quatMulLocal = (local: LocalTransform, axis: Axis, angle: number) => {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const c = Math.cos(half);
  const dx = axis === 'x' ? s : 0;
  const dy = axis === 'y' ? s : 0;
  const dz = axis === 'z' ? s : 0;
  const dw = c;
  const x = local.rotation[0];
  const y = local.rotation[1];
  const z = local.rotation[2];
  const w = local.rotation[3];
  local.rotation[0] = w * dx + x * dw + y * dz - z * dy;
  local.rotation[1] = w * dy - x * dz + y * dw + z * dx;
  local.rotation[2] = w * dz + x * dy - y * dx + z * dw;
  local.rotation[3] = w * dw - x * dx - y * dy - z * dz;
  q4Normalize(local.rotation, local.rotation);
};

const rayPlaneHit = (
  out: Vec3,
  rayO: Vec3,
  rayD: Vec3,
  planeO: Vec3,
  planeN: Vec3,
): boolean => {
  const denom = rayD[0] * planeN[0] + rayD[1] * planeN[1] + rayD[2] * planeN[2];
  if (Math.abs(denom) < 1e-8) return false;
  const t =
    ((planeO[0] - rayO[0]) * planeN[0] +
      (planeO[1] - rayO[1]) * planeN[1] +
      (planeO[2] - rayO[2]) * planeN[2]) /
    denom;
  if (t < 0) return false;
  out[0] = rayO[0] + rayD[0] * t;
  out[1] = rayO[1] + rayD[1] * t;
  out[2] = rayO[2] + rayD[2] * t;
  return true;
};

const ringAngleAt = (hit: Vec3, center: Vec3, axis: Axis, frame: GizmoFrame): number => {
  const dx = hit[0] - center[0];
  const dy = hit[1] - center[1];
  const dz = hit[2] - center[2];
  const t = axis === 'x' ? frame.y : axis === 'y' ? frame.z : frame.x;
  const b = axis === 'x' ? frame.z : axis === 'y' ? frame.x : frame.y;
  return Math.atan2(dx * b[0] + dy * b[1] + dz * b[2], dx * t[0] + dy * t[1] + dz * t[2]);
};

const axisPlaneNormal = (out: Vec3, dir: Vec3, origin: Vec3, cam: Vec3) => {
  const toCamX = cam[0] - origin[0];
  const toCamY = cam[1] - origin[1];
  const toCamZ = cam[2] - origin[2];
  const cx = dir[1] * toCamZ - dir[2] * toCamY;
  const cy = dir[2] * toCamX - dir[0] * toCamZ;
  const cz = dir[0] * toCamY - dir[1] * toCamX;
  const nx = cy * dir[2] - cz * dir[1];
  const ny = cz * dir[0] - cx * dir[2];
  const nz = cx * dir[1] - cy * dir[0];
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-6) {
    out[0] = Math.abs(dir[1]) < 0.9 ? 0 : 1;
    out[1] = Math.abs(dir[1]) < 0.9 ? 1 : 0;
    out[2] = 0;
    return out;
  }
  out[0] = nx / len;
  out[1] = ny / len;
  out[2] = nz / len;
  return out;
};

const projectRayOntoAxis = (
  rayO: Vec3,
  rayD: Vec3,
  origin: Vec3,
  dir: Vec3,
  cam: Vec3,
  planeN: Vec3,
  hit: Vec3,
): number | null => {
  axisPlaneNormal(planeN, dir, origin, cam);
  if (!rayPlaneHit(hit, rayO, rayD, origin, planeN)) return null;
  return (hit[0] - origin[0]) * dir[0] + (hit[1] - origin[1]) * dir[1] + (hit[2] - origin[2]) * dir[2];
};

type DragState = {
  axis: Axis;
  mode: PropEditorTransformMode;
  moveOrientation: ConstructGizmoMoveOrientation;
  partId: string;
  axisSign: 1 | -1;
  startLocalPos: [number, number, number];
  startLocalScale: [number, number, number];
  startLocalRot: [number, number, number, number];
  startWorldOrigin: [number, number, number];
  modelCenter: [number, number, number];
  startPivotParent: [number, number, number];
  startAxisT: number;
  startAngle: number;
  pointerId: number;
  frameX: [number, number, number];
  frameY: [number, number, number];
  frameZ: [number, number, number];
};

export type ConstructGizmoInputController = {
  isDragging: () => boolean;
  getActiveAxis: () => Axis | null;
  setSelectionVisible: (visible: boolean) => void;
  destroy: () => void;
};

export const installConstructGizmoInput = (
  registry: Registry,
  pipeline: RenderPipeline,
  canvas: HTMLCanvasElement,
  isActive: () => boolean,
  getDocument: () => PropDocument,
  setDocument: (doc: PropDocument) => void,
  onPartLocalCommit?: (partId: string, local: LocalTransform) => void,
): ConstructGizmoInputController => {
  const _rayO = v3();
  const _rayD = v3();
  const _axisD = v3();
  const _hit = v3();
  const _planeN = v3();

  let drag: DragState | null = null;
  let hoverAxis: Axis | null = null;
  let pointerOverCanvas = false;

  const beginDrag = (
    e: PointerEvent,
    axis: Axis,
    mode: PropEditorTransformMode,
    moveOrientation: ConstructGizmoMoveOrientation,
    partId: string,
    origin: Vec3,
    axisSign: 1 | -1,
    frame: GizmoFrame,
  ) => {
    const selected = findEditableTarget(registry, partId);
    const local = selected?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
    if (!selected || !local) return;

    unprojectScreenRay(_rayO, _rayD, e.clientX, e.clientY, canvas, pipeline.camera.viewProj, pipeline.camera.position);
    const dir = frameAxis(frame, axis);
    _axisD[0] = dir[0];
    _axisD[1] = dir[1];
    _axisD[2] = dir[2];

    let startAxisT = 0;
    let startAngle = 0;
    if (mode === 'rotate') {
      if (rayPlaneHit(_hit, _rayO, _rayD, origin, _axisD)) {
        startAngle = ringAngleAt(_hit, origin, axis, frame);
      }
    } else {
      const t = projectRayOntoAxis(
        _rayO,
        _rayD,
        origin,
        _axisD,
        pipeline.camera.position,
        _planeN,
        _hit,
      );
      startAxisT = t ?? 0;
    }

    const modelCenter = partModelSpaceCenter(v3(), selected);
    const pivotParent = localPivotFromTransform(v3(), local, modelCenter);

    drag = {
      axis,
      mode,
      moveOrientation,
      partId,
      axisSign,
      startLocalPos: [local.position[0], local.position[1], local.position[2]],
      startLocalScale: [local.scale[0], local.scale[1], local.scale[2]],
      startLocalRot: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
      startWorldOrigin: [origin[0], origin[1], origin[2]],
      modelCenter: [modelCenter[0], modelCenter[1], modelCenter[2]],
      startPivotParent: [pivotParent[0], pivotParent[1], pivotParent[2]],
      startAxisT,
      startAngle,
      pointerId: e.pointerId,
      frameX: [frame.x[0], frame.x[1], frame.x[2]],
      frameY: [frame.y[0], frame.y[1], frame.y[2]],
      frameZ: [frame.z[0], frame.z[1], frame.z[2]],
    };

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
    }
  };

  const applyDrag = (e: PointerEvent) => {
    if (!drag) return;
    const selected = findEditableTarget(registry, drag.partId);
    const local = selected?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
    if (!selected || !local) return;

    const origin = v3(drag.startWorldOrigin[0], drag.startWorldOrigin[1], drag.startWorldOrigin[2]);
    const modelCenter = v3(drag.modelCenter[0], drag.modelCenter[1], drag.modelCenter[2]);
    const pivotParent = v3(
      drag.startPivotParent[0],
      drag.startPivotParent[1],
      drag.startPivotParent[2],
    );

    unprojectScreenRay(_rayO, _rayD, e.clientX, e.clientY, canvas, pipeline.camera.viewProj, pipeline.camera.position);

    const dragFrame: GizmoFrame = {
      x: v3(drag.frameX[0], drag.frameX[1], drag.frameX[2]),
      y: v3(drag.frameY[0], drag.frameY[1], drag.frameY[2]),
      z: v3(drag.frameZ[0], drag.frameZ[1], drag.frameZ[2]),
      rot: m4(),
    };
    setRotationMatFromAxes(dragFrame.rot, dragFrame.x, dragFrame.y, dragFrame.z);
    const dir = frameAxis(dragFrame, drag.axis);
    _axisD[0] = dir[0];
    _axisD[1] = dir[1];
    _axisD[2] = dir[2];

    local.position[0] = drag.startLocalPos[0];
    local.position[1] = drag.startLocalPos[1];
    local.position[2] = drag.startLocalPos[2];
    local.scale[0] = drag.startLocalScale[0];
    local.scale[1] = drag.startLocalScale[1];
    local.scale[2] = drag.startLocalScale[2];
    local.rotation[0] = drag.startLocalRot[0];
    local.rotation[1] = drag.startLocalRot[1];
    local.rotation[2] = drag.startLocalRot[2];
    local.rotation[3] = drag.startLocalRot[3];

    const snap = e.shiftKey;

    if (drag.mode === 'rotate') {
      if (rayPlaneHit(_hit, _rayO, _rayD, origin, _axisD)) {
        const angle = ringAngleAt(_hit, origin, drag.axis, dragFrame);
        let delta = angle - drag.startAngle;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        if (snap) delta = snapToIncrement(delta, SHIFT_ROTATE_SNAP);
        quatMulLocal(local, drag.axis, delta);
        setLocalPositionForPivot(local, pivotParent, modelCenter);
      }
    } else {
      const tNow = projectRayOntoAxis(
        _rayO,
        _rayD,
        origin,
        _axisD,
        pipeline.camera.position,
        _planeN,
        _hit,
      );
      if (tNow !== null) {
        const rawDelta = tNow - drag.startAxisT;
        const i = axisIndex(drag.axis);
        if (drag.mode === 'move') {
          if (drag.moveOrientation === 'world') {
            const next = drag.startLocalPos[i] + rawDelta;
            local.position[i] = snap ? snapToIncrement(next, SHIFT_SNAP) : next;
          } else {
            const delta = snap ? snapToIncrement(rawDelta, SHIFT_SNAP) : rawDelta;
            applyLocalAxisMove(local, drag.startLocalPos, drag.startLocalRot, drag.axis, delta);
          }
        } else {
          const next = Math.max(0.05, drag.startLocalScale[i] + rawDelta * drag.axisSign);
          local.scale[i] = snap ? Math.max(0.05, snapToIncrement(next, SHIFT_SNAP)) : next;
          setLocalPositionForPivot(local, pivotParent, modelCenter);
        }
      }
    }

    syncPartWorld(registry, selected);
    commitPartLocal(drag.partId, local, getDocument, setDocument, onPartLocalCommit);
  };

  const endDrag = (e: PointerEvent) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const selected = findEditableTarget(registry, drag.partId);
    const local = selected?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
    if (local) commitPartLocal(drag.partId, local, getDocument, setDocument, onPartLocalCommit);
    drag = null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!isActive()) return;
    if (e.button !== 0) return;
    if (e.metaKey) return;

    const ctx = resolveGizmoSelection(registry, pipeline);
    if (!ctx) return;

    const scale = gizmoWorldScale();
    const axis = pickHandle(pipeline, canvas, e.clientX, e.clientY, ctx.origin, ctx.mode, scale, ctx.signs, ctx.frame);
    if (!axis) return;
    if (ctx.allowedAxes && !ctx.allowedAxes.includes(axis)) return;

    e.preventDefault();
    e.stopPropagation();
    beginDrag(e, axis, ctx.mode, ctx.moveOrientation, ctx.targetId, ctx.origin, ctx.signs[axis], ctx.frame);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (drag) return;

    if (!isActive() || !pointerOverCanvas) {
      hoverAxis = null;
      return;
    }

    const ctx = resolveGizmoSelection(registry, pipeline);
    if (!ctx) {
      hoverAxis = null;
      return;
    }

    const scale = gizmoWorldScale();
    const axis = pickHandle(pipeline, canvas, e.clientX, e.clientY, ctx.origin, ctx.mode, scale, ctx.signs, ctx.frame);
    hoverAxis = axis && (!ctx.allowedAxes || ctx.allowedAxes.includes(axis)) ? axis : null;
  };

  const onWindowPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;
    applyDrag(e);
  };

  const onPointerUp = (e: PointerEvent) => endDrag(e);
  const onPointerCancel = (e: PointerEvent) => endDrag(e);
  const onPointerEnter = () => {
    pointerOverCanvas = true;
  };
  const onPointerLeave = () => {
    pointerOverCanvas = false;
    if (!drag) hoverAxis = null;
  };

  canvas.addEventListener('pointerdown', onPointerDown, true);
  canvas.addEventListener('pointerenter', onPointerEnter);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointermove', onWindowPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  return {
    isDragging: () => drag !== null,
    getActiveAxis: () => drag?.axis ?? hoverAxis,
    setSelectionVisible: (visible: boolean) => {
      if (!visible && !drag) hoverAxis = null;
    },
    destroy: () => {
      canvas.removeEventListener('pointerdown', onPointerDown, true);
      canvas.removeEventListener('pointerenter', onPointerEnter);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    },
  };
};
