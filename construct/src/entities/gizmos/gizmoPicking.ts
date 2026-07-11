import {
  type Mat4,
  type RenderPipeline,
  type Vec3,
  m4,
  m4Invert,
  v3,
} from 'viberanium';
import { type PropEditorTransformMode } from '../../catalog/props/propDocument.ts';
import {
  type Axis,
  CONE_HEIGHT,
  CUBE_HALF,
  RING_RADIUS,
} from './meshes.ts';
import {
  type GizmoFrame,
  frameAxis,
  shaftEndDistance,
} from './gizmoFrame.ts';

const SHAFT_PICK_PX = 12;
const TIP_COLLIDER_HALF = 0.12;
const RING_SEGMENTS = 48;
const RING_SEGMENT_PICK_PX = 10;
const SHAFT_TIP_OVERLAP = 0.008;

type ScreenPoint = { x: number; y: number; behind: boolean };

const _screen: ScreenPoint = { x: 0, y: 0, behind: false };
const _screenB: ScreenPoint = { x: 0, y: 0, behind: false };
const _hit = v3();
const _tipWorld = v3();
const _ringA = v3();
const _ringB = v3();

export const projectWorldToScreen = (
  out: ScreenPoint,
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

const _inv = m4();

export const unprojectScreenRay = (
  outOrigin: Vec3,
  outDir: Vec3,
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  viewProj: Mat4,
  cameraPos: Vec3,
) => {
  const inv = _inv;
  m4Invert(inv, viewProj);
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  const ndcY = 1 - ((clientY - rect.top) / Math.max(rect.height, 1)) * 2;

  const farX = inv[0]! * ndcX + inv[4]! * ndcY + inv[8]! * 1 + inv[12]!;
  const farY = inv[1]! * ndcX + inv[5]! * ndcY + inv[9]! * 1 + inv[13]!;
  const farZ = inv[2]! * ndcX + inv[6]! * ndcY + inv[10]! * 1 + inv[14]!;
  const farW = inv[3]! * ndcX + inv[7]! * ndcY + inv[11]! * 1 + inv[15]!;
  const invW = (1 / Math.max(Math.abs(farW), 1e-8)) * Math.sign(farW || 1);
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

export const ringPoint = (
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

export const tipColliderCenter = (
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

export const shaftEndWorldPos = (
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

export const distToScreenSegment = (
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

export const tipCubeScreenHit = (
  pipeline: RenderPipeline,
  canvas: HTMLCanvasElement,
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

export const pickHandle = (
  pipeline: RenderPipeline,
  canvas: HTMLCanvasElement,
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

  const originScreen: ScreenPoint = { x: 0, y: 0, behind: false };
  projectWorldToScreen(originScreen, origin, pipeline.camera.viewProj, canvas);
  const tipHalf = TIP_COLLIDER_HALF * scale;

  for (const axis of ['x', 'y', 'z'] as const) {
    const sign = signs[axis];
    tipColliderCenter(_tipWorld, origin, axis, scale, mode, sign, frame);

    const tipDist = tipCubeScreenHit(pipeline, canvas, clientX, clientY, _tipWorld, tipHalf);
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
