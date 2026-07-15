export type Destructible = {
  hookId: string;
};

export const createDestructible = (hookId: string): Destructible => ({ hookId });
