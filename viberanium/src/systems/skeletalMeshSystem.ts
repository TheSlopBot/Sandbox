import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type SkeletalModel } from '../components/skeletalModel.ts';
import { type MeshDraws } from '../components/meshDraws.ts';
import { computeSkinPalette } from '../assets/gltf/runtime.ts';
import { m4, m4Copy, m4Mul } from '../math/mat4.ts';
import { type Vec3 } from '../math/vec3.ts';

const SHADOW_DIST = 28;

export type SkeletalMeshOptions = {
  getLodOrigin?: () => Vec3;
};

const distSqXZ = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

export const installSkeletalMeshSystem = (registry: Registry, options: SkeletalMeshOptions = {}) => {
  const renderRootByModel = new WeakMap<SkeletalModel, Float32Array>();
  const _meshWorld = m4();
  const getLodOrigin = options.getLodOrigin;

  return registry.addAction('update', () => {
    const origin = getLodOrigin?.();
    const ox = origin ? origin[0] : 0;
    const oz = origin ? origin[2] : 0;
    const shadowDist2 = SHADOW_DIST * SHADOW_DIST;

    for (const e of registry.view(COMPONENT_KEYS.meshDraws)) {
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const model = e.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
      const meshDraws = e.components[COMPONENT_KEYS.meshDraws] as MeshDraws | undefined;
      if (!t || !model || !meshDraws) continue;

      updateWorldMatrix(t);

      const d2 = origin ? distSqXZ(t.position[0], t.position[2], ox, oz) : 0;
      const castShadow = !origin || d2 <= shadowDist2;

      let renderRootWorld = renderRootByModel.get(model);
      if (!renderRootWorld) {
        renderRootWorld = m4();
        renderRootByModel.set(model, renderRootWorld);
      }
      m4Copy(renderRootWorld, t.world);
      renderRootWorld[13] += model.visualYOffset;

      const bodyScene = model.bodyScene;

      for (const part of meshDraws.parts) {
        if (part.visible === false) continue;

        if (!part.model) part.model = m4();
        m4Mul(part.model as Float32Array, renderRootWorld, bodyScene.nodes[part.gltfNodeIndex]!.worldM);
        part.castShadow = castShadow;

        if (part.skin) {
          m4Mul(_meshWorld, renderRootWorld, bodyScene.nodes[part.skin.rootNodeIndex]!.worldM);
          computeSkinPalette(bodyScene.nodes, part.skin.skin, part.skin.palette, renderRootWorld, _meshWorld);
        }
      }
    }
  }, 19);
};
