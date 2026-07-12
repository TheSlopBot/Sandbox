export type ConstructLevelPlacementKind = 'prop' | 'actor' | 'collider' | 'playerSpawn' | 'groundPlane';

export type ConstructLevelPlacement = {
  instanceId: string;
  kind: ConstructLevelPlacementKind;
};

export const createConstructLevelPlacement = (
  instanceId: string,
  kind: ConstructLevelPlacementKind,
): ConstructLevelPlacement => ({
  instanceId,
  kind,
});
