export type ConstructLevelOriginMarker = {
  halfExtent: number;
};

export const createConstructLevelOriginMarker = (halfExtent = 0.09): ConstructLevelOriginMarker => ({
  halfExtent,
});
