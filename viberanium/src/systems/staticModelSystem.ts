import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type Renderable } from '../components/renderable.ts';
import { type StaticModel } from '../components/staticModel.ts';
import { type RenderGroup } from '../components/renderGroup.ts';
import { type ChildOf } from '../components/childOf.ts';
import { type LocalTransform } from '../components/localTransform.ts';
import { m4Copy, m4Mul } from '../math/mat4.ts';

export const installStaticModelSystem = (registry: Registry) =>
  registry.addAction('update', () => {
    for (const e of registry.view(COMPONENT_KEYS.staticModel)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const staticModel = e.components[COMPONENT_KEYS.staticModel] as StaticModel | undefined;
      const renderGroup = e.components[COMPONENT_KEYS.renderGroup] as RenderGroup | undefined;
      if (!t || !staticModel || !renderGroup) continue;

      const childOf = e.components[COMPONENT_KEYS.childOf] as ChildOf | undefined;
      const local = e.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
      const isHierarchyChild = childOf !== undefined && local !== undefined;

      if (!isHierarchyChild && !t.dirty) continue;

      if (!isHierarchyChild) updateWorldMatrix(t);

      for (const renderId of renderGroup.entityIds) {
        const re = registry.get(renderId);
        if (!re) continue;

        const r = re.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
        const nodeIndex = re.components[COMPONENT_KEYS.gltfNodeIndex] as number;
        if (!r?.model) continue;

        const nodeWorld = staticModel.scene.nodes[nodeIndex]?.worldM;
        if (nodeWorld) m4Mul(r.model as Float32Array, t.world, nodeWorld);
        else m4Copy(r.model as Float32Array, t.world);
      }
    }
  }, 19);
