export const DUMMY_KEY = 'dummy';

export type Dummy = Record<string, never>;

export const createDummy = (): Dummy => ({});
