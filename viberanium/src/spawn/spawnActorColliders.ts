import { type Registry } from '../engine/registry.ts';
import { type Entity, type EntityId } from '../engine/entity.ts';
import { type ActorColliderDef } from '../definitions/actors/actorDefinition.ts';
import { createTransform, updateWorldMatrix } from '../components/transform.ts';
import { createChildOf } from '../components/childOf.ts';
import { createChildren, addChildId } from '../components/children.ts';
import { createLocalTransform, type LocalTransform } from '../components/localTransform.ts';
import {
  bakeColliderWorldFromLocal,
  createBoxCollider,
  createCylinderCollider,
  createSphereCollider,
  type Collider,
} from '../components/collider.ts';
import { type SkeletalModel } from '../components/skeletalModel.ts';
import { createBoneAttachment, createAttachmentOffset } from '../components/boneAttachment.ts';
import { findBoneNodeIndex } from '../assets/gltf/buildMeshDrawsFromRuntimeScene.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { COMBAT_LAYER, COMBAT_MASK } from '../combat/combatLayers.ts';
import { m4, m4Copy, m4FromTRSQuat, m4Mul } from '../math/mat4.ts';
import { v3 } from '../math/vec3.ts';
import { q4 } from '../math/quat.ts';

export type SpawnActorCollidersOpts = {
  attachmentEntityIds?: ReadonlyMap<string, EntityId>;
};

const _local = m4();
const _world = m4();
const _renderRoot = m4();
const _boneWorld = m4();

const createActorColliderShape = (def: ActorColliderDef): Collider => {
  const position = v3(0, 0, 0);
  const rotation = q4();

  if (def.shape === 'box') {
    return createBoxCollider({
      center: position,
      halfExtents: v3(
        def.halfExtents?.[0] ?? 0.25,
        def.halfExtents?.[1] ?? 0.25,
        def.halfExtents?.[2] ?? 0.25,
      ),
      rotation,
      isStatic: false,
    });
  }

  if (def.shape === 'cylinder') {
    return createCylinderCollider({
      center: position,
      radius: def.radius ?? 0.25,
      halfHeight: def.halfHeight ?? 0.5,
      rotation,
      isStatic: false,
    });
  }

  return createSphereCollider({
    center: position,
    radius: def.radius ?? 0.25,
    isStatic: false,
  });
};

const applyLocalFromDef = (local: LocalTransform, def: ActorColliderDef): void => {
  local.position[0] = def.position[0];
  local.position[1] = def.position[1];
  local.position[2] = def.position[2];
  local.rotation[0] = def.rotation[0];
  local.rotation[1] = def.rotation[1];
  local.rotation[2] = def.rotation[2];
  local.rotation[3] = def.rotation[3];
  local.scale[0] = def.scale[0];
  local.scale[1] = def.scale[1];
  local.scale[2] = def.scale[2];
};

const applyOwnerFromDef = (collider: Collider, def: ActorColliderDef, ownerId: EntityId): void => {
  collider.ownerId = ownerId;
  if (def.collision !== false) collider.characterCollision = true;

  if (!def.hitbox) return;
  collider.combatLayer = COMBAT_LAYER.HURTBOX;
  collider.combatMask = COMBAT_MASK.NONE;
};

const bakeBoneAttachedWorld = (
  character: Entity,
  model: SkeletalModel,
  boneNodeIndex: number,
  localOffset: ReturnType<typeof createAttachmentOffset>,
  t: ReturnType<typeof createTransform>,
  collider: Collider,
): void => {
  const parentT = character.components[COMPONENT_KEYS.transform] as
    | ReturnType<typeof createTransform>
    | undefined;
  const boneNode = model.bodyScene.nodes[boneNodeIndex];
  if (!parentT || !boneNode) return;

  updateWorldMatrix(parentT);
  m4Copy(_renderRoot, parentT.world);
  _renderRoot[13]! += model.visualYOffset;
  m4Mul(_boneWorld, _renderRoot, boneNode.worldM);
  m4Mul(_world, _boneWorld, localOffset);
  for (let i = 0; i < 16; i++) t.world[i] = _world[i]!;
  t.dirty = false;
  bakeColliderWorldFromLocal(collider, t.world);
};

const spawnBoneFollowCollider = (
  registry: Registry,
  character: Entity,
  model: SkeletalModel,
  children: ReturnType<typeof createChildren>,
  def: ActorColliderDef,
  boneName: string,
): number => {
  const boneNodeIndex = findBoneNodeIndex(model.bodyScene.nodes, boneName);
  const localOffset = createAttachmentOffset(def.position, def.rotation, def.scale);

  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromDef(local, def);

  const collider = createActorColliderShape(def);
  applyOwnerFromDef(collider, def, character.id);
  collider.entityId = entity.id;

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(character.id);
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[COMPONENT_KEYS.boneAttachment] = createBoneAttachment(
    model.bodyScene,
    boneNodeIndex,
    localOffset,
  );
  entity.components[COMPONENT_KEYS.collider] = collider;

  bakeBoneAttachedWorld(character, model, boneNodeIndex, localOffset, t, collider);

  registry.register(entity);
  addChildId(children, entity.id);
  return entity.id;
};

const spawnLocalCollider = (
  registry: Registry,
  parentId: EntityId,
  characterId: EntityId,
  children: ReturnType<typeof createChildren>,
  def: ActorColliderDef,
): number => {
  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromDef(local, def);

  const collider = createActorColliderShape(def);
  applyOwnerFromDef(collider, def, characterId);
  collider.entityId = entity.id;

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(parentId);
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[COMPONENT_KEYS.collider] = collider;

  const parent = registry.get(parentId);
  const parentT = parent?.components[COMPONENT_KEYS.transform] as
    | ReturnType<typeof createTransform>
    | undefined;
  if (parentT) {
    updateWorldMatrix(parentT);
    m4FromTRSQuat(_local, local.position, local.rotation, local.scale);
    m4Mul(_world, parentT.world, _local);
    for (let i = 0; i < 16; i++) t.world[i] = _world[i]!;
    t.dirty = false;
    bakeColliderWorldFromLocal(collider, t.world);
  }

  registry.register(entity);
  addChildId(children, entity.id);
  return entity.id;
};

export const spawnActorColliders = (
  registry: Registry,
  character: Entity,
  colliders: readonly ActorColliderDef[],
  opts: SpawnActorCollidersOpts = {},
): number[] => {
  const children = character.components[COMPONENT_KEYS.children] as
    | ReturnType<typeof createChildren>
    | undefined;
  if (!children) return [];

  const model = character.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  const ids: number[] = [];

  for (const def of colliders) {
    if (def.parent.kind === 'bone') {
      if (!model) continue;
      ids.push(spawnBoneFollowCollider(registry, character, model, children, def, def.parent.boneName));
      continue;
    }

    if (def.parent.kind === 'character') {
      ids.push(spawnLocalCollider(registry, character.id, character.id, children, def));
      continue;
    }

    if (def.parent.kind !== 'attachment') continue;

    const attachmentEntityId = opts.attachmentEntityIds?.get(def.parent.attachmentId);
    if (attachmentEntityId === undefined) continue;

    const attachmentEntity = registry.get(attachmentEntityId);
    const attachmentChildren = attachmentEntity?.components[COMPONENT_KEYS.children] as
      | ReturnType<typeof createChildren>
      | undefined;
    if (!attachmentChildren) continue;

    ids.push(
      spawnLocalCollider(registry, attachmentEntityId, character.id, attachmentChildren, def),
    );
  }

  return ids;
};
