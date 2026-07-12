import {
  type BoneAttachment,
  type Entity,
  type Mat4,
  type Registry,
  type SkeletalModel,
  type Transform,
  type Vec3,
  m4,
  m4Copy,
  m4Mul,
  updateWorldMatrix,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { type Axis, CUBE_HALF, SHAFT_LEN } from './meshes.ts';
import { type ConstructGizmoMoveOrientation } from './gizmoMode.ts';
import { type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import { partModelSpaceCenter, worldFromModelPoint } from '../propEditor/partPivot.ts';

const GIZMO_SCALE = 1;

export type GizmoFrame = {
  x: Vec3;
  y: Vec3;
  z: Vec3;
  rot: Mat4;
};

export const createWorldGizmoFrame = (): GizmoFrame => ({
  x: v3(1, 0, 0),
  y: v3(0, 1, 0),
  z: v3(0, 0, 1),
  rot: m4(),
});

export const normalizeAxis = (out: Vec3, x: number, y: number, z: number) => {
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

export const setRotationMatFromAxes = (out: Mat4, x: Vec3, y: Vec3, z: Vec3) => {
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

export const extractFrameAxes = (frame: GizmoFrame, world: Mat4) => {
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

export const boneWorldForAttachment = (
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

export const resolveGizmoFrame = (
  _registry: Registry,
  selected: Entity | null,
  moveOrientation: ConstructGizmoMoveOrientation = 'local',
  mode: PropEditorTransformMode = 'move',
): GizmoFrame => {
  if (mode === 'move' && moveOrientation === 'world') return createWorldGizmoFrame();

  const frame = createWorldGizmoFrame();
  if (!selected) return frame;

  const t = selected.components[COMPONENT_KEYS.transform] as Transform | undefined;
  if (t && extractFrameAxes(frame, t.world)) return frame;

  return createWorldGizmoFrame();
};

export const frameAxis = (frame: GizmoFrame, axis: Axis) =>
  axis === 'x' ? frame.x : axis === 'y' ? frame.y : frame.z;

export const gizmoOriginForPart = (out: Vec3, entity: Entity, transform: Transform) => {
  const modelCenter = partModelSpaceCenter(v3(), entity);
  return worldFromModelPoint(out, transform.world, modelCenter);
};

export const gizmoWorldScale = () => GIZMO_SCALE;

export const shaftEndDistance = (gizmoScale: number) => SHAFT_LEN * gizmoScale;

export const tipAnchor = (mode: 'move' | 'rotate' | 'scale', gizmoScale: number) => {
  const shaftEnd = shaftEndDistance(gizmoScale);
  if (mode === 'scale') return shaftEnd + CUBE_HALF * gizmoScale;
  return shaftEnd;
};

export const axisSignTowardCamera = (
  camPos: Vec3,
  origin: Vec3,
  axis: Axis,
  frame: GizmoFrame,
): 1 | -1 => {
  const dir = frameAxis(frame, axis);
  const toCamX = camPos[0] - origin[0];
  const toCamY = camPos[1] - origin[1];
  const toCamZ = camPos[2] - origin[2];
  const dot = toCamX * dir[0] + toCamY * dir[1] + toCamZ * dir[2];
  return dot >= 0 ? 1 : -1;
};

export const currentSigns = (
  camPos: Vec3,
  origin: Vec3,
  frame: GizmoFrame,
): Record<Axis, 1 | -1> => ({
  x: axisSignTowardCamera(camPos, origin, 'x', frame),
  y: axisSignTowardCamera(camPos, origin, 'y', frame),
  z: axisSignTowardCamera(camPos, origin, 'z', frame),
});
