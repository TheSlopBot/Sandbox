import {
  type LocalTransform,
  type Transform,
  m4,
  m4FromTRSQuat,
  m4Mul,
  updateWorldMatrix,
} from 'viberanium';

export type PartLocalSource = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

export const applyLocalFromTRS = (local: LocalTransform, source: PartLocalSource) => {
  local.position[0] = source.position[0];
  local.position[1] = source.position[1];
  local.position[2] = source.position[2];
  local.rotation[0] = source.rotation[0];
  local.rotation[1] = source.rotation[1];
  local.rotation[2] = source.rotation[2];
  local.rotation[3] = source.rotation[3];
  local.scale[0] = source.scale[0];
  local.scale[1] = source.scale[1];
  local.scale[2] = source.scale[2];
};

export const bakeChildWorld = (parentT: Transform, childT: Transform, local: LocalTransform) => {
  updateWorldMatrix(parentT);
  const localM = m4();
  m4FromTRSQuat(localM, local.position, local.rotation, local.scale);
  m4Mul(childT.world, parentT.world, localM);
  childT.dirty = false;
};
