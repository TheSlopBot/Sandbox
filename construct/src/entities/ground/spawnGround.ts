import {
  type GpuDevice,
  type Registry,
  type LevelGroundVariant,
  createGroundPlane,
  createInterleavedMesh,
  createTransform,
  destroyMesh,
  m4FromTRSQuat,
  q4,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';

export type SpawnGroundOpts = {
  position?: [number, number, number];
  size?: number;
  y?: number;
  variant?: LevelGroundVariant;
};

export const spawnGround = (
  device: GpuDevice,
  registry: Registry,
  opts?: SpawnGroundOpts,
) => {
  const existing = registry.view(COMPONENT_KEYS.groundPlane)[0];
  if (existing) return existing.id;

  const size = opts?.size ?? 60;
  const position: [number, number, number] = opts?.position
    ? [...opts.position]
    : [0, opts?.y ?? 0, 0];
  const variant = opts?.variant ?? 'blue';
  const v = new Float32Array([
    -1, 0, -1,  0, 1, 0,  0, 0,
     1, 0, -1,  0, 1, 0,  1, 0,
     1, 0,  1,  0, 1, 0,  1, 1,
    -1, 0,  1,  0, 1, 0,  0, 1,
  ]);
  const idx = new Uint32Array([0, 2, 1, 0, 3, 2]);
  const mesh = createInterleavedMesh(device, v, idx);
  const model = createTransform().world;
  m4FromTRSQuat(model, v3(position[0], position[1], position[2]), q4(0, 0, 0, 1), v3(size, 1, size));

  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.groundPlane] = createGroundPlane(mesh, model, variant);
  entity.onDeregister.push(() => destroyMesh(device, mesh));
  registry.register(entity);
  return entity.id;
};

export const spawnConstructGround = (
  device: GpuDevice,
  registry: Registry,
) => spawnGround(device, registry, { size: 60, y: -2, variant: 'gray' });
