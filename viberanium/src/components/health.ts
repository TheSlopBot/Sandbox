export type Health = {
  current: number;
  max: number;
  dead: boolean;
  flashRemaining: number;
};

export const createHealth = (max = 10): Health => ({
  current: max,
  max,
  dead: false,
  flashRemaining: 0,
});
