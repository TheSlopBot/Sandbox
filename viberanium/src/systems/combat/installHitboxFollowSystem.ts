import { type Registry } from '../../engine/registry.ts';
import { type Collider, bakeColliderWorldFromLocal } from '../../components/collider.ts';
import { type Transform, updateWorldMatrix } from '../../components/transform.ts';
import { type LocalTransform } from '../../components/localTransform.ts';
import { type ChildOf } from '../../components/childOf.ts';
import { type BoneAttachment } from '../../components/boneAttachment.ts';
import { type SkeletalModel } from '../../components/skeletalModel.ts';
import { COMPONENT_KEYS } from '../../engine/componentKeys.ts';
import { COMBAT_LAYER } from '../../combat/combatLayers.ts';
import { m4FromTRSQuat, m4Mul, m4Copy, m4 } from '../../math/mat4.ts';

const _local = m4();
const _world = m4();
const _renderRoot = m4();
const _boneWorld = m4();

export const installHitboxFollowSystem = (registry: Registry) => {
  registry.addAction('postUpdate', () => {
    for (const e of registry.view(COMPONENT_KEYS.collider)) {
      const collider = e.components[COMPONENT_KEYS.collider] as Collider | undefined;
      if (!collider) continue;

      const layer = collider.combatLayer ?? 0;
      if (
        (layer &
          (COMBAT_LAYER.HURTBOX | COMBAT_LAYER.HITBOX | COMBAT_LAYER.SHIELD | COMBAT_LAYER.PROJECTILE)) ===
        0
      ) {
        continue;
      }

      const childOf = e.components[COMPONENT_KEYS.childOf] as ChildOf | undefined;
      const local = e.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
      const t = e.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (!childOf || !local || !t) continue;

      const boneAtt = e.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
      if (boneAtt) {
        const parent = registry.get(childOf.parentId);
        const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;
        const parentModel = parent?.components[COMPONENT_KEYS.skeletalModel] as
          | SkeletalModel
          | undefined;
        const boneNode = parentModel?.bodyScene.nodes[boneAtt.boneNodeIndex];
        if (!parentT || !parentModel || !boneNode) continue;

        updateWorldMatrix(parentT);
        m4Copy(_renderRoot, parentT.world);
        _renderRoot[13]! += parentModel.visualYOffset;
        m4Mul(_boneWorld, _renderRoot, boneNode.worldM);
        m4Mul(_world, _boneWorld, boneAtt.localOffset);
        for (let i = 0; i < 16; i++) t.world[i] = _world[i]!;
        t.dirty = false;

        if (collider.localShape) bakeColliderWorldFromLocal(collider, t.world);
        continue;
      }

      const parent = registry.get(childOf.parentId);
      if (!parent) continue;
      const parentT = parent.components[COMPONENT_KEYS.transform] as Transform | undefined;
      if (!parentT) continue;

      updateWorldMatrix(parentT);
      m4FromTRSQuat(_local, local.position, local.rotation, local.scale);
      m4Mul(_world, parentT.world, _local);
      for (let i = 0; i < 16; i++) t.world[i] = _world[i]!;
      t.dirty = false;

      if (collider.localShape) bakeColliderWorldFromLocal(collider, t.world);
    }
  }, 1);
};
