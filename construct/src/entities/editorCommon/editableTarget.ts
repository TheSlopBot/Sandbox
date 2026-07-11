export type ConstructEditableTarget = {
  targetId: string;
};

export const createConstructEditableTarget = (targetId: string): ConstructEditableTarget => ({
  targetId,
});
