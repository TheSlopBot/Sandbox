import {
  type Registry,
  type Entity,
  type Material,
  type GltfCache,
  type TextureCache,
  createInterleavedMesh,
  destroyMesh,
  createTransform,
  createLocalTransform,
  createChildOf,
  createChildren,
  addChildId,
  removeChildId,
  createBoxCollider,
  createCylinderCollider,
  createSphereCollider,
  bakeColliderWorldFromLocal,
  updateWorldMatrix,
  buildRuntimeScene,
  buildGltfMaterials,
  createStaticModel,
  createRenderGroup,
  m4,
  m4FromTRS,
  m4FromTRSQuat,
  m4Mul,
  v3,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import {
  type PropDocument,
  type PropDocumentAssetPart,
  type PropDocumentColliderPart,
  type PropDocumentPart,
  identityPartLocal,
} from '../../catalog/props/propDocument.ts';
import { createConstructPropRoot } from './propRoot.ts';
import { createConstructPropPart, type ConstructPropPart } from './propPart.ts';
import { createConstructColliderWireframe } from './colliderWireframe.ts';
import { syncPartLocalToWorld } from './syncPartLocal.ts';

const COLLIDER_COLORS: Record<'box' | 'cylinder' | 'sphere', [number, number, number, number]> = {
  box: [0.22, 0.55, 1.0, 0.35],
  cylinder: [0.72, 0.32, 0.95, 0.35],
  sphere: [1.0, 0.55, 0.12, 0.35],
};

const wireMaterial = (shape: 'box' | 'cylinder' | 'sphere'): Material => ({
  name: `construct-collider-wire-${shape}`,
  baseColorTex: null,
  baseColorFactor: COLLIDER_COLORS[shape],
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

const createBoxProxyMesh = (gl: WebGL2RenderingContext, hx: number, hy: number, hz: number) => {
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

const createSphereProxyMesh = (gl: WebGL2RenderingContext, radius: number, seg = 12) => {
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

  return createInterleavedMesh(gl, new Float32Array(v), new Uint32Array(idx));
};

const createCylinderProxyMesh = (
  gl: WebGL2RenderingContext,
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

  return createInterleavedMesh(gl, new Float32Array(v), new Uint32Array(idx));
};

const applyPartLocal = (
  local: ReturnType<typeof createLocalTransform>,
  part: PropDocumentPart,
) => {
  local.position[0] = part.position[0];
  local.position[1] = part.position[1];
  local.position[2] = part.position[2];
  local.rotation[0] = part.rotation[0];
  local.rotation[1] = part.rotation[1];
  local.rotation[2] = part.rotation[2];
  local.rotation[3] = part.rotation[3];
  local.scale[0] = part.scale[0];
  local.scale[1] = part.scale[1];
  local.scale[2] = part.scale[2];
};

const bakeChildWorld = (
  parentT: ReturnType<typeof createTransform>,
  childT: ReturnType<typeof createTransform>,
  local: ReturnType<typeof createLocalTransform>,
) => {
  updateWorldMatrix(parentT);
  const localM = m4();
  m4FromTRSQuat(localM, local.position, local.rotation, local.scale);
  m4Mul(childT.world, parentT.world, localM);
  childT.dirty = false;
};

export const clearPropEditorEntities = (registry: Registry) => {
  const ids = new Set<number>();
  for (const e of registry.view(CONSTRUCT_KEYS.propPart)) {
    ids.add(e.id);
    const renderGroup = e.components[COMPONENT_KEYS.renderGroup] as { entityIds: number[] } | undefined;
    if (renderGroup) for (const id of renderGroup.entityIds) ids.add(id);
  }
  for (const e of registry.view(CONSTRUCT_KEYS.propRoot)) ids.add(e.id);
  for (const id of ids) registry.deregister(id);
};

export const removePropPartEntity = (registry: Registry, partId: string): boolean => {
  let entity: Entity | null = null;
  for (const e of registry.view(CONSTRUCT_KEYS.propPart)) {
    const part = e.components[CONSTRUCT_KEYS.propPart] as ConstructPropPart | undefined;
    if (part?.partId === partId) {
      entity = e;
      break;
    }
  }
  if (!entity) return false;

  const childOf = entity.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  if (childOf) {
    const parent = registry.get(childOf.parentId);
    const children = parent?.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren> | undefined;
    if (children) removeChildId(children, entity.id);
  }

  const ids = new Set<number>([entity.id]);
  const renderGroup = entity.components[COMPONENT_KEYS.renderGroup] as { entityIds: number[] } | undefined;
  if (renderGroup) for (const id of renderGroup.entityIds) ids.add(id);
  for (const id of ids) registry.deregister(id);
  return true;
};

export const spawnColliderPartEntity = (
  gl: WebGL2RenderingContext,
  registry: Registry,
  rootId: number,
  part: PropDocumentColliderPart,
) => {
  const root = registry.get(rootId);
  if (!root) return null;

  const rootT = root.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform>;
  const children = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;

  const child = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyPartLocal(local, part);

  child.components[COMPONENT_KEYS.transform] = t;
  child.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  child.components[COMPONENT_KEYS.localTransform] = local;
  child.components[CONSTRUCT_KEYS.propPart] = createConstructPropPart(part.id, 'collider', part.shape);
  child.components[CONSTRUCT_KEYS.colliderWireframe] = createConstructColliderWireframe(part.shape);

  let mesh;
  if (part.shape === 'box') {
    const hx = part.halfExtents?.[0] ?? 0.5;
    const hy = part.halfExtents?.[1] ?? 0.5;
    const hz = part.halfExtents?.[2] ?? 0.5;
    child.components[COMPONENT_KEYS.collider] = createBoxCollider({
      halfExtents: v3(hx, hy, hz),
      isStatic: true,
    });
    mesh = createBoxProxyMesh(gl, hx, hy, hz);
  } else if (part.shape === 'cylinder') {
    const radius = part.radius ?? 0.35;
    const halfHeight = part.halfHeight ?? 0.5;
    child.components[COMPONENT_KEYS.collider] = createCylinderCollider({
      radius,
      halfHeight,
      isStatic: true,
    });
    mesh = createCylinderProxyMesh(gl, radius, halfHeight);
  } else {
    const radius = part.radius ?? 0.5;
    child.components[COMPONENT_KEYS.collider] = createSphereCollider({
      radius,
      isStatic: true,
    });
    mesh = createSphereProxyMesh(gl, radius);
  }

  child.components[COMPONENT_KEYS.renderable] = {
    mesh,
    material: wireMaterial(part.shape),
    castShadow: false,
    overlay: true,
  };
  child.onDeregister.push(() => destroyMesh(gl, mesh));

  registry.register(child);
  addChildId(children, child.id);

  bakeChildWorld(rootT, t, local);
  const collider = child.components[COMPONENT_KEYS.collider];
  if (collider) bakeColliderWorldFromLocal(collider as never, t.world);

  return child.id;
};

export const spawnAssetPartEntity = async (
  gl: WebGL2RenderingContext,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  rootId: number,
  part: PropDocumentAssetPart,
): Promise<number | null> => {
  const root = registry.get(rootId);
  if (!root) return null;

  const rootT = root.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform>;
  const children = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;

  const loaded = await gltfCache.getOrLoad(part.url);
  const scene = buildRuntimeScene(loaded);
  const mats = buildGltfMaterials(loaded, part.materialPrefix, textures);

  const child = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyPartLocal(local, part);

  child.components[COMPONENT_KEYS.transform] = t;
  child.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  child.components[COMPONENT_KEYS.localTransform] = local;
  child.components[CONSTRUCT_KEYS.propPart] = createConstructPropPart(part.id, 'asset');

  const renderEntityIds: number[] = [];

  for (const pair of scene.meshNodePairs) {
    const model = scene.models[pair.meshIndex];
    if (!model) continue;

    for (const prim of model.primitives) {
      if (prim.kind === 'skinned') continue;

      const mesh = createInterleavedMesh(gl, prim.vertices, prim.indices);
      const material: Material =
        prim.materialIndex >= 0 && prim.materialIndex < mats.length
          ? mats[prim.materialIndex]!
          : mats[0]!;

      const renderE = registry.createBare();
      renderE.components[COMPONENT_KEYS.transform] = t;
      renderE.components[COMPONENT_KEYS.gltfNodeIndex] = pair.nodeIndex;
      renderE.components[COMPONENT_KEYS.renderable] = { mesh, material, model: m4() };
      renderE.onDeregister.push(() => destroyMesh(gl, mesh));
      registry.register(renderE);
      renderEntityIds.push(renderE.id);
    }
  }

  if (renderEntityIds.length === 0) {
    registry.deregister(child.id);
    return null;
  }

  child.components[COMPONENT_KEYS.staticModel] = createStaticModel(scene);
  child.components[COMPONENT_KEYS.renderGroup] = createRenderGroup(renderEntityIds);
  registry.register(child);
  addChildId(children, child.id);

  syncPartLocalToWorld(registry, child);

  return child.id;
};

export const ensurePropRoot = (registry: Registry, doc: PropDocument) => {
  const existing = registry.view(CONSTRUCT_KEYS.propRoot)[0];
  if (existing) return existing.id;

  const root = registry.createBare();
  const t = createTransform();
  m4FromTRS(t.world, t.position, t.yaw, t.scale);
  t.dirty = false;
  root.components[COMPONENT_KEYS.transform] = t;
  root.components[COMPONENT_KEYS.children] = createChildren();
  root.components[CONSTRUCT_KEYS.propRoot] = createConstructPropRoot(doc.id);
  registry.register(root);
  return root.id;
};

export const defaultColliderPart = (
  shape: 'box' | 'cylinder' | 'sphere',
  id: string,
): PropDocumentColliderPart => {
  const local = identityPartLocal();
  if (shape === 'box') {
    return {
      id,
      name: id,
      kind: 'collider',
      shape: 'box',
      halfExtents: [0.5, 0.5, 0.5],
      ...local,
    };
  }
  if (shape === 'cylinder') {
    return {
      id,
      name: id,
      kind: 'collider',
      shape: 'cylinder',
      radius: 0.35,
      halfHeight: 0.5,
      ...local,
    };
  }
  return {
    id,
    name: id,
    kind: 'collider',
    shape: 'sphere',
    radius: 0.5,
    ...local,
  };
};


