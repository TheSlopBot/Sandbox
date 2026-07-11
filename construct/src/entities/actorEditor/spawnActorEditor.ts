import {
  type Registry,
  createTransform,
  createChildren,
  m4FromTRS,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ActorDocument } from '../../catalog/actors/actorDocument.ts';
import { createConstructActorRoot } from './actorRoot.ts';
import { createConstructActorOriginMarker } from './actorOriginMarker.ts';
import { spawnOriginMarkerChild } from '../editorCommon/originMarker.ts';

export const clearActorEditorEntities = (registry: Registry) => {
  const ids = new Set<number>();

  for (const e of registry.view(CONSTRUCT_KEYS.actorAttachment)) ids.add(e.id);
  for (const e of registry.view(CONSTRUCT_KEYS.actorCollider)) ids.add(e.id);
  for (const e of registry.view(CONSTRUCT_KEYS.skeletonOverlay)) ids.add(e.id);

  for (const e of registry.view(CONSTRUCT_KEYS.actorCharacter)) {
    ids.add(e.id);
    const children = e.components[COMPONENT_KEYS.children] as { ids: number[] } | undefined;
    if (children) for (const id of children.ids) ids.add(id);
  }

  for (const e of registry.view(CONSTRUCT_KEYS.actorOriginMarker)) ids.add(e.id);
  for (const e of registry.view(CONSTRUCT_KEYS.actorRoot)) ids.add(e.id);

  for (const id of ids) registry.deregister(id);
};

export const ensureActorRoot = (registry: Registry, doc: ActorDocument) => {
  const existing = registry.view(CONSTRUCT_KEYS.actorRoot)[0];
  if (existing) {
    const root = existing.components[CONSTRUCT_KEYS.actorRoot] as { documentId: string } | undefined;
    if (root) root.documentId = doc.id;
    return existing.id;
  }

  const root = registry.createBare();
  const t = createTransform();
  m4FromTRS(t.world, t.position, t.yaw, t.scale);
  t.dirty = false;
  root.components[COMPONENT_KEYS.transform] = t;
  root.components[COMPONENT_KEYS.children] = createChildren();
  root.components[CONSTRUCT_KEYS.actorRoot] = createConstructActorRoot(doc.id);
  registry.register(root);
  return root.id;
};

export const ensureActorOriginMarker = (
  gl: WebGL2RenderingContext,
  registry: Registry,
  rootId: number,
) => {
  if (registry.view(CONSTRUCT_KEYS.actorOriginMarker)[0]) return;

  spawnOriginMarkerChild(
    gl,
    registry,
    rootId,
    CONSTRUCT_KEYS.actorOriginMarker,
    createConstructActorOriginMarker(),
    'actor-origin-marker',
  );
};
