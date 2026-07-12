import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type GroundPlane } from '../components/groundPlane.ts';

export const readGroundPlaneY = (registry: Registry): number => {
  for (const e of registry.view(COMPONENT_KEYS.groundPlane)) {
    const ground = e.components[COMPONENT_KEYS.groundPlane] as GroundPlane | undefined;
    if (!ground) continue;

    const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (t) {
      updateWorldMatrix(t);
      return t.world[13]!;
    }

    return ground.model[13]!;
  }

  return 0;
};
