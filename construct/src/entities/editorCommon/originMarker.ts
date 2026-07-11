import {
  type GpuDevice,
  type Children,
  type Material,
  type Registry,
  type Transform,
  createChildOf,
  createLocalTransform,
  createTransform,
  addChildId,
  destroyMesh,
  COMPONENT_KEYS,
} from 'viberanium';
import { createBoxMesh } from '../gizmos/meshes.ts';
import { bakeChildWorld } from './trs.ts';

export const spawnOriginMarkerChild = (
  device: GpuDevice,
  registry: Registry,
  rootId: number,
  markerKey: string,
  marker: { halfExtent: number },
  materialName: string,
): void => {
  const root = registry.get(rootId);
  if (!root) return;

  const rootT = root.components[COMPONENT_KEYS.transform] as Transform;
  const children = root.components[COMPONENT_KEYS.children] as Children;
  const mesh = createBoxMesh(device, marker.halfExtent, marker.halfExtent, marker.halfExtent);
  const material: Material = {
    name: materialName,
    baseColorTex: null,
    baseColorFactor: [0.25, 0.45, 0.95, 0.75],
    alphaMode: 'BLEND',
  };

  const child = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  child.components[COMPONENT_KEYS.transform] = t;
  child.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  child.components[COMPONENT_KEYS.localTransform] = local;
  child.components[markerKey] = marker;
  child.components[COMPONENT_KEYS.renderable] = {
    mesh,
    material,
    castShadow: false,
    overlay: true,
  };
  child.onDeregister.push(() => destroyMesh(device, mesh));
  registry.register(child);
  addChildId(children, child.id);
  bakeChildWorld(rootT, t, local);
};
