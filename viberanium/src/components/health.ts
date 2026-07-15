export type Health = {
  current: number;
  max: number;
  dead: boolean;
};

export const createHealth = (max = 100): Health => ({
  current: max,
  max,
  dead: false,
});
