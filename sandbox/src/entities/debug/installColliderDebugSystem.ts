import {
  type Collider,
  type GpuDevice,
  type Material,
  type Mesh,
  type Registry,
  type Renderable,
  type Transform,
  COMPONENT_KEYS,
  bakeColliderWorldFromLocal,
  createTransform,
  destroyMesh,
  m4,
  m4FromTRSQuat,
  updateWorldMatrix,
  v3,
} from 'viberanium';
import { GAME_COMPONENT_KEYS } from '../../catalog/keys/components.ts';
import {
  createUnitBoxMesh,
  createUnitCylinderMesh,
  createUnitSphereMesh,
} from './colliderDebugMeshes.ts';

type DebugEntry = {
  entityId: number;
  meshKey: string;
};

const DEBUG_MATERIAL: Material = {
  name: 'sandbox-collider-debug',
  baseColorTex: null,
  baseColorFactor: [0.22, 0.55, 1.0, 0.35],
  alphaMode: 'BLEND',
  doubleSided: true,
};

const _scale = v3(1, 1, 1);
const _identityQuat = new Float32Array([0, 0, 0, 1]);

const shapeMeshKey = (collider: Collider): string => {
  const shape = collider.shape;
  if (shape.kind === 'box') {
    return `box:${shape.halfExtents[0].toFixed(4)}:${shape.halfExtents[1].toFixed(4)}:${shape.halfExtents[2].toFixed(4)}`;
  }
  if (shape.kind === 'sphere') return `sphere:${shape.radius.toFixed(4)}`;
  if (shape.kind === 'ellipsoid') {
    return `ellipsoid:${shape.radii[0].toFixed(4)}:${shape.radii[1].toFixed(4)}:${shape.radii[2].toFixed(4)}`;
  }
  return `cylinder:${shape.radius.toFixed(4)}:${shape.halfHeight.toFixed(4)}`;
};

export const installColliderDebugSystem = (
  registry: Registry,
  device: GpuDevice,
  getEnabled: () => boolean,
) => {
  const unitBox = createUnitBoxMesh(device);
  const unitSphere = createUnitSphereMesh(device);
  const unitCylinder = createUnitCylinderMesh(device);
  const ownedMeshes: Mesh[] = [unitBox, unitSphere, unitCylinder];
  const entries = new Map<Collider, DebugEntry>();
  const seen = new Set<Collider>();

  const resolveMesh = (collider: Collider): { mesh: Mesh; key: string } => {
    const shape = collider.shape;
    const key = shapeMeshKey(collider);

    if (shape.kind === 'box') return { mesh: unitBox, key };
    if (shape.kind === 'sphere' || shape.kind === 'ellipsoid') return { mesh: unitSphere, key };
    return { mesh: unitCylinder, key };
  };

  const writeModel = (out: Float32Array, collider: Collider) => {
    const shape = collider.shape;

    if (shape.kind === 'box') {
      _scale[0] = shape.halfExtents[0];
      _scale[1] = shape.halfExtents[1];
      _scale[2] = shape.halfExtents[2];
      m4FromTRSQuat(out, shape.center, shape.rotation, _scale);
      return;
    }

    if (shape.kind === 'sphere') {
      _scale[0] = shape.radius;
      _scale[1] = shape.radius;
      _scale[2] = shape.radius;
      m4FromTRSQuat(out, shape.center, _identityQuat, _scale);
      return;
    }

    if (shape.kind === 'ellipsoid') {
      _scale[0] = shape.radii[0];
      _scale[1] = shape.radii[1];
      _scale[2] = shape.radii[2];
      m4FromTRSQuat(out, shape.center, shape.rotation, _scale);
      return;
    }

    _scale[0] = shape.radius;
    _scale[1] = shape.halfHeight;
    _scale[2] = shape.radius;
    m4FromTRSQuat(out, shape.center, shape.rotation, _scale);
  };

  const clearEntries = () => {
    for (const entry of entries.values()) registry.deregister(entry.entityId);
    entries.clear();
  };

  const removeUpdate = registry.addAction(
    'update',
    () => {
      if (!getEnabled()) {
        if (entries.size > 0) clearEntries();
        return;
      }

      seen.clear();

      for (const e of registry.view(COMPONENT_KEYS.collider)) {
        const collider = e.components[COMPONENT_KEYS.collider] as Collider | undefined;
        if (!collider) continue;
        if (e.components[COMPONENT_KEYS.character]) continue;

        if (collider.localShape) {
          const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
          if (t) {
            updateWorldMatrix(t);
            bakeColliderWorldFromLocal(collider, t.world);
          }
        }

        seen.add(collider);
        const { mesh, key } = resolveMesh(collider);
        let entry = entries.get(collider);

        if (!entry || entry.meshKey !== key) {
          if (entry) registry.deregister(entry.entityId);

          const debugEnt = registry.createBare();
          const model = m4();
          writeModel(model, collider);
          debugEnt.components[COMPONENT_KEYS.transform] = createTransform();
          debugEnt.components[COMPONENT_KEYS.renderable] = {
            mesh,
            material: DEBUG_MATERIAL,
            model,
            castShadow: false,
            overlay: true,
            visible: true,
          } satisfies Renderable;
          debugEnt.components[GAME_COMPONENT_KEYS.colliderDebug] = { active: true };
          registry.register(debugEnt);
          entry = { entityId: debugEnt.id, meshKey: key };
          entries.set(collider, entry);
          continue;
        }

        const debugEnt = registry.get(entry.entityId);
        const renderable = debugEnt?.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
        if (renderable?.model) writeModel(renderable.model as Float32Array, collider);
      }

      for (const [collider, entry] of entries) {
        if (seen.has(collider)) continue;
        registry.deregister(entry.entityId);
        entries.delete(collider);
      }
    },
    20,
  );

  return () => {
    removeUpdate();
    clearEntries();
    for (const mesh of ownedMeshes) destroyMesh(device, mesh);
  };
};
