import {
  type Registry,
  type Material,
  type Transform,
  type LocalTransform,
  type RenderPipeline,
  type Mat4,
  type Vec3,
  type Quat,
  type StaticModel,
  type Entity,
  createInterleavedMesh,
  destroyMesh,
  createTransform,
  m4,
  m4Copy,
  m4Invert,
  m4FromTRS,
  m4FromTRSQuat,
  m4Mul,
  q4,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../../catalog/keys/components.ts';
import { type ConstructPropSelection } from '../components/propSelection.ts';
import { type ConstructGizmoMode } from '../components/gizmoMode.ts';
import { createConstructGizmoHandle, type ConstructGizmoHandle } from '../components/gizmoHandle.ts';
import { type ConstructPropPart } from '../components/propPart.ts';
import { type PropDocument, type PropEditorTransformMode } from '../../../catalog/props/propDocument.ts';
import { syncPartLocalToWorld } from '../syncPartLocal.ts';
import {
  boundsCenter,
  createEmptyBounds,
  expandBoundsFromInterleaved,
  isBoundsValid,
} from '../../viewer/modelBounds.ts';

type Axis = 'x' | 'y' | 'z';
type HandleRole = 'shaft' | 'tip' | 'ring';

const AXIS_COLORS: Record<Axis, [number, number, number, number]> = {
  x: [0.75, 0.35, 0.35, 1],
  y: [0.35, 0.75, 0.35, 1],
  z: [0.35, 0.35, 0.75, 1],
};

const AXIS_COLORS_HOVER: Record<Axis, [number, number, number, number]> = {
  x: [0.8, 0.5, 0.5, 1],
  y: [0.5, 0.8, 0.5, 1],
  z: [0.5, 0.5, 0.8, 1],
};

const AXIS_DIR: Record<Axis, [number, number, number]> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

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

const SHAFT_LEN = 0.85;
const TIP_SIZE = 0.14;
const CONE_HEIGHT = TIP_SIZE * 1.35;
const CUBE_HALF = TIP_SIZE * 0.45;
const RING_RADIUS = 0.95;
const RING_TUBE = 0.022;
const SHAFT_PICK_PX = 12;
const TIP_COLLIDER_HALF = 0.12;
const SHAFT_THICKNESS = 0.022;
const GIZMO_SCALE = 1;
const RING_SEGMENTS = 48;
const RING_SEGMENT_PICK_PX = 10;
const SHAFT_TIP_OVERLAP = 0.008;
const SHIFT_SNAP = 0.1;
const SHIFT_ROTATE_SNAP = (15 * Math.PI) / 180;

const snapToIncrement = (value: number, increment: number) =>
  Math.round(value / increment) * increment;

const pushVert = (
  out: number[],
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
) => {
  out.push(x, y, z, nx, ny, nz, 0, 0);
};

const createBoxMesh = (gl: WebGL2RenderingContext, hx: number, hy: number, hz: number) => {
  const v: number[] = [];
  const idx: number[] = [];
  const faces: Array<{ n: [number, number, number]; corners: [number, number, number][] }> = [
    { n: [0, 0, 1], corners: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], corners: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { n: [0, 1, 0], corners: [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]] },
    { n: [0, -1, 0], corners: [[-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz]] },
    { n: [1, 0, 0], corners: [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]] },
    { n: [-1, 0, 0], corners: [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz]] },
  ];
  let base = 0;
  for (const face of faces) {
    for (const c of face.corners) pushVert(v, c[0], c[1], c[2], face.n[0], face.n[1], face.n[2]);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }
  return createInterleavedMesh(gl, new Float32Array(v), new Uint32Array(idx));
};

const createShaftMesh = (gl: WebGL2RenderingContext) =>
  createBoxMesh(gl, SHAFT_THICKNESS, 0.5, SHAFT_THICKNESS);

