export type ConstructLevelRoot = {
  documentId: string;
};

export const createConstructLevelRoot = (documentId: string): ConstructLevelRoot => ({
  documentId,
});
