import { type EntityId } from '../engine/entity.ts';

export type RenderGroup = {
  entityIds: EntityId[];
};

export const createRenderGroup = (entityIds: EntityId[]): RenderGroup => ({
  entityIds,
});
