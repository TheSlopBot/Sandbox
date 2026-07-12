import {
  type Entity,
  type GpuDevice,
  type Registry,
  createChildOf,
  createChildren,
  createLocalTransform,
  createTransform,
  addChildId,
  removeChildId,
  m4FromTRS,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type LevelDocument } from '../../catalog/levels/levelDocument.ts';
import { createConstructLevelRoot } from './levelRoot.ts';
import { createConstructLevelOriginMarker } from './levelOriginMarker.ts';
import { type ConstructLevelPlacement } from './levelPlacement.ts';
import { createConstructLevelPivot, LEVEL_GROUP_PIVOT_ID, LEVEL_MULTI_PIVOT_ID } from './levelPivot.ts';
import { createConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { spawnOriginMarkerChild } from '../editorCommon/originMarker.ts';

export const ensureLevelRoot = (registry: Registry, doc: LevelDocument): number => {
  const existing = registry.view(CONSTRUCT_KEYS.levelRoot)[0];
  if (existing) {
    const root = existing.components[CONSTRUCT_KEYS.levelRoot] as { documentId: string } | undefined;
    if (root) root.documentId = doc.id;
    return existing.id;
  }

  const root = registry.createBare();
  const t = createTransform();
  m4FromTRS(t.world, t.position, t.yaw, t.scale);
  t.dirty = false;
  root.components[COMPONENT_KEYS.transform] = t;
  root.components[COMPONENT_KEYS.children] = createChildren();
  root.components[CONSTRUCT_KEYS.levelRoot] = createConstructLevelRoot(doc.id);
  registry.register(root);
  return root.id;
};

export const ensureLevelOriginMarker = (device: GpuDevice, registry: Registry, rootId: number) => {
  if (registry.view(CONSTRUCT_KEYS.levelOriginMarker)[0]) return;

  spawnOriginMarkerChild(
    device,
    registry,
    rootId,
    CONSTRUCT_KEYS.levelOriginMarker,
    createConstructLevelOriginMarker(),
    'level-origin-marker',
  );
};

const spawnLevelPivotEntity = (registry: Registry, rootId: number, pivotKind: 'group' | 'multi') => {
  const root = registry.get(rootId);
  if (!root) return;

  const children = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;
  const pivot = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  pivot.components[COMPONENT_KEYS.transform] = t;
  pivot.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  pivot.components[COMPONENT_KEYS.localTransform] = local;
  pivot.components[CONSTRUCT_KEYS.levelPivot] = createConstructLevelPivot(pivotKind);
  pivot.components[CONSTRUCT_KEYS.editableTarget] = createConstructEditableTarget(
    pivotKind === 'group' ? LEVEL_GROUP_PIVOT_ID : LEVEL_MULTI_PIVOT_ID,
  );
  registry.register(pivot);
  addChildId(children, pivot.id);
};

export const ensureLevelPivots = (registry: Registry, rootId: number) => {
  if (!registry.view(CONSTRUCT_KEYS.levelPivot)[0]) {
    spawnLevelPivotEntity(registry, rootId, 'group');
    spawnLevelPivotEntity(registry, rootId, 'multi');
  }
};

export const findLevelPivotEntity = (registry: Registry, pivotKind: 'group' | 'multi'): Entity | null => {
  for (const e of registry.view(CONSTRUCT_KEYS.levelPivot)) {
    const pivot = e.components[CONSTRUCT_KEYS.levelPivot] as { pivotKind: string } | undefined;
    if (pivot?.pivotKind === pivotKind) return e;
  }
  return null;
};

export const findLevelPlacementEntity = (registry: Registry, instanceId: string): Entity | null => {
  for (const e of registry.view(CONSTRUCT_KEYS.levelPlacement)) {
    const placement = e.components[CONSTRUCT_KEYS.levelPlacement] as ConstructLevelPlacement | undefined;
    if (placement?.instanceId === instanceId) return e;
  }
  return null;
};

export const removeLevelPlacementEntity = (registry: Registry, instanceId: string): boolean => {
  const entity = findLevelPlacementEntity(registry, instanceId);
  if (!entity) return false;

  const childOf = entity.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  if (childOf) {
    const parent = registry.get(childOf.parentId);
    const parentChildren = parent?.components[COMPONENT_KEYS.children] as
      | ReturnType<typeof createChildren>
      | undefined;
    if (parentChildren) removeChildId(parentChildren, entity.id);
  }

  const ids = new Set<number>([entity.id]);
  const children = entity.components[COMPONENT_KEYS.children] as { ids: number[] } | undefined;
  if (children) {
    for (const childId of children.ids) {
      ids.add(childId);
      const child = registry.get(childId);
      const renderGroup = child?.components[COMPONENT_KEYS.renderGroup] as { entityIds: number[] } | undefined;
      if (renderGroup) for (const rid of renderGroup.entityIds) ids.add(rid);
    }
  }
  const renderGroup = entity.components[COMPONENT_KEYS.renderGroup] as { entityIds: number[] } | undefined;
  if (renderGroup) for (const rid of renderGroup.entityIds) ids.add(rid);

  for (const id of ids) registry.deregister(id);
  return true;
};

export const clearLevelEditorEntities = (registry: Registry) => {
  const ids = new Set<number>();

  for (const e of registry.view(CONSTRUCT_KEYS.levelPlacement)) {
    ids.add(e.id);
    const children = e.components[COMPONENT_KEYS.children] as { ids: number[] } | undefined;
    if (children) {
      for (const childId of children.ids) {
        ids.add(childId);
        const child = registry.get(childId);
        const renderGroup = child?.components[COMPONENT_KEYS.renderGroup] as
          | { entityIds: number[] }
          | undefined;
        if (renderGroup) for (const rid of renderGroup.entityIds) ids.add(rid);
      }
    }
    const renderGroup = e.components[COMPONENT_KEYS.renderGroup] as { entityIds: number[] } | undefined;
    if (renderGroup) for (const rid of renderGroup.entityIds) ids.add(rid);
  }

  for (const e of registry.view(CONSTRUCT_KEYS.levelPivot)) ids.add(e.id);
  for (const e of registry.view(CONSTRUCT_KEYS.levelOriginMarker)) ids.add(e.id);
  for (const e of registry.view(CONSTRUCT_KEYS.levelRoot)) ids.add(e.id);

  for (const id of ids) registry.deregister(id);
};
