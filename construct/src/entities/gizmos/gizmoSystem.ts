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
  destroyMesh,
  m4,
  m4Invert,
  m4FromTRS,
  m4FromTRSQuat,
  m4Copy,
  q4,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ConstructPropSelection } from '../propEditor/propSelection.ts';
import { type ConstructGizmoMode } from './gizmoMode.ts';
import { type ConstructGizmoHandle } from './gizmoHandle.ts';
import { type ConstructPropPart } from '../propEditor/propPart.ts';
import { type PropDocument, type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import { syncPartLocalToWorld } from '../propEditor/syncPartLocal.ts';
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
  AXIS_DIR,
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

const syncPartWorld = syncPartLocalToWorld;

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

const ringAngleAt = (
  hit: Vec3,
  center: Vec3,
  axis: Axis,
): number => {
  const dx = hit[0] - center[0];
  const dy = hit[1] - center[1];
  const dz = hit[2] - center[2];
  if (axis === 'x') return Math.atan2(dz, dy);
  if (axis === 'y') return Math.atan2(dx, dz);
  return Math.atan2(dy, dx);
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
};

const axisPlaneNormal = (out: Vec3, axis: Axis, origin: Vec3, cam: Vec3) => {
  const dir = AXIS_DIR[axis];
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
  axis: Axis,
  cam: Vec3,
  planeN: Vec3,
  hit: Vec3,
): number | null => {
  axisPlaneNormal(planeN, axis, origin, cam);
  if (!rayPlaneHit(hit, rayO, rayD, origin, planeN)) return null;
  const dir = AXIS_DIR[axis];
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

  const axisSignTowardCamera = (origin: Vec3, axis: Axis): 1 | -1 => {
    const dir = AXIS_DIR[axis];
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

  const orientHandle = (
    t: Transform,
    model: Mat4,
    origin: Vec3,
    axis: Axis,
    role: HandleRole,
    gizmoScale: number,
    mode: PropEditorTransformMode,
    sign: 1 | -1,
  ) => {
    const dir = AXIS_DIR[axis];
    if (role === 'ring') {
      t.position[0] = origin[0];
      t.position[1] = origin[1];
      t.position[2] = origin[2];
      const s = gizmoScale;
      m4FromTRSQuat(model, t.position, RING_ROT[axis], v3(s, s, s));
      m4Copy(t.world, model);
      t.dirty = false;
      return;
    }

    const rot = sign > 0 ? ROT_POS_Y_TO_AXIS[axis] : ROT_POS_Y_TO_NEG_AXIS[axis];
    const shaftEnd = shaftEndDistance(gizmoScale);

    if (role === 'shaft') {
      const length = Math.max(0.05, shaftEnd + SHAFT_TIP_OVERLAP * gizmoScale);
      const along = (length * 0.5) * sign;
      t.position[0] = origin[0] + dir[0] * along;
      t.position[1] = origin[1] + dir[1] * along;
      t.position[2] = origin[2] + dir[2] * along;
      m4FromTRSQuat(model, t.position, rot, v3(gizmoScale, length, gizmoScale));
      m4Copy(t.world, model);
      t.dirty = false;
      return;
    }

    const along = tipAnchor(mode, gizmoScale) * sign;
    t.position[0] = origin[0] + dir[0] * along;
    t.position[1] = origin[1] + dir[1] * along;
    t.position[2] = origin[2] + dir[2] * along;
    const s = gizmoScale;
    if (mode === 'scale') {
      m4FromTRS(model, t.position, 0, v3(s, s, s));
    } else {
      m4FromTRSQuat(model, t.position, rot, v3(s, s, s));
    }
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
  ) => {
    const dir = AXIS_DIR[axis];
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
  ) => {
    const dir = AXIS_DIR[axis];
    const along = Math.max(0.05, shaftEndDistance(scale) + SHAFT_TIP_OVERLAP * scale) * sign;
    out[0] = origin[0] + dir[0] * along;
    out[1] = origin[1] + dir[1] * along;
    out[2] = origin[2] + dir[2] * along;
  };

  const ringPoint = (out: Vec3, origin: Vec3, axis: Axis, angle: number, radius: number) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    if (axis === 'x') {
      out[0] = origin[0];
      out[1] = origin[1] + c * radius;
      out[2] = origin[2] + s * radius;
      return;
    }
    if (axis === 'y') {
      out[0] = origin[0] + c * radius;
      out[1] = origin[1];
      out[2] = origin[2] + s * radius;
      return;
    }
    out[0] = origin[0] + c * radius;
    out[1] = origin[1] + s * radius;
    out[2] = origin[2];
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
          ringPoint(_ringA, origin, axis, a0, ringR);
          ringPoint(_ringB, origin, axis, a1, ringR);
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
      tipColliderCenter(_tipWorld, origin, axis, scale, mode, sign);

      const tipDist = tipCubeScreenHit(clientX, clientY, _tipWorld, tipHalf);
      if (tipDist !== null && tipDist < bestScore) {
        bestScore = tipDist;
        bestAxis = axis;
      }

      shaftEndWorldPos(_hit, origin, axis, scale, sign);
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
  ) => {
    const selected = findSelectedPart(registry, partId);
    const local = selected?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
    if (!selected || !local) return;

    unprojectScreenRay(_rayO, _rayD, e.clientX, e.clientY, canvas, pipeline.camera.viewProj, pipeline.camera.position);
    const dir = AXIS_DIR[axis];
    _axisD[0] = dir[0];
    _axisD[1] = dir[1];
    _axisD[2] = dir[2];

    let startAxisT = 0;
    let startAngle = 0;
    if (mode === 'rotate') {
      if (rayPlaneHit(_hit, _rayO, _rayD, origin, _axisD)) {
        startAngle = ringAngleAt(_hit, origin, axis);
      }
    } else {
      const t = projectRayOntoAxis(
        _rayO,
        _rayD,
        origin,
        axis,
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
    const dir = AXIS_DIR[drag.axis];
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
        const angle = ringAngleAt(_hit, origin, drag.axis);
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
        drag.axis,
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
    setDocument(writePartToDocument(getDocument(), drag.partId, local));
  };

  const endDrag = (e: PointerEvent) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const selected = findSelectedPart(registry, drag.partId);
    const local = selected?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
    if (local) setDocument(writePartToDocument(getDocument(), drag.partId, local));
    drag = null;
  };

  const currentSigns = (origin: Vec3): Record<Axis, 1 | -1> => ({
    x: axisSignTowardCamera(origin, 'x'),
    y: axisSignTowardCamera(origin, 'y'),
    z: axisSignTowardCamera(origin, 'z'),
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
    const signs = currentSigns(origin);
    const axis = pickHandle(e.clientX, e.clientY, origin, mode, scale, signs);
    if (!axis) return;

    e.preventDefault();
    e.stopPropagation();
    beginDrag(e, axis, mode, sel.partId, origin, signs[axis]);
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
    hoverAxis = pickHandle(e.clientX, e.clientY, origin, mode, scale, currentSigns(origin));
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
    const signs = show
      ? currentSigns(origin)
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
      orientHandle(t, renderable.model, origin, h.axis, h.role, scale, mode, signs[h.axis]);
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
