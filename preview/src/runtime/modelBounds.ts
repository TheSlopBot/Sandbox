export type Bounds = {
  min: [number, number, number];
  max: [number, number, number];
};

export const createEmptyBounds = (): Bounds => ({
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
});

export const expandBoundsFromInterleaved = (
  bounds: Bounds,
  vertices: Float32Array,
  worldM?: Float32Array,
) => {
  const { min, max } = bounds;

  for (let i = 0; i < vertices.length; i += 8) {
    const lx = vertices[i]!;
    const ly = vertices[i + 1]!;
    const lz = vertices[i + 2]!;

    let x = lx;
    let y = ly;
    let z = lz;

    if (worldM) {
      x = worldM[0]! * lx + worldM[4]! * ly + worldM[8]! * lz + worldM[12]!;
      y = worldM[1]! * lx + worldM[5]! * ly + worldM[9]! * lz + worldM[13]!;
      z = worldM[2]! * lx + worldM[6]! * ly + worldM[10]! * lz + worldM[14]!;
    }

    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }
};

export const boundsCenter = (bounds: Bounds): [number, number, number] => [
  (bounds.min[0] + bounds.max[0]) * 0.5,
  (bounds.min[1] + bounds.max[1]) * 0.5,
  (bounds.min[2] + bounds.max[2]) * 0.5,
];

export const boundsRadius = (bounds: Bounds): number => {
  const hx = (bounds.max[0] - bounds.min[0]) * 0.5;
  const hy = (bounds.max[1] - bounds.min[1]) * 0.5;
  const hz = (bounds.max[2] - bounds.min[2]) * 0.5;
  return Math.sqrt(hx * hx + hy * hy + hz * hz);
};

export const isBoundsValid = (bounds: Bounds): boolean => Number.isFinite(bounds.min[0]);
