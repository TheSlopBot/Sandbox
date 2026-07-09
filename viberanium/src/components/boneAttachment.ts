import { type RuntimeScene } from '../assets/gltf/runtime.ts';
import { type Mat4, m4, m4FromTRSQuat } from '../math/mat4.ts';
import { v3 } from '../math/vec3.ts';
import { q4, q4Normalize } from '../math/quat.ts';

export type BoneAttachment = {
  boneNodeIndex: number;
  localOffset: Mat4;
  attachScene: RuntimeScene;
};

export const createBoneAttachment = (
  attachScene: RuntimeScene,
  boneNodeIndex: number,
  localOffset: Mat4,
): BoneAttachment => ({
  boneNodeIndex,
  localOffset,
  attachScene,
});

export const createAttachmentOffset = (
  t: [number, number, number] = [0, 0, 0],
  r: [number, number, number, number] = [0, 0, 0, 1],
  s: [number, number, number] = [1, 1, 1],
): Mat4 => {
  const out = m4();
  const tv = v3(t[0], t[1], t[2]);
  const rv = q4(r[0], r[1], r[2], r[3]);
  q4Normalize(rv, rv);
  const sv = v3(s[0], s[1], s[2]);
  m4FromTRSQuat(out, tv, rv, sv);
  return out;
};
