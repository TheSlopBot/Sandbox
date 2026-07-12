import {
  type Registry,
  type Transform,
  type LocalTransform,
  type Collider,
  type Children,
  type Mat4,
  bakeColliderWorldFromLocal,
  m4,
  m4Copy,
  m4FromTRSQuat,
  m4Mul,
  COMPONENT_KEYS,
} from 'viberanium';

export const syncPartLocalToWorld = (
  registry: Registry,
  selected: { components: Record<string, unknown>; id?: number },
) => {
  const t = selected.components[COMPONENT_KEYS.transform] as Transform | undefined;
  const local = selected.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  const childOf = selected.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  if (!t || !local || !childOf) return;

  const parent = registry.get(childOf.parentId);
  const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;
  if (!parentT) return;

  const localM = m4();
  m4FromTRSQuat(localM, local.position, local.rotation, local.scale);
  m4Mul(t.world, parentT.world, localM);
  t.dirty = false;

  const collider = selected.components[COMPONENT_KEYS.collider] as Collider | undefined;
  if (collider) bakeColliderWorldFromLocal(collider, t.world);

  const staticModel = selected.components[COMPONENT_KEYS.staticModel] as
    | { scene: { nodes: Array<{ worldM: Mat4 }> } }
    | undefined;
  const renderGroup = selected.components[COMPONENT_KEYS.renderGroup] as
    | { entityIds: number[] }
    | undefined;
  if (staticModel && renderGroup) {
    for (const renderId of renderGroup.entityIds) {
      const re = registry.get(renderId);
      if (!re) continue;
      const r = re.components[COMPONENT_KEYS.renderable] as { model?: Mat4 } | undefined;
      const nodeIndex = re.components[COMPONENT_KEYS.gltfNodeIndex] as number;
      if (!r?.model) continue;
      const nodeWorld = staticModel.scene.nodes[nodeIndex]?.worldM;
      if (nodeWorld) m4Mul(r.model, t.world, nodeWorld);
      else m4Copy(r.model, t.world);
    }
  }

  const children = selected.components[COMPONENT_KEYS.children] as Children | undefined;
  if (!children) return;

  for (const childId of children.ids) {
    const child = registry.get(childId);
    if (!child) continue;
    if (child.components[COMPONENT_KEYS.boneAttachment]) continue;
    syncPartLocalToWorld(registry, child);
  }
};
