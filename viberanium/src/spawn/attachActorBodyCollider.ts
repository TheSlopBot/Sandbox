import { type Entity } from '../engine/entity.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { bakeColliderWorldFromLocal } from '../components/collider.ts';
import { colliderFromShape } from '../components/colliderFromShape.ts';
import {
  characterFootOffset,
  readCharacterBodyCapsule,
} from '../components/characterController.ts';
import { type SkeletalModel } from '../components/skeletalModel.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type ActorColliderDef } from '../definitions/actors/actorDefinition.ts';
import { DEFAULT_CHARACTER_BODY_CAPSULE } from '../definitions/actors/defaultCharacterBodyCapsule.ts';

export const pickActorBodyCapsule = (
  colliders: readonly ActorColliderDef[],
): ActorColliderDef | null =>
  colliders.find(
    (c) => c.collision !== false && c.shape === 'capsule' && c.parent.kind === 'character',
  ) ??
  colliders.find((c) => c.collision !== false && c.shape === 'capsule') ??
  null;

export const attachActorBodyCollider = (
  entity: Entity,
  colliders: readonly ActorColliderDef[],
): void => {
  const bodyDef = pickActorBodyCapsule(colliders);
  if (!bodyDef) return;

  const scaleX = Math.abs(bodyDef.scale[0] || 1);
  const scaleY = Math.abs(bodyDef.scale[1] || 1);
  const radius = (bodyDef.radius ?? DEFAULT_CHARACTER_BODY_CAPSULE.radius) * scaleX;
  const halfHeight = (bodyDef.halfHeight ?? DEFAULT_CHARACTER_BODY_CAPSULE.halfHeight) * scaleY;

  const collider = colliderFromShape({
    shape: 'capsule',
    radius,
    halfHeight,
    isStatic: false,
  });

  if (bodyDef.parent.kind === 'character' && collider.localShape?.kind === 'capsule') {
    collider.localShape.center[0] = bodyDef.position[0];
    collider.localShape.center[1] = bodyDef.position[1];
    collider.localShape.center[2] = bodyDef.position[2];
  }

  const t = entity.components[COMPONENT_KEYS.transform] as Transform | undefined;
  if (t) {
    updateWorldMatrix(t);
    bakeColliderWorldFromLocal(collider, t.world);
  }

  entity.components[COMPONENT_KEYS.collider] = collider;

  const body = readCharacterBodyCapsule(collider);
  const model = entity.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  if (body && model) model.visualYOffset = -characterFootOffset(body);
};
