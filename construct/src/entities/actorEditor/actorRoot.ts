export type ConstructActorRoot = {
  documentId: string;
};

export const createConstructActorRoot = (documentId: string): ConstructActorRoot => ({
  documentId,
});
