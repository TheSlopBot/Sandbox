export const INSTANCE_FLOATS = 24;
export const INSTANCE_STRIDE = INSTANCE_FLOATS * 4;

export type StaticInstanceCpu = {
  model: Float32Array;
  color: readonly [number, number, number, number];
  center: readonly [number, number, number];
  radius: number;
  castShadow: boolean;
};

export const writeStaticInstance = (
  out: Float32Array,
  offsetFloats: number,
  instance: StaticInstanceCpu,
) => {
  out.set(instance.model, offsetFloats);
  out[offsetFloats + 16] = instance.color[0];
  out[offsetFloats + 17] = instance.color[1];
  out[offsetFloats + 18] = instance.color[2];
  out[offsetFloats + 19] = instance.color[3];
  out[offsetFloats + 20] = instance.center[0];
  out[offsetFloats + 21] = instance.center[1];
  out[offsetFloats + 22] = instance.center[2];
  out[offsetFloats + 23] = instance.radius;
};
