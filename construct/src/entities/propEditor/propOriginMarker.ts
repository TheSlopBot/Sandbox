export type ConstructPropOriginMarker = {
  halfExtent: number;
};

export const createConstructPropOriginMarker = (
  halfExtent = 0.09,
): ConstructPropOriginMarker => ({
  halfExtent,
});
