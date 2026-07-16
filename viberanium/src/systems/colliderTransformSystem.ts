import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform } from '../components/transform.ts';
import { type Collider, bakeColliderWorldFromLocal } from '../components/collider.ts';
import { updateWorldMatrix } from '../components/transform.ts';

export const installColliderTransformSystem = (registry: Registry) =>
  registry.addAction('update', () => {
    for (const e of registry.view(COMPONENT_KEYS.collider)) {
      if (e.components[COMPONENT_KEYS.boneAttachment]) continue;

      const collider = e.components[COMPONENT_KEYS.collider] as Collider | undefined;
      if (!collider?.localShape) continue;

      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (!t) continue;
      if (collider.isStatic && !t.dirty) continue;

      updateWorldMatrix(t);
      bakeColliderWorldFromLocal(collider, t.world);
    }
  }, 8);
