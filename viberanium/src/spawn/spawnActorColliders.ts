import { type Registry } from '../engine/registry.ts';
import { type Entity, type EntityId } from '../engine/entity.ts';
import {
  type ActorAttachmentDef,
  type ActorColliderDef,
} from '../definitions/actors/actorDefinition.ts';
import { pickActorBodyCylinder } from './attachActorBodyCollider.ts';
import { createTransform } from '../components/transform.ts';
import { createChildOf } from '../components/childOf.ts';
import { createChildren, addChildId } from '../components/children.ts';
import { createLocalTransform } from '../components/localTransform.ts';
import {
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
import { v3 } from '../math/vec3.ts';
import { q4 } from '../math/quat.ts';

export type SpawnActorCollidersOpts = {
  attachmentEntityIds?: ReadonlyMap<string, EntityId>;
  attachments?: readonly ActorAttachmentDef[];
};

const createHurtboxShape = (def: ActorColliderDef): Collider => {
  const position = v3(0, 0, 0);
  const rotation = q4();

  if (def.shape === 'box') {
    return createBoxCollider({
      center: position,
      halfExtents: v3(
        (def.halfExtents?.[0] ?? 0.25) * def.scale[0],
        (def.halfExtents?.[1] ?? 0.25) * def.scale[1],
        (def.halfExtents?.[2] ?? 0.25) * def.scale[2],
      ),
      rotation,
      isStatic: false,
    });
  }

  if (def.shape === 'cylinder') {
    return createCylinderCollider({
      center: position,
      radius: (def.radius ?? 0.25) * def.scale[0],
      halfHeight: (def.halfHeight ?? 0.5) * def.scale[1],
      rotation,
      isStatic: false,
    });
  }

  return createSphereCollider({
    center: position,
    radius: (def.radius ?? 0.25) * Math.max(def.scale[0], def.scale[1], def.scale[2]),
    isStatic: false,
  });
};

const applyLocalFromDef = (
  local: ReturnType<typeof createLocalTransform>,
  def: ActorColliderDef,
): void => {
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

const spawnBoneHurtbox = (
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

  const collider = createHurtboxShape(def);
  collider.combatLayer = COMBAT_LAYER.HURTBOX;
  collider.combatMask = COMBAT_MASK.NONE;
  collider.ownerId = character.id;
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

  registry.register(entity);
  addChildId(children, entity.id);
  return entity.id;
};

const spawnLocalHurtbox = (
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

  const collider = createHurtboxShape(def);
  collider.combatLayer = COMBAT_LAYER.HURTBOX;
  collider.combatMask = COMBAT_MASK.NONE;
  collider.ownerId = characterId;
  collider.entityId = entity.id;

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(parentId);
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[COMPONENT_KEYS.collider] = collider;

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
  const bodyDef = pickActorBodyCylinder(colliders);
  const ids: number[] = [];

  for (const def of colliders) {
    if (!def.hitbox) continue;
    if (bodyDef && def.id === bodyDef.id) continue;

    if (def.parent.kind === 'bone') {
      if (!model) continue;
      ids.push(spawnBoneHurtbox(registry, character, model, children, def, def.parent.boneName));
      continue;
    }

    if (def.parent.kind === 'character') {
      ids.push(spawnLocalHurtbox(registry, character.id, character.id, children, def));
      continue;
    }

    if (def.parent.kind !== 'attachment') continue;

    const attachmentId = def.parent.attachmentId;
    const attachmentEntityId = opts.attachmentEntityIds?.get(attachmentId);
    if (attachmentEntityId !== undefined) {
      const attachmentEntity = registry.get(attachmentEntityId);
      const attachmentChildren = attachmentEntity?.components[COMPONENT_KEYS.children] as
        | ReturnType<typeof createChildren>
        | undefined;
      if (attachmentChildren) {
        ids.push(
          spawnLocalHurtbox(registry, attachmentEntityId, character.id, attachmentChildren, def),
        );
        continue;
      }
    }

    const attachment = opts.attachments?.find((entry) => entry.id === attachmentId);
    if (attachment && model) {
      const boneDef: ActorColliderDef = {
        ...def,
        parent: { kind: 'bone', boneName: attachment.boneName },
        position: [
          attachment.position[0] + def.position[0],
          attachment.position[1] + def.position[1],
          attachment.position[2] + def.position[2],
        ],
      };
      ids.push(
        spawnBoneHurtbox(registry, character, model, children, boneDef, attachment.boneName),
      );
    }
  }

  return ids;
};
