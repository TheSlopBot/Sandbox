import { createInterleavedMesh, type GpuDevice, type Mesh } from 'viberanium';

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

export const createUnitBoxMesh = (device: GpuDevice): Mesh => {
  const hx = 1;
  const hy = 1;
  const hz = 1;
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

  return createInterleavedMesh(device, new Float32Array(v), new Uint32Array(idx));
};

export const createUnitSphereMesh = (device: GpuDevice, seg = 12): Mesh => {
  const radius = 1;
  const v: number[] = [];
  const idx: number[] = [];

  for (let y = 0; y <= seg; y++) {
    const vAngle = (y / seg) * Math.PI;
    const yPos = Math.cos(vAngle) * radius;
    const ringR = Math.sin(vAngle) * radius;
    for (let x = 0; x <= seg; x++) {
      const hAngle = (x / seg) * Math.PI * 2;
      const px = Math.cos(hAngle) * ringR;
      const pz = Math.sin(hAngle) * ringR;
      const nx = px / radius;
      const ny = yPos / radius;
      const nz = pz / radius;
      pushVert(v, px, yPos, pz, nx, ny, nz);
    }
  }

  for (let y = 0; y < seg; y++) {
    for (let x = 0; x < seg; x++) {
      const a = y * (seg + 1) + x;
      const b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return createInterleavedMesh(device, new Float32Array(v), new Uint32Array(idx));
};

export const createUnitCylinderMesh = (device: GpuDevice, seg = 14): Mesh => {
  const radius = 1;
  const halfHeight = 1;
  const v: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    pushVert(v, x, -halfHeight, z, nx, 0, nz);
    pushVert(v, x, halfHeight, z, nx, 0, nz);
  }

  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const topCenter = v.length / 8;
  pushVert(v, 0, halfHeight, 0, 0, 1, 0);
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const b = ((i + 1) / seg) * Math.PI * 2;
    const ai = v.length / 8;
    pushVert(v, Math.cos(a) * radius, halfHeight, Math.sin(a) * radius, 0, 1, 0);
    const bi = v.length / 8;
    pushVert(v, Math.cos(b) * radius, halfHeight, Math.sin(b) * radius, 0, 1, 0);
    idx.push(topCenter, ai, bi);
  }

  const botCenter = v.length / 8;
  pushVert(v, 0, -halfHeight, 0, 0, -1, 0);
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const b = ((i + 1) / seg) * Math.PI * 2;
    const ai = v.length / 8;
    pushVert(v, Math.cos(a) * radius, -halfHeight, Math.sin(a) * radius, 0, -1, 0);
    const bi = v.length / 8;
    pushVert(v, Math.cos(b) * radius, -halfHeight, Math.sin(b) * radius, 0, -1, 0);
    idx.push(botCenter, bi, ai);
  }

  return createInterleavedMesh(device, new Float32Array(v), new Uint32Array(idx));
};
