import {
  type GpuDevice,
  type Material,
  type Registry,
  type RuntimeScene,
  createInterleavedMesh,
  createTransform,
  destroyMesh,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { createBoxMesh } from '../gizmos/meshes.ts';
import { createConstructSkeletonOverlay } from './skeletonOverlay.ts';

const JOINT_RADIUS = 0.025;
const BONE_HALF_X = 0.008;
const BONE_HALF_Z = 0.008;

const buildUvSphere = (radius: number, rings: number, segments: number) => {
  const rr = Math.max(3, rings);
  const ss = Math.max(3, segments);
  const vertexCount = (rr + 1) * (ss + 1);
  const v = new Float32Array(vertexCount * 8);
  let vi = 0;

  for (let r = 0; r <= rr; r++) {
    const vFrac = r / rr;
    const phi = vFrac * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let s = 0; s <= ss; s++) {
      const uFrac = s / ss;
      const theta = uFrac * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const nx = cosTheta * sinPhi;
      const ny = cosPhi;
      const nz = sinTheta * sinPhi;
      v[vi++] = nx * radius;
      v[vi++] = ny * radius;
      v[vi++] = nz * radius;
      v[vi++] = nx;
      v[vi++] = ny;
      v[vi++] = nz;
      v[vi++] = uFrac;
      v[vi++] = 1 - vFrac;
    }
  }

  const idx = new Uint32Array(rr * ss * 6);
  let ii = 0;

  for (let r = 0; r < rr; r++) {
    for (let s = 0; s < ss; s++) {
      const a = r * (ss + 1) + s;
      const b = a + ss + 1;
      const c = b + 1;
      const d = a + 1;
      idx[ii++] = a;
      idx[ii++] = b;
      idx[ii++] = d;
      idx[ii++] = d;
      idx[ii++] = b;
      idx[ii++] = c;
    }
  }

  return { v, idx };
};

export const spawnSkeletonOverlay = (
  device: GpuDevice,
  registry: Registry,
  bodyScene: RuntimeScene,
  boneNames: string[],
) => {
  const jointSet = new Set(boneNames);
  const nameToIndex = new Map<string, number>();

  for (let i = 0; i < bodyScene.nodes.length; i++) {
    const name = bodyScene.nodes[i]!.name;
    if (jointSet.has(name)) nameToIndex.set(name, i);
  }

  const jointMaterial = (): Material => ({
    name: 'skeleton-joint',
    baseColorTex: null,
    baseColorFactor: [1, 1, 1, 0.95],
    alphaMode: 'BLEND',
  });

  const boneMaterial = (): Material => ({
    name: 'skeleton-bone',
    baseColorTex: null,
    baseColorFactor: [1, 1, 1, 0.85],
    alphaMode: 'BLEND',
  });

  for (const boneName of boneNames) {
    const { v, idx } = buildUvSphere(JOINT_RADIUS, 8, 12);
    const mesh = createInterleavedMesh(device, v, idx);
    const child = registry.createBare();
    const t = createTransform();
    child.components[COMPONENT_KEYS.transform] = t;
    child.components[CONSTRUCT_KEYS.skeletonOverlay] = createConstructSkeletonOverlay(
      boneName,
      'joint',
      null,
    );
    child.components[COMPONENT_KEYS.renderable] = {
      mesh,
      material: jointMaterial(),
      castShadow: false,
      overlay: true,
    };
    child.onDeregister.push(() => destroyMesh(device, mesh));
    registry.register(child);
  }

  for (const boneName of boneNames) {
    const nodeIndex = nameToIndex.get(boneName);
    if (nodeIndex === undefined) continue;

    const node = bodyScene.nodes[nodeIndex]!;
    if (node.parent < 0) continue;

    const parentName = bodyScene.nodes[node.parent]?.name;
    if (!parentName || !jointSet.has(parentName)) continue;

    const mesh = createBoxMesh(device, BONE_HALF_X, 0.5, BONE_HALF_Z);
    const child = registry.createBare();
    const t = createTransform();
    child.components[COMPONENT_KEYS.transform] = t;
    child.components[CONSTRUCT_KEYS.skeletonOverlay] = createConstructSkeletonOverlay(
      boneName,
      'bone',
      parentName,
    );
    child.components[COMPONENT_KEYS.renderable] = {
      mesh,
      material: boneMaterial(),
      castShadow: false,
      overlay: true,
    };
    child.onDeregister.push(() => destroyMesh(device, mesh));
    registry.register(child);
  }
};
