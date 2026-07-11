export type ConstructActorCharacter = {
  url: string;
};

export const createConstructActorCharacter = (url: string): ConstructActorCharacter => ({
  url,
});
