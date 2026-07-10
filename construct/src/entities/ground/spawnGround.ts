import {
  type Registry,
  createGroundPlane,
  createInterleavedMesh,
  createTransform,
  destroyMesh,
  COMPONENT_KEYS,
} from 'viberanium';

export const spawnGround = (
  gl: WebGL2RenderingContext,
  registry: Registry,
  opts?: { size?: number; y?: number },
) => {
  const existing = registry.view(COMPONENT_KEYS.groundPlane)[0];
  if (existing) return existing.id;

  const size = opts?.size ?? 60;
  const y = opts?.y ?? 0;
  const v = new Float32Array([
    -size, 0, -size,  0, 1, 0,  0, 0,
     size, 0, -size,  0, 1, 0,  1, 0,
     size, 0,  size,  0, 1, 0,  1, 1,
    -size, 0,  size,  0, 1, 0,  0, 1,
  ]);
  const idx = new Uint32Array([0, 2, 1, 0, 3, 2]);
  const mesh = createInterleavedMesh(gl, v, idx);
  const model = createTransform().world;
  model[13] = y;

  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.groundPlane] = createGroundPlane(mesh, model);
  entity.onDeregister.push(() => destroyMesh(gl, mesh));
  registry.register(entity);
  return entity.id;
};

export const spawnConstructGround = (
  gl: WebGL2RenderingContext,
  registry: Registry,
) => spawnGround(gl, registry, { size: 60, y: -2 });
