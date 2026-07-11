import {
  type GpuDevice,
  type Registry,
  destroyMesh,
  createTransform,
  createLocalTransform,
  createChildOf,
  createChildren,
  addChildId,
  bakeColliderWorldFromLocal,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type PropDocumentColliderPart } from '../../catalog/props/propDocument.ts';
import { createConstructPropPart } from './propPart.ts';
import { createConstructColliderWireframe } from './colliderWireframe.ts';
import { createConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { applyLocalFromTRS, bakeChildWorld } from '../editorCommon/trs.ts';
import { createColliderShapeResources } from '../editorCommon/colliderShapeResources.ts';

export const spawnColliderPartEntity = (
  device: GpuDevice,
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
  applyLocalFromTRS(local, part);

  child.components[COMPONENT_KEYS.transform] = t;
  child.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  child.components[COMPONENT_KEYS.localTransform] = local;
  child.components[CONSTRUCT_KEYS.propPart] = createConstructPropPart(part.id, 'collider', part.shape);
  child.components[CONSTRUCT_KEYS.editableTarget] = createConstructEditableTarget(part.id);
  child.components[CONSTRUCT_KEYS.colliderWireframe] = createConstructColliderWireframe(part.shape);

  const resources = createColliderShapeResources(device, part.shape, {
    halfExtents: part.halfExtents,
    radius: part.radius,
    halfHeight: part.halfHeight,
  });
  const mesh = resources.mesh;
  child.components[COMPONENT_KEYS.collider] = resources.collider;
  child.components[COMPONENT_KEYS.renderable] = {
    mesh,
    material: resources.material,
    castShadow: false,
    overlay: true,
  };
  child.onDeregister.push(() => destroyMesh(device, mesh));

  registry.register(child);
  addChildId(children, child.id);

  bakeChildWorld(rootT, t, local);
  bakeColliderWorldFromLocal(resources.collider, t.world);

  return child.id;
};
