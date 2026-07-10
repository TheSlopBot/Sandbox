import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type LocalTransform } from '../components/localTransform.ts';
import { type ChildOf } from '../components/childOf.ts';
import { m4, m4FromTRSQuat, m4Mul } from '../math/mat4.ts';

const _localM = m4();

export const installTransformHierarchySystem = (registry: Registry) =>
  registry.addAction('update', () => {
    for (const e of registry.view(COMPONENT_KEYS.childOf)) {
      if (e.components[COMPONENT_KEYS.boneAttachment]) continue;

      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const childOf = e.components[COMPONENT_KEYS.childOf] as ChildOf | undefined;
      const local = e.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
      if (!t || !childOf || !local) continue;

      const parent = registry.get(childOf.parentId);
      const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (!parentT) continue;

      if (!t.dirty && !parentT.dirty) continue;

      updateWorldMatrix(parentT);
      m4FromTRSQuat(_localM, local.position, local.rotation, local.scale);
      m4Mul(t.world, parentT.world, _localM);
      t.dirty = false;
    }
  }, 7);
