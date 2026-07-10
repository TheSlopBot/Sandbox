export type ConstructPropRoot = {
  documentId: string;
};

export const createConstructPropRoot = (documentId: string): ConstructPropRoot => ({
  documentId,
});
