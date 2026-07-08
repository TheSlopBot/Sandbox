import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type Renderable } from '../components/renderable.ts';
import { type GltfProp } from '../components/gltfProp.ts';
import { m4Mul } from '../math/mat4.ts';

export const installGltfPropSystem = (registry: Registry) =>
  registry.addAction('update', () => {
    for (const e of registry.view(COMPONENT_KEYS.gltfProp)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const prop = e.components[COMPONENT_KEYS.gltfProp] as GltfProp | undefined;
      if (!t || !prop) continue;

      updateWorldMatrix(t);

      for (const renderId of prop.renderEntityIds) {
        const re = registry.get(renderId);
        if (!re) continue;

        const r = re.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
        const nodeIndex = re.components[COMPONENT_KEYS.gltfNodeIndex] as number;
        if (!r?.model) continue;

        m4Mul(r.model as Float32Array, t.world, prop.scene.nodes[nodeIndex]!.worldM);
      }
    }
  }, 19);
