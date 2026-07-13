import {
  type GpuDevice,
  type Collider,
  type Material,
  createInterleavedMesh,
  colliderFromShape,
} from 'viberanium';

const ACTOR_COLLIDER_ROLE_COLORS = {
  collision: [0.22, 0.55, 1.0, 0.4] as [number, number, number, number],
  hitbox: [1.0, 0.32, 0.28, 0.42] as [number, number, number, number],
  both: [0.85, 0.35, 0.95, 0.42] as [number, number, number, number],
};

export const actorColliderRoleColor = (
  collision: boolean,
  hitbox: boolean,
): [number, number, number, number] => {
  if (collision && hitbox) return [...ACTOR_COLLIDER_ROLE_COLORS.both];
  if (hitbox) return [...ACTOR_COLLIDER_ROLE_COLORS.hitbox];
  return [...ACTOR_COLLIDER_ROLE_COLORS.collision];
};

export const applyActorColliderWireColor = (
  material: Material,
  collision: boolean,
  hitbox: boolean,
) => {
  const color = actorColliderRoleColor(collision, hitbox);
  material.baseColorFactor[0] = color[0];
  material.baseColorFactor[1] = color[1];
  material.baseColorFactor[2] = color[2];
  material.baseColorFactor[3] = color[3];
};

const wireMaterial = (shape: 'box' | 'cylinder' | 'sphere'): Material => ({
  name: `construct-collider-wire-${shape}`,
  baseColorTex: null,
  baseColorFactor: [...ACTOR_COLLIDER_ROLE_COLORS.collision],
  alphaMode: 'BLEND',
  doubleSided: true,
});

export const createActorColliderWireMaterial = (
  shape: 'box' | 'cylinder' | 'sphere',
  collision: boolean,
  hitbox: boolean,
): Material => ({
  name: `construct-actor-collider-wire-${shape}`,
  baseColorTex: null,
  baseColorFactor: actorColliderRoleColor(collision, hitbox),
  alphaMode: 'BLEND',
  doubleSided: true,
});

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

const createBoxProxyMesh = (device: GpuDevice, hx: number, hy: number, hz: number) => {
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

const createSphereProxyMesh = (device: GpuDevice, radius: number, seg = 12) => {
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

const createCylinderProxyMesh = (
  device: GpuDevice,
  radius: number,
  halfHeight: number,
  seg = 14,
) => {
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

export type ColliderShapeResources = {
  collider: Collider;
  mesh: ReturnType<typeof createBoxProxyMesh>;
  material: Material;
};

export const createColliderShapeResources = (
  device: GpuDevice,
  shape: 'box' | 'cylinder' | 'sphere',
  opts: {
    halfExtents?: [number, number, number];
    radius?: number;
    halfHeight?: number;
    collision?: boolean;
    hitbox?: boolean;
  } = {},
): ColliderShapeResources => {
  const roleMaterial =
    opts.collision !== undefined || opts.hitbox !== undefined
      ? createActorColliderWireMaterial(shape, opts.collision !== false, opts.hitbox === true)
      : null;

  if (shape === 'box') {
    const hx = opts.halfExtents?.[0] ?? 0.5;
    const hy = opts.halfExtents?.[1] ?? 0.5;
    const hz = opts.halfExtents?.[2] ?? 0.5;
    return {
      collider: colliderFromShape({ shape: 'box', halfExtents: [hx, hy, hz], isStatic: true }),
      mesh: createBoxProxyMesh(device, hx, hy, hz),
      material: roleMaterial ?? wireMaterial('box'),
    };
  }

  if (shape === 'cylinder') {
    const radius = opts.radius ?? 0.35;
    const halfHeight = opts.halfHeight ?? 0.5;
    return {
      collider: colliderFromShape({ shape: 'cylinder', radius, halfHeight, isStatic: true }),
      mesh: createCylinderProxyMesh(device, radius, halfHeight),
      material: roleMaterial ?? wireMaterial('cylinder'),
    };
  }

  const radius = opts.radius ?? 0.5;
  return {
    collider: colliderFromShape({ shape: 'sphere', radius, isStatic: true }),
    mesh: createSphereProxyMesh(device, radius),
    material: roleMaterial ?? wireMaterial('sphere'),
  };
};
