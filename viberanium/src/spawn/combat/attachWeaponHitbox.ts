import { type Registry } from '../../engine/registry.ts';
import { type EntityId } from '../../engine/entity.ts';
import { createTransform } from '../../components/transform.ts';
import { createChildOf } from '../../components/childOf.ts';
import { createChildren, addChildId, removeChildId } from '../../components/children.ts';
import { createLocalTransform } from '../../components/localTransform.ts';
import {
  createBoxCollider,
  createCylinderCollider,
  createSphereCollider,
  type Collider,
} from '../../components/collider.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { COMBAT_LAYER, COMBAT_MASK } from '../../combat/combatLayers.ts';
import { type WeaponColliderDef } from '../../definitions/weapons/weaponDefinition.ts';
import { v3 } from '../../math/vec3.ts';
import { q4 } from '../../math/quat.ts';

export const attachWeaponHitbox = (
  registry: Registry,
  parentId: EntityId,
  ownerId: EntityId,
  def: WeaponColliderDef,
): number => {
  const parent = registry.get(parentId);
  if (!parent) return -1;

  if (!parent.components[COMPONENT_KEYS.children]) {
    parent.components[COMPONENT_KEYS.children] = createChildren();
  }
  const childList = parent.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;

  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
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

  const position = v3(0, 0, 0);
  const rotation = q4();

  let collider: Collider;
  if (def.shape === 'box') {
    collider = createBoxCollider({
      center: position,
      halfExtents: v3(
        (def.halfExtents?.[0] ?? 0.15) * def.scale[0],
        (def.halfExtents?.[1] ?? 0.4) * def.scale[1],
        (def.halfExtents?.[2] ?? 0.08) * def.scale[2],
      ),
      rotation,
      isStatic: false,
    });
  } else if (def.shape === 'cylinder') {
    collider = createCylinderCollider({
      center: position,
      radius: (def.radius ?? 0.12) * def.scale[0],
      halfHeight: (def.halfHeight ?? 0.35) * def.scale[1],
      rotation,
      isStatic: false,
    });
  } else {
    collider = createSphereCollider({
      center: position,
      radius: (def.radius ?? 0.2) * Math.max(def.scale[0], def.scale[1], def.scale[2]),
      isStatic: false,
    });
  }

  const isShield = def.role === 'shield';
  collider.combatLayer = isShield ? COMBAT_LAYER.SHIELD : COMBAT_LAYER.HITBOX;
  collider.combatMask = isShield ? COMBAT_MASK.NONE : COMBAT_MASK.HITBOX_TARGETS;
  collider.ownerId = ownerId;
  collider.entityId = entity.id;

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(parentId);
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[COMPONENT_KEYS.collider] = collider;

  registry.register(entity);
  addChildId(childList, entity.id);
  return entity.id;
};

export const detachWeaponHitbox = (
  registry: Registry,
  parentId: EntityId,
  hitboxId: number | null,
): void => {
  if (hitboxId === null) return;
  const parent = registry.get(parentId);
  if (parent) {
    const children = parent.components[COMPONENT_KEYS.children] as
      | ReturnType<typeof createChildren>
      | undefined;
    if (children) removeChildId(children, hitboxId);
  }
  if (registry.get(hitboxId)) registry.deregister(hitboxId);
};
