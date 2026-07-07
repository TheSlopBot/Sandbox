import { type Registry, useRegistry } from './registry.ts';

export type Scene = {
  readonly registry: Registry;
  load: () => Promise<void>;
  unload: () => void;
};

export const useScene = (): Scene => {
  const registry = useRegistry();

  return {
    registry,
    load: async () => {},
    unload: () => {},
  };
};
