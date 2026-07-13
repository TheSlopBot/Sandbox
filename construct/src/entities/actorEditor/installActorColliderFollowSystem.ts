import {
  type BoneAttachment,
  type Collider,
  type LocalTransform,
  type Registry,
  type SkeletalModel,
  type Transform,
  bakeColliderWorldFromLocal,
  createTransform,
  m4,
  m4Copy,
  m4FromTRSQuat,
  m4Mul,
  updateWorldMatrix,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { syncAttachmentOffsetFromLocal } from './spawnActorAttachment.ts';

const _renderRoot = m4();
const _boneWorld = m4();
const _localM = m4();

export const installActorColliderFollowSystem = (registry: Registry) =>
  registry.addAction(
    'update',
    () => {
      for (const e of registry.view(CONSTRUCT_KEYS.actorCollider)) {
        const t = e.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform> | undefined;
        const childOf = e.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
        const local = e.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
        if (!t || !childOf || !local) continue;

        const boneAtt = e.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
        if (boneAtt) {
          syncAttachmentOffsetFromLocal(e);

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
          m4Mul(t.world, _boneWorld, boneAtt.localOffset);
          t.dirty = false;

          const collider = e.components[COMPONENT_KEYS.collider] as Collider | undefined;
          if (collider) bakeColliderWorldFromLocal(collider, t.world);
          continue;
        }

        const parent = registry.get(childOf.parentId);
        const parentT = parent?.components[COMPONENT_KEYS.transform] as
          | ReturnType<typeof createTransform>
          | undefined;
        if (!parentT) continue;

        m4FromTRSQuat(_localM, local.position, local.rotation, local.scale);
        m4Mul(t.world, parentT.world, _localM);
        t.dirty = false;

        const collider = e.components[COMPONENT_KEYS.collider] as Collider | undefined;
        if (collider) bakeColliderWorldFromLocal(collider, t.world);
      }
    },
    22,
  );
