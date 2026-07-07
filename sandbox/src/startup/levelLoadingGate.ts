export type LevelLoadingGate = {
  show: () => void;
  hide: () => void;
};

export const createLevelLoadingGate = (): LevelLoadingGate => {
  let depth = 0;

  return {
    show: () => {
      if (++depth === 1) document.body.classList.add('is-loading');
    },
    hide: () => {
      if (--depth <= 0) {
        depth = 0;
        document.body.classList.remove('is-loading');
      }
    },
  };
};
