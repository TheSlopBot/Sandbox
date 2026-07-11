export type ConstructActorSelection =
  | { kind: 'actor' }
  | { kind: 'bone'; boneName: string }
  | { kind: 'attachment'; attachmentId: string }
  | { kind: 'collider'; colliderId: string }
  | { kind: 'none' };

export const createConstructActorSelection = (): ConstructActorSelection => ({
  kind: 'none',
});
