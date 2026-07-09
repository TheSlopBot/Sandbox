import { type EntityId } from '../engine/entity.ts';

export type Children = {
  ids: EntityId[];
};

export const createChildren = (ids: EntityId[] = []): Children => ({
  ids,
});

export const addChildId = (children: Children, childId: EntityId): void => {
  children.ids.push(childId);
};

export const removeChildId = (children: Children, childId: EntityId): void => {
  const idx = children.ids.indexOf(childId);
  if (idx >= 0) children.ids.splice(idx, 1);
};
