export type ConstructActorAttachment = {
  attachmentId: string;
};

export const createConstructActorAttachment = (
  attachmentId: string,
): ConstructActorAttachment => ({
  attachmentId,
});
