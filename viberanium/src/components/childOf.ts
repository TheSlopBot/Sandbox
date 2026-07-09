import { type EntityId } from '../engine/entity.ts';

export type ChildOf = {
  parentId: EntityId;
};

export const createChildOf = (parentId: EntityId): ChildOf => ({
  parentId,
});
