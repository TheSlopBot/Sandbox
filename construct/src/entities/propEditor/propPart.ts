export type ConstructPropPart = {
  partId: string;
  kind: 'asset' | 'collider';
  shape?: 'box' | 'cylinder' | 'sphere' | 'capsule';
};

export const createConstructPropPart = (
  partId: string,
  kind: 'asset' | 'collider',
  shape?: 'box' | 'cylinder' | 'sphere' | 'capsule',
): ConstructPropPart => ({
  partId,
  kind,
  shape,
});