const createConeMesh = (gl: WebGL2RenderingContext, radius: number, height: number, seg = 12) => {
  const v: number[] = [];
  const idx: number[] = [];
  const tip = v.length / 8;
  pushVert(v, 0, height, 0, 0, 1, 0);
  const baseCenter = v.length / 8;
  pushVert(v, 0, 0, 0, 0, -1, 0);

  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    const ny = radius / Math.max(height, 1e-6);
    const inv = 1 / Math.hypot(nx, ny, nz);
    pushVert(v, x, 0, z, nx * inv, ny * inv, nz * inv);
  }

  for (let i = 0; i < seg; i++) {
    const a = tip + 2 + i;
    const b = tip + 2 + i + 1;
    idx.push(tip, b, a);
  }

  for (let i = 0; i < seg; i++) {
    const a = tip + 2 + i;
    const b = tip + 2 + i + 1;
    idx.push(baseCenter, b, a);
  }

  return createInterleavedMesh(gl, new Float32Array(v), new Uint32Array(idx));
};

const createTorusMesh = (
  gl: WebGL2RenderingContext,
  majorR: number,
  minorR: number,
  majorSeg = 64,
  minorSeg = 10,
) => {
  const v: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i <= majorSeg; i++) {
    const u = (i / majorSeg) * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    for (let j = 0; j <= minorSeg; j++) {
      const vv = (j / minorSeg) * Math.PI * 2;
      const cv = Math.cos(vv);
      const sv = Math.sin(vv);
      const x = (majorR + minorR * cv) * cu;
      const y = minorR * sv;
      const z = (majorR + minorR * cv) * su;
      const nx = cv * cu;
      const ny = sv;
      const nz = cv * su;
      pushVert(v, x, y, z, nx, ny, nz);
    }
  }

  for (let i = 0; i < majorSeg; i++) {
    for (let j = 0; j < minorSeg; j++) {
      const a = i * (minorSeg + 1) + j;
      const b = a + minorSeg + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  return createInterleavedMesh(gl, new Float32Array(v), new Uint32Array(idx));
};

const axisMaterial = (axis: Axis): Material => ({
  name: `construct-gizmo-${axis}`,
  baseColorTex: null,
  baseColorFactor: [AXIS_COLORS[axis][0], AXIS_COLORS[axis][1], AXIS_COLORS[axis][2], AXIS_COLORS[axis][3]],
  alphaMode: 'OPAQUE',
  doubleSided: false,
});

const findSelectedPart = (registry: Registry, partId: string | null) => {
  if (!partId) return null;
  for (const e of registry.view(CONSTRUCT_KEYS.propPart)) {
    const part = e.components[CONSTRUCT_KEYS.propPart] as ConstructPropPart | undefined;
    if (part?.partId === partId) return e;
  }
  return null;
};

const _nodeWorld = m4();

const gizmoOriginForPart = (out: Vec3, entity: Entity, transform: Transform) => {
  out[0] = transform.world[12]!;
  out[1] = transform.world[13]!;
  out[2] = transform.world[14]!;

  const staticModel = entity.components[COMPONENT_KEYS.staticModel] as StaticModel | undefined;
  if (!staticModel) return out;

  const bounds = createEmptyBounds();
  for (const pair of staticModel.scene.meshNodePairs) {
    const model = staticModel.scene.models[pair.meshIndex];
    if (!model) continue;

    const node = staticModel.scene.nodes[pair.nodeIndex];
    if (!node) continue;

    m4Mul(_nodeWorld, transform.world, node.worldM);
    for (const prim of model.primitives) {
      if (prim.kind === 'skinned') continue;
      expandBoundsFromInterleaved(bounds, prim.vertices, _nodeWorld);
    }
  }

  if (!isBoundsValid(bounds)) return out;

  const center = boundsCenter(bounds);
  out[0] = center[0];
  out[1] = center[1];
  out[2] = center[2];
  return out;
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

export const installConstructGizmoSystem = (
  gl: WebGL2RenderingContext,
  registry: Registry,
  pipeline: RenderPipeline,
  canvas: HTMLCanvasElement,
  getDocument: () => PropDocument,
  setDocument: (doc: PropDocument) => void,
  isActive: () => boolean,
): ConstructGizmoController => {
  const shaftMesh = createShaftMesh(gl);
  const coneMesh = createConeMesh(gl, TIP_SIZE * 0.55, CONE_HEIGHT);
  const cubeMesh = createBoxMesh(gl, TIP_SIZE * 0.45, TIP_SIZE * 0.45, TIP_SIZE * 0.45);
  const ringMesh = createTorusMesh(gl, RING_RADIUS, RING_TUBE);

  type HandleEnt = {
    id: number;
    axis: Axis;
    role: HandleRole;
  };

  const handles: HandleEnt[] = [];
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

  const spawnHandle = (axis: Axis, role: HandleRole) => {
    const ent = registry.createBare();
    const t = createTransform();
    t.dirty = false;
    ent.components[COMPONENT_KEYS.transform] = t;
    ent.components[CONSTRUCT_KEYS.gizmoHandle] = createConstructGizmoHandle(axis, role);
      ent.components[COMPONENT_KEYS.renderable] = {
      mesh: role === 'ring' ? ringMesh : role === 'shaft' ? shaftMesh : coneMesh,
      material: axisMaterial(axis),
      model: m4(),
      visible: false,
      castShadow: false,
      overlay: true,
    };
    registry.register(ent);
    handles.push({ id: ent.id, axis, role });
  };

  const ensureHandles = () => {
    const existing = [...registry.view(CONSTRUCT_KEYS.gizmoHandle)];
    if (existing.length >= 9) {
      handles.length = 0;
      for (const e of existing) {
        const h = e.components[CONSTRUCT_KEYS.gizmoHandle] as ConstructGizmoHandle | undefined;
        if (!h) continue;
        const renderable = e.components[COMPONENT_KEYS.renderable] as {
          overlay?: boolean;
          castShadow?: boolean;
        } | undefined;
        if (renderable) {
          renderable.overlay = true;
          renderable.castShadow = false;
        }
        const material = (e.components[COMPONENT_KEYS.renderable] as { material?: Material } | undefined)?.material;
        if (material) setHandleHighlight(material, h.axis, false);
        handles.push({ id: e.id, axis: h.axis, role: h.role });
      }
      return;
    }

    for (const h of handles) {
      if (registry.get(h.id)) registry.deregister(h.id);
    }
    handles.length = 0;

    for (const axis of ['x', 'y', 'z'] as const) {
      spawnHandle(axis, 'shaft');
      spawnHandle(axis, 'tip');
      spawnHandle(axis, 'ring');
    }
  };

  const setHandleMesh = (
    renderable: { mesh: unknown },
    role: HandleRole,
    mode: PropEditorTransformMode,
  ) => {
    if (role === 'ring') {
      renderable.mesh = ringMesh;
      return;
    }
    if (role === 'shaft') {
      renderable.mesh = shaftMesh;
      return;
    }
    renderable.mesh = mode === 'scale' ? cubeMesh : coneMesh;
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
    if (!local) return;

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

    drag = {
      axis,
      mode,
      partId,
      axisSign,
      startLocalPos: [local.position[0], local.position[1], local.position[2]],
      startLocalScale: [local.scale[0], local.scale[1], local.scale[2]],
      startLocalRot: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
      startWorldOrigin: [origin[0], origin[1], origin[2]],
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
        ((mode === 'rotate' && h.role === 'ring') ||
          (mode !== 'rotate' && (h.role === 'shaft' || h.role === 'tip')));

      renderable.visible = wantVisible;
      if (!wantVisible || !show) {
        setHandleHighlight(renderable.material, h.axis, false);
        continue;
      }

      setHandleMesh(renderable, h.role, mode);
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
      destroyMesh(gl, shaftMesh);
      destroyMesh(gl, coneMesh);
      destroyMesh(gl, cubeMesh);
      destroyMesh(gl, ringMesh);
    },
  };
};
