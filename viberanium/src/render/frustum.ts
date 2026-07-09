import { type Mat4 } from '../math/mat4.ts';

export type FrustumPlanes = Float32Array;

const _center = new Float32Array(3);

export const createFrustumPlanes = (): FrustumPlanes => new Float32Array(24);

export const extractFrustumPlanes = (out: FrustumPlanes, viewProj: Mat4): void => {
  const setPlane = (offset: number, a: number, b: number, c: number, d: number) => {
    const invLen = 1 / Math.hypot(a, b, c);
    out[offset] = a * invLen;
    out[offset + 1] = b * invLen;
    out[offset + 2] = c * invLen;
    out[offset + 3] = d * invLen;
  };

  setPlane(0, viewProj[3]! + viewProj[0]!, viewProj[7]! + viewProj[4]!, viewProj[11]! + viewProj[8]!, viewProj[15]! + viewProj[12]!);
  setPlane(4, viewProj[3]! - viewProj[0]!, viewProj[7]! - viewProj[4]!, viewProj[11]! - viewProj[8]!, viewProj[15]! - viewProj[12]!);
  setPlane(8, viewProj[3]! + viewProj[1]!, viewProj[7]! + viewProj[5]!, viewProj[11]! + viewProj[9]!, viewProj[15]! + viewProj[13]!);
  setPlane(12, viewProj[3]! - viewProj[1]!, viewProj[7]! - viewProj[5]!, viewProj[11]! - viewProj[9]!, viewProj[15]! - viewProj[13]!);
  setPlane(16, viewProj[3]! + viewProj[2]!, viewProj[7]! + viewProj[6]!, viewProj[11]! + viewProj[10]!, viewProj[15]! + viewProj[14]!);
  setPlane(20, viewProj[3]! - viewProj[2]!, viewProj[7]! - viewProj[6]!, viewProj[11]! - viewProj[10]!, viewProj[15]! - viewProj[14]!);
};

export const isSphereInFrustumPlanes = (
  planes: FrustumPlanes,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
): boolean => {
  for (let i = 0; i < 24; i += 4) {
    if (planes[i]! * cx + planes[i + 1]! * cy + planes[i + 2]! * cz + planes[i + 3]! < -radius) {
      return false;
    }
  }
  return true;
};

export const isSphereInFrustum = (
  planes: FrustumPlanes,
  model: Mat4,
  localCenter: readonly [number, number, number],
  localRadius: number,
): boolean => {
  const lx = localCenter[0]!;
  const ly = localCenter[1]!;
  const lz = localCenter[2]!;

  _center[0] = model[0]! * lx + model[4]! * ly + model[8]! * lz + model[12]!;
  _center[1] = model[1]! * lx + model[5]! * ly + model[9]! * lz + model[13]!;
  _center[2] = model[2]! * lx + model[6]! * ly + model[10]! * lz + model[14]!;

  const sx2 = model[0]! * model[0]! + model[1]! * model[1]! + model[2]! * model[2]!;
  const sy2 = model[4]! * model[4]! + model[5]! * model[5]! + model[6]! * model[6]!;
  const sz2 = model[8]! * model[8]! + model[9]! * model[9]! + model[10]! * model[10]!;
  const radius = localRadius * Math.sqrt(Math.max(sx2, sy2, sz2));

  return isSphereInFrustumPlanes(planes, _center[0]!, _center[1]!, _center[2]!, radius);
};
