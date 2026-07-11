import {
  type Collider,
  type LocalTransform,
  type Registry,
  bakeColliderWorldFromLocal,
  createTransform,
  m4,
  m4FromTRSQuat,
  m4Mul,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';

export const installActorColliderFollowSystem = (registry: Registry) =>
  registry.addAction(
    'update',
    () => {
      for (const e of registry.view(CONSTRUCT_KEYS.actorCollider)) {
        if (e.components[COMPONENT_KEYS.boneAttachment]) continue;

        const t = e.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform> | undefined;
        const childOf = e.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
        const local = e.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
        if (!t || !childOf || !local) continue;

        const parent = registry.get(childOf.parentId);
        const parentT = parent?.components[COMPONENT_KEYS.transform] as
          | ReturnType<typeof createTransform>
          | undefined;
        if (!parentT) continue;

        const localM = m4();
        m4FromTRSQuat(localM, local.position, local.rotation, local.scale);
        m4Mul(t.world, parentT.world, localM);
        t.dirty = false;

        const collider = e.components[COMPONENT_KEYS.collider] as Collider | undefined;
        if (collider) bakeColliderWorldFromLocal(collider, t.world);
      }
    },
    21,
  );
