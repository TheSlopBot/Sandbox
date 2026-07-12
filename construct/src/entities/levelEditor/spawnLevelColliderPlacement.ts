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
import { type LevelDocumentColliderInstance } from '../../catalog/levels/levelDocument.ts';
import { createConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { createColliderShapeResources } from '../editorCommon/colliderShapeResources.ts';
import { applyLocalFromTRS, bakeChildWorld } from '../editorCommon/trs.ts';
import { createConstructColliderWireframe } from '../propEditor/colliderWireframe.ts';
import { createConstructLevelPlacement } from './levelPlacement.ts';

export const spawnLevelColliderPlacementEntity = (
  device: GpuDevice,
  registry: Registry,
  rootId: number,
  instance: LevelDocumentColliderInstance,
  showColliders: boolean,
): number | null => {
  const root = registry.get(rootId);
  if (!root) return null;

  const rootT = root.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform>;
  const rootChildren = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;

  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromTRS(local, instance);

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[CONSTRUCT_KEYS.editableTarget] = createConstructEditableTarget(instance.id);
  entity.components[CONSTRUCT_KEYS.levelPlacement] = createConstructLevelPlacement(instance.id, 'collider');
  entity.components[CONSTRUCT_KEYS.colliderWireframe] = createConstructColliderWireframe(instance.shape);

  const resources = createColliderShapeResources(device, instance.shape, {
    halfExtents: instance.halfExtents,
    radius: instance.radius,
    halfHeight: instance.halfHeight,
  });
  const mesh = resources.mesh;
  entity.components[COMPONENT_KEYS.collider] = resources.collider;
  entity.components[COMPONENT_KEYS.renderable] = {
    mesh,
    material: resources.material,
    castShadow: false,
    overlay: true,
    visible: showColliders,
  };
  entity.onDeregister.push(() => destroyMesh(device, mesh));

  registry.register(entity);
  addChildId(rootChildren, entity.id);
  bakeChildWorld(rootT, t, local);
  bakeColliderWorldFromLocal(resources.collider, t.world);

  return entity.id;
};
