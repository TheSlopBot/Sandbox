import {
  type GpuDevice,
  type Entity,
  type Registry,
  type RuntimeScene,
  createTransform,
  createLocalTransform,
  createChildOf,
  createChildren,
  addChildId,
  removeChildId,
  destroyMesh,
  findBoneNodeIndex,
  createAttachmentOffset,
  createBoneAttachment,
  bakeColliderWorldFromLocal,
  m4,
  m4FromTRSQuat,
  m4Mul,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ActorDocumentCollider } from '../../catalog/actors/actorDocument.ts';
import { createConstructActorCollider, type ConstructActorCollider } from './actorCollider.ts';
import { createConstructColliderWireframe } from '../propEditor/colliderWireframe.ts';
import { createConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { applyLocalFromTRS } from '../editorCommon/trs.ts';
import { createColliderShapeResources } from '../editorCommon/colliderShapeResources.ts';
import { findActorAttachmentEntity } from './spawnActorAttachment.ts';

export const findActorColliderEntity = (registry: Registry, colliderId: string): Entity | null => {
  for (const e of registry.view(CONSTRUCT_KEYS.actorCollider)) {
    const col = e.components[CONSTRUCT_KEYS.actorCollider] as ConstructActorCollider | undefined;
    if (col?.colliderId === colliderId) return e;
  }
  return null;
};

export const spawnActorCollider = (
  device: GpuDevice,
  registry: Registry,
  characterEntityId: number,
  bodyScene: RuntimeScene,
  collider: ActorDocumentCollider,
): number | null => {
  const character = registry.get(characterEntityId);
  if (!character) return null;

  const characterChildren = character.components[COMPONENT_KEYS.children] as
    | ReturnType<typeof createChildren>
    | undefined;
  if (!characterChildren) return null;

  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromTRS(local, collider);

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[CONSTRUCT_KEYS.editableTarget] = createConstructEditableTarget(collider.id);
  entity.components[CONSTRUCT_KEYS.colliderWireframe] = createConstructColliderWireframe(
    collider.shape,
  );
  entity.components[CONSTRUCT_KEYS.actorCollider] = createConstructActorCollider(
    collider.id,
    collider.shape,
    collider.collision,
    collider.hitbox,
  );

  const resources = createColliderShapeResources(device, collider.shape, {
    halfExtents: collider.halfExtents,
    radius: collider.radius,
    halfHeight: collider.halfHeight,
    collision: collider.collision,
    hitbox: collider.hitbox,
  });
  entity.components[COMPONENT_KEYS.collider] = resources.collider;
  entity.components[COMPONENT_KEYS.renderable] = {
    mesh: resources.mesh,
    material: resources.material,
    castShadow: false,
    overlay: true,
  };
  entity.onDeregister.push(() => destroyMesh(device, resources.mesh));

  if (collider.parent.kind === 'bone') {
    const boneNodeIndex = findBoneNodeIndex(bodyScene.nodes, collider.parent.boneName);
    const localOffset = createAttachmentOffset(
      collider.position,
      collider.rotation,
      collider.scale,
    );
    entity.components[COMPONENT_KEYS.childOf] = createChildOf(characterEntityId);
    entity.components[COMPONENT_KEYS.boneAttachment] = createBoneAttachment(
      bodyScene,
      boneNodeIndex,
      localOffset,
    );
    registry.register(entity);
    addChildId(characterChildren, entity.id);
    return entity.id;
  }

  const attachmentEntity = findActorAttachmentEntity(registry, collider.parent.attachmentId);
  if (!attachmentEntity) {
    registry.deregister(entity.id);
    return null;
  }

  const attachmentChildren = attachmentEntity.components[COMPONENT_KEYS.children] as
    | ReturnType<typeof createChildren>
    | undefined;
  if (!attachmentChildren) {
    attachmentEntity.components[COMPONENT_KEYS.children] = createChildren();
  }

  const children =
    (attachmentEntity.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>);

  entity.components[COMPONENT_KEYS.childOf] = createChildOf(attachmentEntity.id);
  registry.register(entity);
  addChildId(children, entity.id);

  const parentT = attachmentEntity.components[COMPONENT_KEYS.transform] as
    | ReturnType<typeof createTransform>
    | undefined;
  if (parentT) {
    const localM = m4();
    m4FromTRSQuat(localM, local.position, local.rotation, local.scale);
    m4Mul(t.world, parentT.world, localM);
    t.dirty = false;
    bakeColliderWorldFromLocal(resources.collider, t.world);
  }

  return entity.id;
};

export const removeActorColliderEntity = (registry: Registry, colliderId: string): boolean => {
  const entity = findActorColliderEntity(registry, colliderId);
  if (!entity) return false;

  const childOf = entity.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  if (childOf) {
    const parent = registry.get(childOf.parentId);
    const children = parent?.components[COMPONENT_KEYS.children] as
      | ReturnType<typeof createChildren>
      | undefined;
    if (children) removeChildId(children, entity.id);
  }

  registry.deregister(entity.id);
  return true;
};
