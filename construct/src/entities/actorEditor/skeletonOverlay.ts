export type ConstructSkeletonOverlay = {
  boneName: string;
  role: 'joint' | 'bone';
  parentBoneName: string | null;
};

export const createConstructSkeletonOverlay = (
  boneName: string,
  role: 'joint' | 'bone',
  parentBoneName: string | null = null,
): ConstructSkeletonOverlay => ({
  boneName,
  role,
  parentBoneName,
});
