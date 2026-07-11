import {
  type Registry,
  type Material,
  type Transform,
  type LocalTransform,
  type RenderPipeline,
  type Mat4,
  type Vec3,
  type Quat,
  type Entity,
  type BoneAttachment,
  type SkeletalModel,
  destroyMesh,
  m4,
  m4Invert,
  m4FromTRS,
  m4FromTRSQuat,
  m4Copy,
  m4Mul,
  updateWorldMatrix,
  q4,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ConstructPropSelection } from '../propEditor/propSelection.ts';
import { type ConstructGizmoMode } from './gizmoMode.ts';
import { type ConstructGizmoHandle } from './gizmoHandle.ts';
import { type ConstructPropPart } from '../propEditor/propPart.ts';
import { type ConstructActorAttachment } from '../actorEditor/actorAttachment.ts';
import { type PropDocument, type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import { syncPartLocalToWorld } from '../propEditor/syncPartLocal.ts';
import { syncAttachmentOffsetFromLocal } from '../actorEditor/spawnActorEditor.ts';
import {
  localPivotFromTransform,
  partModelSpaceCenter,
  setLocalPositionForPivot,
  worldFromModelPoint,
} from '../propEditor/partPivot.ts';
import {
  type Axis,
  AXIS_COLORS,
  AXIS_COLORS_HOVER,
  CUBE_HALF,
  CONE_HEIGHT,
  RING_RADIUS,
  SHAFT_LEN,
  SHAFT_TIP_OVERLAP,
} from './meshes.ts';
import { createMoveGizmoMeshes, spawnMoveGizmo, type MoveGizmoHandleRef } from './move.ts';
import { createRotateGizmoMeshes, spawnRotateGizmo, type RotateGizmoHandleRef } from './rotate.ts';
import { createScaleGizmoMeshes, spawnScaleGizmo, type ScaleGizmoHandleRef } from './scale.ts';

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

const SHAFT_PICK_PX = 12;
const TIP_COLLIDER_HALF = 0.12;
const GIZMO_SCALE = 1;
const RING_SEGMENTS = 48;
const RING_SEGMENT_PICK_PX = 10;
const SHIFT_SNAP = 0.1;
const SHIFT_ROTATE_SNAP = (15 * Math.PI) / 180;

const snapToIncrement = (value: number, increment: number) =>
  Math.round(value / increment) * increment;

const findSelectedPart = (registry: Registry, partId: string | null) => {
  if (!partId) return null;

  for (const e of registry.view(CONSTRUCT_KEYS.propPart)) {
    const part = e.components[CONSTRUCT_KEYS.propPart] as ConstructPropPart | undefined;
    if (part?.partId === partId) return e;
  }

  for (const e of registry.view(CONSTRUCT_KEYS.actorAttachment)) {
    const att = e.components[CONSTRUCT_KEYS.actorAttachment] as ConstructActorAttachment | undefined;
    const part = e.components[CONSTRUCT_KEYS.propPart] as ConstructPropPart | undefined;
    if (att?.attachmentId === partId || part?.partId === partId) return e;
  }

  return null;
};

const gizmoOriginForPart = (out: Vec3, entity: Entity, transform: Transform) => {
  const modelCenter = partModelSpaceCenter(v3(), entity);
  return worldFromModelPoint(out, transform.world, modelCenter);
};

const axisIndex = (axis: Axis) => (axis === 'x' ? 0 : axis === 'y' ? 1 : 2);

const quatMulLocal = (local: LocalTransform, axis: Axis, angle: number) => {
  const half = angle * 0.5;
  const s = Math.sin(half);
  const c = Math.cos(half);
  const qx = axis === 'x' ? s : 0;
  const qy = axis === 'y' ? s : 0;
  const qz = axis === 'z' ? s : 0;
  const qw = c;
  const x = local.rotation[0];
  const y = local.rotation[1];
  const z = local.rotation[2];
  const w = local.rotation[3];
  local.rotation[0] = qw * x + qx * w + qy * z - qz * y;
  local.rotation[1] = qw * y - qx * z + qy * w + qz * x;
  local.rotation[2] = qw * z + qx * y - qy * x + qz * w;
  local.rotation[3] = qw * w - qx * x - qy * y - qz * z;
};

const syncPartWorld = (registry: Registry, selected: Entity) => {
  const boneAtt = selected.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
  if (boneAtt) {
    syncAttachmentOffsetFromLocal(selected);

    const childOf = selected.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
    const t = selected.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (!childOf || !t) return;

    const parent = registry.get(childOf.parentId);
    const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;
    const parentModel = parent?.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
    if (!parentT || !parentModel) return;

    const boneNode = parentModel.bodyScene.nodes[boneAtt.boneNodeIndex];
    if (!boneNode) return;

    updateWorldMatrix(parentT);

    const renderRoot = m4();
    const boneWorld = m4();
    m4Copy(renderRoot, parentT.world);
    renderRoot[13]! += parentModel.visualYOffset;
    m4Mul(boneWorld, renderRoot, boneNode.worldM);
    m4Mul(t.world, boneWorld, boneAtt.localOffset);
    t.dirty = false;
    return;
  }

  syncPartLocalToWorld(registry, selected);
};

const writePartToDocument = (
  doc: PropDocument,
  partId: string,
  local: LocalTransform,
): PropDocument => ({
  ...doc,
  parts: doc.parts.map((part) => {
    if (part.id !== partId) return part;
    return {
      ...part,
      position: [local.position[0], local.position[1], local.position[2]],
      rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
      scale: [local.scale[0], local.scale[1], local.scale[2]],
    };
  }),
});

const commitPartLocal = (
  partId: string,
  local: LocalTransform,
  getDocument: () => PropDocument,
  setDocument: (doc: PropDocument) => void,
  onPartLocalCommit?: (partId: string, local: LocalTransform) => void,
) => {
  if (onPartLocalCommit) {
    onPartLocalCommit(partId, local);
    return;
  }

  setDocument(writePartToDocument(getDocument(), partId, local));
};

const projectWorldToScreen = (
  out: { x: number; y: number; behind: boolean },
  world: Vec3,
  viewProj: Mat4,
  canvas: HTMLCanvasElement,
) => {
  const x = world[0];
  const y = world[1];
  const z = world[2];
  const clipX = viewProj[0]! * x + viewProj[4]! * y + viewProj[8]! * z + viewProj[12]!;
  const clipY = viewProj[1]! * x + viewProj[5]! * y + viewProj[9]! * z + viewProj[13]!;
  const clipW = viewProj[3]! * x + viewProj[7]! * y + viewProj[11]! * z + viewProj[15]!;
  if (Math.abs(clipW) < 1e-8) {
    out.behind = true;
    return out;
  }
  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;
  const rect = canvas.getBoundingClientRect();
  out.x = (ndcX * 0.5 + 0.5) * rect.width + rect.left;
  out.y = (1 - (ndcY * 0.5 + 0.5)) * rect.height + rect.top;
  out.behind = clipW < 0;
  return out;
};

const unprojectScreenRay = (
  outOrigin: Vec3,
  outDir: Vec3,
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  viewProj: Mat4,
  cameraPos: Vec3,
) => {
  const inv = m4();
  m4Invert(inv, viewProj);
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  const ndcY = 1 - ((clientY - rect.top) / Math.max(rect.height, 1)) * 2;

  const farX = inv[0]! * ndcX + inv[4]! * ndcY + inv[8]! * 1 + inv[12]!;
  const farY = inv[1]! * ndcX + inv[5]! * ndcY + inv[9]! * 1 + inv[13]!;
  const farZ = inv[2]! * ndcX + inv[6]! * ndcY + inv[10]! * 1 + inv[14]!;
  const farW = inv[3]! * ndcX + inv[7]! * ndcY + inv[11]! * 1 + inv[15]!;
  const invW = 1 / Math.max(Math.abs(farW), 1e-8) * Math.sign(farW || 1);
  const fx = farX * invW;
  const fy = farY * invW;
  const fz = farZ * invW;

  outOrigin[0] = cameraPos[0];
  outOrigin[1] = cameraPos[1];
  outOrigin[2] = cameraPos[2];
  outDir[0] = fx - cameraPos[0];
  outDir[1] = fy - cameraPos[1];
  outDir[2] = fz - cameraPos[2];
  const len = Math.hypot(outDir[0], outDir[1], outDir[2]) || 1;
  outDir[0] /= len;
  outDir[1] /= len;
  outDir[2] /= len;
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

type GizmoFrame = {
  x: Vec3;
  y: Vec3;
  z: Vec3;
  rot: Mat4;
};

const createWorldGizmoFrame = (): GizmoFrame => ({
  x: v3(1, 0, 0),
  y: v3(0, 1, 0),
  z: v3(0, 0, 1),
  rot: m4(),
});

const normalizeAxis = (out: Vec3, x: number, y: number, z: number) => {
  const len = Math.hypot(x, y, z);
  if (len < 1e-8) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return out;
  }
  const inv = 1 / len;
  out[0] = x * inv;
  out[1] = y * inv;
  out[2] = z * inv;
  return out;
};

const setRotationMatFromAxes = (out: Mat4, x: Vec3, y: Vec3, z: Vec3) => {
  out[0] = x[0];
  out[1] = x[1];
  out[2] = x[2];
  out[3] = 0;
  out[4] = y[0];
  out[5] = y[1];
  out[6] = y[2];
  out[7] = 0;
  out[8] = z[0];
  out[9] = z[1];
  out[10] = z[2];
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
};

const boneWorldForAttachment = (
  out: Mat4,
  registry: Registry,
  selected: Entity,
  boneAtt: BoneAttachment,
) => {
  const childOf = selected.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  if (!childOf) return null;

  const parent = registry.get(childOf.parentId);
  const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;
  const parentModel = parent?.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  if (!parentT || !parentModel) return null;

  const boneNode = parentModel.bodyScene.nodes[boneAtt.boneNodeIndex];
  if (!boneNode) return null;

  updateWorldMatrix(parentT);
  const renderRoot = m4();
  m4Copy(renderRoot, parentT.world);
  renderRoot[13]! += parentModel.visualYOffset;
  m4Mul(out, renderRoot, boneNode.worldM);
  return out;
};

const extractFrameAxes = (frame: GizmoFrame, world: Mat4) => {
  normalizeAxis(frame.x, world[0]!, world[1]!, world[2]!);
  normalizeAxis(frame.y, world[4]!, world[5]!, world[6]!);
  normalizeAxis(frame.z, world[8]!, world[9]!, world[10]!);

  if (
    Math.hypot(frame.x[0], frame.x[1], frame.x[2]) < 0.5 ||
    Math.hypot(frame.y[0], frame.y[1], frame.y[2]) < 0.5 ||
    Math.hypot(frame.z[0], frame.z[1], frame.z[2]) < 0.5
  ) {
    return false;
  }

  setRotationMatFromAxes(frame.rot, frame.x, frame.y, frame.z);
  return true;
};

const resolveGizmoFrame = (registry: Registry, selected: Entity | null): GizmoFrame => {
  const frame = createWorldGizmoFrame();
  if (!selected) return frame;

  const boneAtt = selected.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
  if (!boneAtt) return frame;

  const t = selected.components[COMPONENT_KEYS.transform] as Transform | undefined;
  if (t) {
    const invOffset = m4();
    const boneWorld = m4();
    m4Invert(invOffset, boneAtt.localOffset);
    m4Mul(boneWorld, t.world, invOffset);
    if (extractFrameAxes(frame, boneWorld)) return frame;
  }

  const boneWorld = m4();
  if (!boneWorldForAttachment(boneWorld, registry, selected, boneAtt)) return createWorldGizmoFrame();
  if (!extractFrameAxes(frame, boneWorld)) return createWorldGizmoFrame();
  return frame;
};

const frameAxis = (frame: GizmoFrame, axis: Axis) =>
  axis === 'x' ? frame.x : axis === 'y' ? frame.y : frame.z;

const ringAngleAt = (
  hit: Vec3,
  center: Vec3,
  axis: Axis,
  frame: GizmoFrame,
): number => {
  const dx = hit[0] - center[0];
  const dy = hit[1] - center[1];
  const dz = hit[2] - center[2];
  const t = axis === 'x' ? frame.y : axis === 'y' ? frame.z : frame.x;
  const b = axis === 'x' ? frame.z : axis === 'y' ? frame.x : frame.y;
  return Math.atan2(dx * b[0] + dy * b[1] + dz * b[2], dx * t[0] + dy * t[1] + dz * t[2]);
};

type DragState = {
  axis: Axis;
  mode: PropEditorTransformMode;
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

export type ConstructGizmoController = {
  isDragging: () => boolean;
  destroy: () => void;
};

type HandleRef = {
  id: number;
  axis: Axis;
  role: HandleRole;
  gizmo: 'move' | 'rotate' | 'scale';
};

export const installConstructGizmoSystem = (
  gl: WebGL2RenderingContext,
  registry: Registry,
  pipeline: RenderPipeline,
  canvas: HTMLCanvasElement,
  getDocument: () => PropDocument,
  setDocument: (doc: PropDocument) => void,
  isActive: () => boolean,
  onPartLocalCommit?: (partId: string, local: LocalTransform) => void,
): ConstructGizmoController => {
  const moveMeshes = createMoveGizmoMeshes(gl);
  const rotateMeshes = createRotateGizmoMeshes(gl);
  const scaleMeshes = createScaleGizmoMeshes(gl);

  let moveHandles: MoveGizmoHandleRef[] = [];
  let rotateHandles: RotateGizmoHandleRef[] = [];
  let scaleHandles: ScaleGizmoHandleRef[] = [];
  let handles: HandleRef[] = [];

  const _screen = { x: 0, y: 0, behind: false };
  const _screenB = { x: 0, y: 0, behind: false };
  const _rayO = v3();
  const _rayD = v3();
  const _axisD = v3();
  const _hit = v3();
  const _tipWorld = v3();
  const _ringA = v3();
  const _ringB = v3();
  const _planeN = v3();

  let drag: DragState | null = null;
  let hoverAxis: Axis | null = null;
  let pointerOverCanvas = false;

  const rebuildHandleList = () => {
    handles = [
      ...moveHandles.map((h) => ({ ...h, gizmo: 'move' as const })),
      ...rotateHandles.map((h) => ({ ...h, gizmo: 'rotate' as const })),
      ...scaleHandles.map((h) => ({ ...h, gizmo: 'scale' as const })),
    ];
  };

  const ensureHandles = () => {
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
        const ref = { id: e.id, axis: h.axis, role: h.role };
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
        void ref;
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

  const setHandleHighlight = (
    material: Material,
    axis: Axis,
    highlighted: boolean,
  ) => {
    const color = highlighted ? AXIS_COLORS_HOVER[axis] : AXIS_COLORS[axis];
    material.baseColorFactor[0] = color[0];
    material.baseColorFactor[1] = color[1];
    material.baseColorFactor[2] = color[2];
    material.baseColorFactor[3] = color[3];
  };

  const axisSignTowardCamera = (origin: Vec3, axis: Axis, frame: GizmoFrame): 1 | -1 => {
    const dir = frameAxis(frame, axis);
    const cam = pipeline.camera.position;
    const toCamX = cam[0] - origin[0];
    const toCamY = cam[1] - origin[1];
    const toCamZ = cam[2] - origin[2];
    const dot = toCamX * dir[0] + toCamY * dir[1] + toCamZ * dir[2];
    return dot >= 0 ? 1 : -1;
  };

  const shaftEndDistance = (gizmoScale: number) => SHAFT_LEN * gizmoScale;

  const tipAnchor = (mode: PropEditorTransformMode, gizmoScale: number) => {
    const shaftEnd = shaftEndDistance(gizmoScale);
    if (mode === 'scale') return shaftEnd + CUBE_HALF * gizmoScale;
    return shaftEnd;
  };

  const _handleLocal = m4();
  const _frameAtOrigin = m4();
  const _localPos = v3();

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

  const gizmoWorldScale = () => GIZMO_SCALE;

  const tipColliderCenter = (
    out: Vec3,
    origin: Vec3,
    axis: Axis,
    scale: number,
    mode: PropEditorTransformMode,
    sign: 1 | -1,
    frame: GizmoFrame,
  ) => {
    const dir = frameAxis(frame, axis);
    const shaftEnd = shaftEndDistance(scale);
    const along =
      mode === 'scale'
        ? (shaftEnd + CUBE_HALF * scale) * sign
        : (shaftEnd + CONE_HEIGHT * 0.5 * scale) * sign;
    out[0] = origin[0] + dir[0] * along;
    out[1] = origin[1] + dir[1] * along;
    out[2] = origin[2] + dir[2] * along;
  };

  const shaftEndWorldPos = (
    out: Vec3,
    origin: Vec3,
    axis: Axis,
    scale: number,
    sign: 1 | -1,
    frame: GizmoFrame,
  ) => {
    const dir = frameAxis(frame, axis);
    const along = Math.max(0.05, shaftEndDistance(scale) + SHAFT_TIP_OVERLAP * scale) * sign;
    out[0] = origin[0] + dir[0] * along;
    out[1] = origin[1] + dir[1] * along;
    out[2] = origin[2] + dir[2] * along;
  };

  const ringPoint = (
    out: Vec3,
    origin: Vec3,
    axis: Axis,
    angle: number,
    radius: number,
    frame: GizmoFrame,
  ) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = axis === 'x' ? frame.y : axis === 'y' ? frame.z : frame.x;
    const b = axis === 'x' ? frame.z : axis === 'y' ? frame.x : frame.y;
    out[0] = origin[0] + t[0] * c * radius + b[0] * s * radius;
    out[1] = origin[1] + t[1] * c * radius + b[1] * s * radius;
    out[2] = origin[2] + t[2] * c * radius + b[2] * s * radius;
  };

  const distToScreenSegment = (
    clientX: number,
    clientY: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ) => {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = clientX - ax;
    const apy = clientY - ay;
    const abLen2 = abx * abx + aby * aby;
    if (abLen2 < 1e-8) return Math.hypot(apx, apy);
    let t = (apx * abx + apy * aby) / abLen2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return Math.hypot(clientX - cx, clientY - cy);
  };

  const tipCubeScreenHit = (
    clientX: number,
    clientY: number,
    tipCenter: Vec3,
    half: number,
  ): number | null => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let any = false;

    for (let ix = -1; ix <= 1; ix += 2) {
      for (let iy = -1; iy <= 1; iy += 2) {
        for (let iz = -1; iz <= 1; iz += 2) {
          _hit[0] = tipCenter[0] + ix * half;
          _hit[1] = tipCenter[1] + iy * half;
          _hit[2] = tipCenter[2] + iz * half;
          projectWorldToScreen(_screen, _hit, pipeline.camera.viewProj, canvas);
          if (_screen.behind) continue;
          any = true;
          if (_screen.x < minX) minX = _screen.x;
          if (_screen.y < minY) minY = _screen.y;
          if (_screen.x > maxX) maxX = _screen.x;
          if (_screen.y > maxY) maxY = _screen.y;
        }
      }
    }

    if (!any) return null;

    const pad = 4;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    if (clientX < minX || clientX > maxX || clientY < minY || clientY > maxY) return null;

    projectWorldToScreen(_screen, tipCenter, pipeline.camera.viewProj, canvas);
    if (_screen.behind) return null;
    return Math.hypot(_screen.x - clientX, _screen.y - clientY);
  };

  const pickHandle = (
    clientX: number,
    clientY: number,
    origin: Vec3,
    mode: PropEditorTransformMode,
    scale: number,
    signs: Record<Axis, 1 | -1>,
    frame: GizmoFrame,
  ): Axis | null => {
    let bestAxis: Axis | null = null;
    let bestScore = Infinity;

    if (mode === 'rotate') {
      const cam = pipeline.camera.position;

      for (const axis of ['x', 'y', 'z'] as const) {
        let bestSegDist = Infinity;
        let bestSegDepth = Infinity;
        const ringR = RING_RADIUS * scale;

        for (let i = 0; i < RING_SEGMENTS; i++) {
          const a0 = (i / RING_SEGMENTS) * Math.PI * 2;
          const a1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2;
          ringPoint(_ringA, origin, axis, a0, ringR, frame);
          ringPoint(_ringB, origin, axis, a1, ringR, frame);
          projectWorldToScreen(_screen, _ringA, pipeline.camera.viewProj, canvas);
          projectWorldToScreen(_screenB, _ringB, pipeline.camera.viewProj, canvas);
          if (_screen.behind || _screenB.behind) continue;

          const segDist = distToScreenSegment(
            clientX,
            clientY,
            _screen.x,
            _screen.y,
            _screenB.x,
            _screenB.y,
          );
          if (segDist > RING_SEGMENT_PICK_PX) continue;

          const mx = (_ringA[0] + _ringB[0]) * 0.5;
          const my = (_ringA[1] + _ringB[1]) * 0.5;
          const mz = (_ringA[2] + _ringB[2]) * 0.5;
          const depth =
            (mx - cam[0]) * (mx - cam[0]) +
            (my - cam[1]) * (my - cam[1]) +
            (mz - cam[2]) * (mz - cam[2]);

          if (segDist < bestSegDist - 0.25 || (Math.abs(segDist - bestSegDist) <= 0.25 && depth < bestSegDepth)) {
            bestSegDist = segDist;
            bestSegDepth = depth;
          }
        }

        if (bestSegDist === Infinity) continue;

        const score = bestSegDepth + bestSegDist * 0.01;
        if (score < bestScore) {
          bestScore = score;
          bestAxis = axis;
        }
      }
      return bestAxis;
    }

    const originScreen = { x: 0, y: 0, behind: false };
    projectWorldToScreen(originScreen, origin, pipeline.camera.viewProj, canvas);
    const tipHalf = TIP_COLLIDER_HALF * scale;

    for (const axis of ['x', 'y', 'z'] as const) {
      const sign = signs[axis];
      tipColliderCenter(_tipWorld, origin, axis, scale, mode, sign, frame);

      const tipDist = tipCubeScreenHit(clientX, clientY, _tipWorld, tipHalf);
      if (tipDist !== null && tipDist < bestScore) {
        bestScore = tipDist;
        bestAxis = axis;
      }

      shaftEndWorldPos(_hit, origin, axis, scale, sign, frame);
      projectWorldToScreen(_screen, _hit, pipeline.camera.viewProj, canvas);
      if (!originScreen.behind && !_screen.behind) {
        const shaftDist = distToScreenSegment(
          clientX,
          clientY,
          originScreen.x,
          originScreen.y,
          _screen.x,
          _screen.y,
        );
        if (shaftDist <= SHAFT_PICK_PX && shaftDist < bestScore) {
          bestScore = shaftDist;
          bestAxis = axis;
        }
      }
    }

    return bestAxis;
  };

  const beginDrag = (
    e: PointerEvent,
    axis: Axis,
    mode: PropEditorTransformMode,
    partId: string,
    origin: Vec3,
    axisSign: 1 | -1,
    frame: GizmoFrame,
  ) => {
    const selected = findSelectedPart(registry, partId);
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
    const selected = findSelectedPart(registry, drag.partId);
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
          const next = drag.startLocalPos[i] + rawDelta;
          local.position[i] = snap ? snapToIncrement(next, SHIFT_SNAP) : next;
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
    const selected = findSelectedPart(registry, drag.partId);
    const local = selected?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
    if (local) commitPartLocal(drag.partId, local, getDocument, setDocument, onPartLocalCommit);
    drag = null;
  };

  const currentSigns = (origin: Vec3, frame: GizmoFrame): Record<Axis, 1 | -1> => ({
    x: axisSignTowardCamera(origin, 'x', frame),
    y: axisSignTowardCamera(origin, 'y', frame),
    z: axisSignTowardCamera(origin, 'z', frame),
  });

  const onPointerDown = (e: PointerEvent) => {
    if (!isActive()) return;
    if (e.button !== 0) return;
    if (e.metaKey) return;

    const selEnt = registry.view(CONSTRUCT_KEYS.propSelection)[0];
    const sel = selEnt?.components[CONSTRUCT_KEYS.propSelection] as ConstructPropSelection | undefined;
    const gizmo = selEnt?.components[CONSTRUCT_KEYS.gizmoMode] as ConstructGizmoMode | undefined;
    const selected = findSelectedPart(registry, sel?.partId ?? null);
    const selectedT = selected?.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (!selected || !selectedT || !sel?.partId) return;

    const origin = gizmoOriginForPart(v3(), selected, selectedT);
    const mode = gizmo?.mode ?? 'move';
    const scale = gizmoWorldScale();
    const frame = resolveGizmoFrame(registry, selected);
    const signs = currentSigns(origin, frame);
    const axis = pickHandle(e.clientX, e.clientY, origin, mode, scale, signs, frame);
    if (!axis) return;

    e.preventDefault();
    e.stopPropagation();
    beginDrag(e, axis, mode, sel.partId, origin, signs[axis], frame);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (drag) return;

    if (!isActive() || !pointerOverCanvas) {
      hoverAxis = null;
      return;
    }

    const selEnt = registry.view(CONSTRUCT_KEYS.propSelection)[0];
    const sel = selEnt?.components[CONSTRUCT_KEYS.propSelection] as ConstructPropSelection | undefined;
    const gizmo = selEnt?.components[CONSTRUCT_KEYS.gizmoMode] as ConstructGizmoMode | undefined;
    const selected = findSelectedPart(registry, sel?.partId ?? null);
    const selectedT = selected?.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (!selected || !selectedT) {
      hoverAxis = null;
      return;
    }

    const origin = gizmoOriginForPart(v3(), selected, selectedT);
    const mode = gizmo?.mode ?? 'move';
    const scale = gizmoWorldScale();
    const frame = resolveGizmoFrame(registry, selected);
    hoverAxis = pickHandle(e.clientX, e.clientY, origin, mode, scale, currentSigns(origin, frame), frame);
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

  const removeAction = registry.addAction('update', () => {
    ensureHandles();

    const selEnt = registry.view(CONSTRUCT_KEYS.propSelection)[0];
    const sel = selEnt?.components[CONSTRUCT_KEYS.propSelection] as ConstructPropSelection | undefined;
    const gizmo = selEnt?.components[CONSTRUCT_KEYS.gizmoMode] as ConstructGizmoMode | undefined;
    const selected = findSelectedPart(registry, sel?.partId ?? null);
    const selectedT = selected?.components[COMPONENT_KEYS.transform] as Transform | undefined;
    const show = !!selectedT && !!selected;
    const mode = gizmo?.mode ?? 'move';
    const origin = show
      ? gizmoOriginForPart(v3(), selected!, selectedT!)
      : v3();
    const scale = gizmoWorldScale();
    const frame = resolveGizmoFrame(registry, selected);
    const signs = show
      ? currentSigns(origin, frame)
      : { x: 1 as const, y: 1 as const, z: 1 as const };

    if (!show || !pointerOverCanvas) {
      if (!drag) hoverAxis = null;
    }

    const activeAxis = drag?.axis ?? hoverAxis;

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

      const wantVisible =
        show &&
        ((mode === 'move' && h.gizmo === 'move') ||
          (mode === 'rotate' && h.gizmo === 'rotate') ||
          (mode === 'scale' && h.gizmo === 'scale'));

      renderable.visible = wantVisible;
      if (!wantVisible || !show) {
        setHandleHighlight(renderable.material, h.axis, false);
        continue;
      }

      setHandleHighlight(renderable.material, h.axis, activeAxis === h.axis);
      orientHandle(t, renderable.model, origin, h.axis, h.role, scale, mode, signs[h.axis], frame);
    }
  }, 25);

  return {
    isDragging: () => drag !== null,
    destroy: () => {
      removeAction();
      canvas.removeEventListener('pointerdown', onPointerDown, true);
      canvas.removeEventListener('pointerenter', onPointerEnter);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      for (const h of handles) {
        if (registry.get(h.id)) registry.deregister(h.id);
      }
      destroyMesh(gl, moveMeshes.shaft);
      destroyMesh(gl, moveMeshes.cone);
      destroyMesh(gl, rotateMeshes.ring);
      destroyMesh(gl, scaleMeshes.shaft);
      destroyMesh(gl, scaleMeshes.cube);
    },
  };
};
