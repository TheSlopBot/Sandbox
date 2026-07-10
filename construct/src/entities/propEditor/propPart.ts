export type ConstructPropPart = {
  partId: string;
  kind: 'asset' | 'collider';
  shape?: 'box' | 'cylinder' | 'sphere';
};

export const createConstructPropPart = (
  partId: string,
  kind: 'asset' | 'collider',
  shape?: 'box' | 'cylinder' | 'sphere',
): ConstructPropPart => ({
  partId,
  kind,
  shape,
});
