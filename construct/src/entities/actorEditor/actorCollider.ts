import type { ActorColliderShape } from '../../catalog/actors/actorDocument.ts';

export type ConstructActorCollider = {
  colliderId: string;
  shape: ActorColliderShape;
  collision: boolean;
  hitbox: boolean;
};

export const createConstructActorCollider = (
  colliderId: string,
  shape: ActorColliderShape,
  collision: boolean,
  hitbox: boolean,
): ConstructActorCollider => ({
  colliderId,
  shape,
  collision,
  hitbox,
});
