import {
  type GpuDevice,
  type Registry,
  type Entity,
  createTransform,
  createChildren,
  removeChildId,
  m4FromTRS,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type PropDocument, type PropDocumentColliderPart, identityPartLocal } from '../../catalog/props/propDocument.ts';
import { createConstructPropRoot } from './propRoot.ts';
import { createConstructPropOriginMarker } from './propOriginMarker.ts';
import { type ConstructPropPart } from './propPart.ts';
import { spawnOriginMarkerChild } from '../editorCommon/originMarker.ts';

export const clearPropEditorEntities = (registry: Registry) => {
  const ids = new Set<number>();
  for (const e of registry.view(CONSTRUCT_KEYS.propPart)) {
    ids.add(e.id);
    const renderGroup = e.components[COMPONENT_KEYS.renderGroup] as { entityIds: number[] } | undefined;
    if (renderGroup) for (const id of renderGroup.entityIds) ids.add(id);
  }
  for (const e of registry.view(CONSTRUCT_KEYS.propOriginMarker)) ids.add(e.id);
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

export const ensurePropOriginMarker = (
  device: GpuDevice,
  registry: Registry,
  rootId: number,
) => {
  if (registry.view(CONSTRUCT_KEYS.propOriginMarker)[0]) return;

  spawnOriginMarkerChild(
    device,
    registry,
    rootId,
    CONSTRUCT_KEYS.propOriginMarker,
    createConstructPropOriginMarker(),
    'prop-origin-marker',
  );
};

export const defaultColliderPart = (
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule',
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
  if (shape === 'capsule') {
    return {
      id,
      name: id,
      kind: 'collider',
      shape: 'capsule',
      radius: 0.3,
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
