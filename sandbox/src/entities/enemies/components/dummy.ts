export type Dummy = Record<string, never>;

export const createDummy = (): Dummy => ({});
