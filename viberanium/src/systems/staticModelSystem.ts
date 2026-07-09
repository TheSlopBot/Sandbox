import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type Renderable } from '../components/renderable.ts';
import { type StaticModel } from '../components/staticModel.ts';
import { type RenderGroup } from '../components/renderGroup.ts';
import { m4Mul } from '../math/mat4.ts';

export const installStaticModelSystem = (registry: Registry) =>
  registry.addAction('update', () => {
    for (const e of registry.view(COMPONENT_KEYS.staticModel)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const staticModel = e.components[COMPONENT_KEYS.staticModel] as StaticModel | undefined;
      const renderGroup = e.components[COMPONENT_KEYS.renderGroup] as RenderGroup | undefined;
      if (!t || !staticModel || !renderGroup) continue;

      updateWorldMatrix(t);

      for (const renderId of renderGroup.entityIds) {
        const re = registry.get(renderId);
        if (!re) continue;

        const r = re.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
        const nodeIndex = re.components[COMPONENT_KEYS.gltfNodeIndex] as number;
        if (!r?.model) continue;

        m4Mul(r.model as Float32Array, t.world, staticModel.scene.nodes[nodeIndex]!.worldM);
      }
    }
  }, 19);
