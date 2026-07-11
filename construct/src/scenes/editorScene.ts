import {
  type GpuDevice,
  type Entity,
  type Material,
  type Registry,
  createInterleavedMesh,
  destroyMesh,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../catalog/keys/components.ts';
import { createConstructEditorSelection } from '../entities/editorCommon/editorSelection.ts';
import { createConstructActorSelection } from '../entities/actorEditor/actorSelection.ts';
import { createConstructGizmoMode } from '../entities/gizmos/gizmoMode.ts';
import { spawnConstructGround } from '../entities/ground/spawnGround.ts';
import { type ConstructSessionDeps, type ConstructSessionState } from '../session/types.ts';
import { stopModeSystems } from './installEditorSystems.ts';

const MARKER_HALF = 0.09;

const buildUvSphere = (radius: number, rings: number, segments: number) => {
  const rr = Math.max(3, rings);
  const ss = Math.max(3, segments);

  const vertexCount = (rr + 1) * (ss + 1);
  const v = new Float32Array(vertexCount * 8);

  let vi = 0;
  for (let r = 0; r <= rr; r++) {
    const vFrac = r / rr;
    const phi = vFrac * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let s = 0; s <= ss; s++) {
      const uFrac = s / ss;
      const theta = uFrac * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      const nx = cosTheta * sinPhi;
      const ny = cosPhi;
      const nz = sinTheta * sinPhi;

      v[vi++] = nx * radius;
      v[vi++] = ny * radius;
      v[vi++] = nz * radius;
      v[vi++] = nx;
      v[vi++] = ny;
      v[vi++] = nz;
      v[vi++] = uFrac;
      v[vi++] = 1 - vFrac;
    }
  }

  const idx = new Uint32Array(rr * ss * 6);
  let ii = 0;
  for (let r = 0; r < rr; r++) {
    for (let s = 0; s < ss; s++) {
      const a = r * (ss + 1) + s;
      const b = a + ss + 1;
      const c = b + 1;
      const d = a + 1;

      idx[ii++] = a;
      idx[ii++] = b;
      idx[ii++] = d;
      idx[ii++] = d;
      idx[ii++] = b;
      idx[ii++] = c;
    }
  }

  return { v, idx };
};

const createOrbitOriginMarkerMesh = (device: GpuDevice) => {
  const { v, idx } = buildUvSphere(MARKER_HALF, 10, 14);
  const mesh = createInterleavedMesh(device, v, idx);
  const material: Material = {
    name: 'orbit-origin-marker',
    baseColorTex: null,
    baseColorFactor: [1.0, 0.5, 0.3, 0.75],
    alphaMode: 'BLEND',
  };

  return { mesh, material };
};

export const destroyAllEntities = (registry: Registry) => {
  const ids: number[] = [];
  for (const e of registry.all()) ids.push(e.id);

  for (const id of ids) registry.deregister(id);
};

export const createSelectionEntity = (registry: Registry): Entity => {
  const entity = registry.createBare();
  entity.components[CONSTRUCT_KEYS.editorSelection] = createConstructEditorSelection();
  entity.components[CONSTRUCT_KEYS.actorSelection] = createConstructActorSelection();
  entity.components[CONSTRUCT_KEYS.gizmoMode] = createConstructGizmoMode('move');
  registry.register(entity);
  return entity;
};

export const ensureSelectionEntity = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  if (deps.registry.get(state.selectionEnt.id)) return;

  state.selectionEnt = createSelectionEntity(deps.registry);
};

export const ensureEditorGround = (deps: ConstructSessionDeps) => {
  spawnConstructGround(deps.device, deps.registry);
};

export const spawnEditorSceneScaffold = (deps: ConstructSessionDeps) => {
  const orbitEnt = deps.registry.createBare();
  orbitEnt.components[CONSTRUCT_KEYS.orbit] = deps.orbit;
  deps.registry.register(orbitEnt);

  const markerMesh = createOrbitOriginMarkerMesh(deps.device);
  const markerEnt = deps.registry.createBare();
  markerEnt.components[COMPONENT_KEYS.transform] = deps.markerT;
  markerEnt.components[CONSTRUCT_KEYS.orbitOriginMarker] = deps.marker;
  markerEnt.components[COMPONENT_KEYS.renderable] = {
    mesh: markerMesh.mesh,
    material: markerMesh.material,
    castShadow: false,
    overlay: true,
  };
  markerEnt.onDeregister.push(() => destroyMesh(deps.device, markerMesh.mesh));
  deps.registry.register(markerEnt);

  const animEnt = deps.registry.createBare();
  animEnt.components[CONSTRUCT_KEYS.constructAnim] = deps.constructAnim;
  deps.registry.register(animEnt);
};

export const resetEditorScene = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  state.loadedModelUrl = null;
  state.currentClipsByName = new Map();
  state.activeMaterials = [];
  state.textureVariants = [];
  state.activeTextureVariantUrl = null;
  state.defaultBaseColorTex = null;

  stopModeSystems(state);

  destroyAllEntities(deps.registry);
  spawnEditorSceneScaffold(deps);
  ensureSelectionEntity(deps, state);
  ensureEditorGround(deps);
};
