import {
  type Entity,
  type LocalTransform,
  type Mat4,
  type StaticModel,
  type Vec3,
  COMPONENT_KEYS,
  q4TransformVec3,
  v3,
} from 'viberanium';
import {
  boundsCenter,
  createEmptyBounds,
  expandBoundsFromInterleaved,
  isBoundsValid,
} from '../viewer/modelBounds.ts';

const _scaled = v3();
const _rotated = v3();

export const partModelSpaceCenter = (out: Vec3, entity: Entity): Vec3 => {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;

  const staticModel = entity.components[COMPONENT_KEYS.staticModel] as StaticModel | undefined;
  if (!staticModel) return out;

  const bounds = createEmptyBounds();
  for (const pair of staticModel.scene.meshNodePairs) {
    const model = staticModel.scene.models[pair.meshIndex];
    if (!model) continue;

    const node = staticModel.scene.nodes[pair.nodeIndex];
    if (!node) continue;

    for (const prim of model.primitives) {
      if (prim.kind === 'skinned') continue;
      expandBoundsFromInterleaved(bounds, prim.vertices, node.worldM);
    }
  }

  if (!isBoundsValid(bounds)) return out;

  const center = boundsCenter(bounds);
  out[0] = center[0];
  out[1] = center[1];
  out[2] = center[2];
  return out;
};

export const worldFromModelPoint = (out: Vec3, worldM: Mat4, modelPoint: Vec3): Vec3 => {
  out[0] = worldM[0]! * modelPoint[0] + worldM[4]! * modelPoint[1] + worldM[8]! * modelPoint[2] + worldM[12]!;
  out[1] = worldM[1]! * modelPoint[0] + worldM[5]! * modelPoint[1] + worldM[9]! * modelPoint[2] + worldM[13]!;
  out[2] = worldM[2]! * modelPoint[0] + worldM[6]! * modelPoint[1] + worldM[10]! * modelPoint[2] + worldM[14]!;
  return out;
};

export const localPivotFromTransform = (
  out: Vec3,
  local: LocalTransform,
  modelCenter: Vec3,
): Vec3 => {
  _scaled[0] = modelCenter[0] * local.scale[0];
  _scaled[1] = modelCenter[1] * local.scale[1];
  _scaled[2] = modelCenter[2] * local.scale[2];
  q4TransformVec3(_rotated, local.rotation, _scaled);
  out[0] = local.position[0] + _rotated[0];
  out[1] = local.position[1] + _rotated[1];
  out[2] = local.position[2] + _rotated[2];
  return out;
};

export const setLocalPositionForPivot = (
  local: LocalTransform,
  pivotParent: Vec3,
  modelCenter: Vec3,
) => {
  _scaled[0] = modelCenter[0] * local.scale[0];
  _scaled[1] = modelCenter[1] * local.scale[1];
  _scaled[2] = modelCenter[2] * local.scale[2];
  q4TransformVec3(_rotated, local.rotation, _scaled);
  local.position[0] = pivotParent[0] - _rotated[0];
  local.position[1] = pivotParent[1] - _rotated[1];
  local.position[2] = pivotParent[2] - _rotated[2];
};
