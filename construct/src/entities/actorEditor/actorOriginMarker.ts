export type ConstructActorOriginMarker = {
  halfExtent: number;
};

export const createConstructActorOriginMarker = (
  halfExtent = 0.09,
): ConstructActorOriginMarker => ({
  halfExtent,
});
