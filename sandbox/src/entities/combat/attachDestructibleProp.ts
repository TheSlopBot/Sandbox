import {
  type Registry,
  type Entity,
  createHealth,
  createDestructible,
  createBoxCollider,
  createChildOf,
  createChildren,
  createLocalTransform,
  createTransform,
  addChildId,
  COMPONENT_KEYS,
  COMBAT_LAYER,
  COMBAT_MASK,
  v3,
} from 'viberanium';

export const attachDestructibleProp = (
  registry: Registry,
  root: Entity,
  opts: { health?: number; hookId: string; halfExtents?: [number, number, number] } ,
): void => {
  root.components[COMPONENT_KEYS.health] = createHealth(opts.health ?? 40);
  root.components[COMPONENT_KEYS.destructible] = createDestructible(opts.hookId);

  if (!root.components[COMPONENT_KEYS.children]) {
    root.components[COMPONENT_KEYS.children] = createChildren();
  }
  const children = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;

  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  const he = opts.halfExtents ?? [0.5, 0.55, 0.5];
  local.position[1] = he[1];
  const collider = createBoxCollider({
    halfExtents: v3(he[0], he[1], he[2]),
    isStatic: false,
  });
  collider.combatLayer = COMBAT_LAYER.HURTBOX;
  collider.combatMask = COMBAT_MASK.NONE;
  collider.ownerId = root.id;
  collider.entityId = entity.id;

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(root.id);
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[COMPONENT_KEYS.collider] = collider;
  registry.register(entity);
  addChildId(children, entity.id);
};
