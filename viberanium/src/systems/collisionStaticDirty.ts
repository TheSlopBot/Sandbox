const listeners = new Set<() => void>();

export const markCollisionStaticDirty = (): void => {
  for (const listener of listeners) listener();
};

export const onCollisionStaticDirty = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
