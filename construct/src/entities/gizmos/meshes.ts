import { createInterleavedMesh } from 'viberanium';

export const SHAFT_LEN = 0.85;
export const TIP_SIZE = 0.14;
export const CONE_HEIGHT = TIP_SIZE * 1.35;
export const CUBE_HALF = TIP_SIZE * 0.45;
export const RING_RADIUS = 0.95;
export const RING_TUBE = 0.022;
export const SHAFT_THICKNESS = 0.022;
export const SHAFT_TIP_OVERLAP = 0.008;

export type Axis = 'x' | 'y' | 'z';

export const AXIS_COLORS: Record<Axis, [number, number, number, number]> = {
  x: [0.75, 0.35, 0.35, 1],
  y: [0.35, 0.75, 0.35, 1],
  z: [0.35, 0.35, 0.75, 1],
};

export const AXIS_COLORS_HOVER: Record<Axis, [number, number, number, number]> = {
  x: [0.8, 0.5, 0.5, 1],
  y: [0.5, 0.8, 0.5, 1],
  z: [0.5, 0.5, 0.8, 1],
};

export const AXIS_DIR: Record<Axis, [number, number, number]> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

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

export const createBoxMesh = (gl: WebGL2RenderingContext, hx: number, hy: number, hz: number) => {
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

export const createShaftMesh = (gl: WebGL2RenderingContext) =>
  createBoxMesh(gl, SHAFT_THICKNESS, 0.5, SHAFT_THICKNESS);

export const createConeMesh = (gl: WebGL2RenderingContext, radius: number, height: number, seg = 12) => {
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

export const createTorusMesh = (
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

export const axisMaterial = (axis: Axis, name: string) => ({
  name,
  baseColorTex: null as WebGLTexture | null,
  baseColorFactor: [AXIS_COLORS[axis][0], AXIS_COLORS[axis][1], AXIS_COLORS[axis][2], AXIS_COLORS[axis][3]] as [
    number,
    number,
    number,
    number,
  ],
  alphaMode: 'OPAQUE' as const,
  doubleSided: false,
});
