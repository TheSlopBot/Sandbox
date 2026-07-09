import {
  type Registry,
  type Collider,
  type Material,
  createTransform,
  createInterleavedMesh,
  destroyMesh,
  type TextureCache,
  type GltfCache,
  buildRuntimeScene,
  buildGltfMaterials,
  createStaticModel,
  createRenderGroup,
  aabb,
  m4,
  COMPONENT_KEYS,
  markNavGridDirty,
} from 'viberanium';

type PropOpts = { x?: number; y?: number; z?: number; scale?: number; yaw?: number };

const expandBoundsFromInterleaved = (
  min: [number, number, number],
  max: [number, number, number],
  vertices: Float32Array,
  worldM?: Float32Array,
) => {
  for (let i = 0; i < vertices.length; i += 8) {
    const lx = vertices[i]!;
    const ly = vertices[i + 1]!;
    const lz = vertices[i + 2]!;

    let x = lx;
    let y = ly;
    let z = lz;

    if (worldM) {
      x = worldM[0]! * lx + worldM[4]! * ly + worldM[8]! * lz + worldM[12]!;
      y = worldM[1]! * lx + worldM[5]! * ly + worldM[9]! * lz + worldM[13]!;
      z = worldM[2]! * lx + worldM[6]! * ly + worldM[10]! * lz + worldM[14]!;
    }

    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }
};

const worldAabbFromLocal = (
  localMin: [number, number, number],
  localMax: [number, number, number],
  pos: [number, number, number],
  scale: number,
  yaw: number,
): ReturnType<typeof aabb> => {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const corners: [number, number, number][] = [
    [localMin[0], localMin[1], localMin[2]], [localMin[0], localMin[1], localMax[2]],
    [localMin[0], localMax[1], localMin[2]], [localMin[0], localMax[1], localMax[2]],
    [localMax[0], localMin[1], localMin[2]], [localMax[0], localMin[1], localMax[2]],
    [localMax[0], localMax[1], localMin[2]], [localMax[0], localMax[1], localMax[2]],
  ];
  let wMinX = Infinity, wMinY = Infinity, wMinZ = Infinity;
  let wMaxX = -Infinity, wMaxY = -Infinity, wMaxZ = -Infinity;
  for (const [lx0, ly0, lz0] of corners) {
    const lx = lx0 * scale, ly = ly0 * scale, lz = lz0 * scale;
    const wx = (lx * c + lz * s) + pos[0];
    const wy = ly + pos[1];
    const wz = (-lx * s + lz * c) + pos[2];
    if (wx < wMinX) wMinX = wx; if (wx > wMaxX) wMaxX = wx;
    if (wy < wMinY) wMinY = wy; if (wy > wMaxY) wMaxY = wy;
    if (wz < wMinZ) wMinZ = wz; if (wz > wMaxZ) wMaxZ = wz;
  }
  return aabb(wMinX, wMinY, wMinZ, wMaxX, wMaxY, wMaxZ);
};

const worldObbFromLocal = (
  localMin: [number, number, number],
  localMax: [number, number, number],
  pos: [number, number, number],
  scale: number,
  yaw: number,
) => {
  const cxL = (localMin[0] + localMax[0]) * 0.5 * scale;
  const cyL = (localMin[1] + localMax[1]) * 0.5 * scale;
  const czL = (localMin[2] + localMax[2]) * 0.5 * scale;
  const hx = (localMax[0] - localMin[0]) * 0.5 * scale;
  const hy = (localMax[1] - localMin[1]) * 0.5 * scale;
  const hz = (localMax[2] - localMin[2]) * 0.5 * scale;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const rcx = cxL * c + czL * s;
  const rcz = -cxL * s + czL * c;
  return {
    center: new Float32Array([rcx + pos[0], cyL + pos[1], rcz + pos[2]]),
    halfExtents: new Float32Array([hx, hy, hz]),
    yaw,
  };
};

export const instantiateProp = async (
  gl: WebGL2RenderingContext,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  gltfUrl: string,
  materialPrefix: string,
  opts: PropOpts = {},
): Promise<boolean> => {
  const loaded = await gltfCache.getOrLoad(gltfUrl);
  const scene = buildRuntimeScene(loaded);
  const mats = buildGltfMaterials(loaded, materialPrefix, textures);

  const t = createTransform();
  t.position[0] = opts.x ?? 0;
  t.position[1] = opts.y ?? 0;
  t.position[2] = opts.z ?? 0;
  const s = opts.scale ?? 1;
  t.scale[0] = t.scale[1] = t.scale[2] = s;
  t.yaw = opts.yaw ?? 0;
  t.dirty = true;

  const localMin: [number, number, number] = [Infinity, Infinity, Infinity];
  const localMax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const renderEntityIds: number[] = [];

  for (const pair of scene.meshNodePairs) {
    const model = scene.models[pair.meshIndex];
    if (!model) continue;

    const nodeWorld = scene.nodes[pair.nodeIndex]?.worldM;

    for (const prim of model.primitives) {
      if (prim.kind === 'skinned') continue;

      const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
      const material: Material = prim.materialIndex >= 0 && prim.materialIndex < mats.length
        ? mats[prim.materialIndex]
        : mats[0];

      expandBoundsFromInterleaved(localMin, localMax, prim.vertices, nodeWorld);

      const e = registry.createBare();
      e.components[COMPONENT_KEYS.transform] = t;
      e.components[COMPONENT_KEYS.gltfNodeIndex] = pair.nodeIndex;
      e.components[COMPONENT_KEYS.renderable] = { mesh, material, model: m4() };
      e.onDeregister.push(() => destroyMesh(gl, mesh));
      registry.register(e);
      renderEntityIds.push(e.id);
    }
  }

  if (!Number.isFinite(localMin[0])) return false;

  if (opts.y === undefined) {
    t.position[1] = -localMin[1] * s;
    t.dirty = true;
  }

  const pos: [number, number, number] = [t.position[0], t.position[1], t.position[2]];
  const collider: Collider = {
    aabb: worldAabbFromLocal(localMin, localMax, pos, s, t.yaw),
    isStatic: true,
    obbY: worldObbFromLocal(localMin, localMax, pos, s, t.yaw),
  };

  const root = registry.createBare();
  root.components[COMPONENT_KEYS.transform] = t;
  root.components[COMPONENT_KEYS.staticModel] = createStaticModel(scene);
  root.components[COMPONENT_KEYS.renderGroup] = createRenderGroup(renderEntityIds);
  root.components[COMPONENT_KEYS.collider] = collider;
  registry.register(root);
  markNavGridDirty(registry);

  return true;
};
