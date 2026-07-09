import { type Registry } from '../engine/registry.ts';
import { COMPONENT_KEYS } from '../engine/componentKeys.ts';
import { type Transform, updateWorldMatrix } from '../components/transform.ts';
import { type ChildOf } from '../components/childOf.ts';
import { type BoneAttachment } from '../components/boneAttachment.ts';
import { type SkeletalModel } from '../components/skeletalModel.ts';
import { type Renderable } from '../components/renderable.ts';
import { type MeshDraws } from '../components/meshDraws.ts';
import {
  DEFAULT_ENGINE_OPTIMIZATION,
  type EngineOptimizationOptions,
} from '../engine/optimizationOptions.ts';
import { m4, m4Copy, m4Mul } from '../math/mat4.ts';
import { type Vec3 } from '../math/vec3.ts';

export type BoneAttachmentOptions = {
  getLodOrigin?: () => Vec3;
  optimization?: EngineOptimizationOptions;
};

const distSqXZ = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};

export const installBoneAttachmentSystem = (registry: Registry, options: BoneAttachmentOptions = {}) => {
  const getLodOrigin = options.getLodOrigin;
  const optimization = options.optimization ?? DEFAULT_ENGINE_OPTIMIZATION;

  return registry.addAction('update', () => {
    const _boneWorld = m4();
    const _attachRoot = m4();
    const _renderRoot = m4();
    const origin = getLodOrigin?.();
    const ox = origin ? origin[0] : 0;
    const oz = origin ? origin[2] : 0;
    const shadowDist2 = optimization.shadowCullDist * optimization.shadowCullDist;

    for (const e of registry.view(COMPONENT_KEYS.boneAttachment)) {
      const childOf = e.components[COMPONENT_KEYS.childOf] as ChildOf | undefined;
      const attachment = e.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (!childOf || !attachment || !t) continue;

      const parent = registry.get(childOf.parentId);
      if (!parent) continue;

      const parentT = parent.components[COMPONENT_KEYS.transform] as Transform | undefined;
      const parentModel = parent.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
      if (!parentT || !parentModel) continue;

      updateWorldMatrix(parentT);

      const boneNode = parentModel.bodyScene.nodes[attachment.boneNodeIndex];
      if (!boneNode) continue;

      const d2 = origin ? distSqXZ(parentT.position[0], parentT.position[2], ox, oz) : 0;
      const castShadow = !origin || d2 <= shadowDist2;

      m4Copy(_renderRoot, parentT.world);
      _renderRoot[13] += parentModel.visualYOffset;
      m4Mul(_boneWorld, _renderRoot, boneNode.worldM);
      m4Mul(_attachRoot, _boneWorld, attachment.localOffset);
      m4Copy(t.world, _attachRoot);

      const meshDraws = e.components[COMPONENT_KEYS.meshDraws] as MeshDraws | undefined;
      if (meshDraws) {
        for (const part of meshDraws.parts) {
          if (part.visible === false) continue;
          const node = attachment.attachScene.nodes[part.gltfNodeIndex];
          if (!node) continue;
          if (!part.model) part.model = m4();
          m4Mul(part.model as Float32Array, _attachRoot, node.worldM);
          part.castShadow = castShadow;
        }
        continue;
      }

      const renderable = e.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
      const nodeIndex = e.components[COMPONENT_KEYS.gltfNodeIndex] as number | undefined;
      if (!renderable?.model || nodeIndex === undefined) continue;

      const node = attachment.attachScene.nodes[nodeIndex];
      if (!node) continue;

      m4Mul(renderable.model as Float32Array, _attachRoot, node.worldM);
      renderable.castShadow = castShadow;
    }
  }, 20);
};
