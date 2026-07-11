import { type Material } from '../../render/types.ts';
import { createInterleavedMesh, createSkinnedMesh } from '../../render/gl/mesh.ts';
import { type GpuDevice } from '../../render/gl/device.ts';
import { createSkinInstance } from '../../components/skin.ts';
import { createMeshDraws, type MeshDrawPart, type MeshDraws } from '../../components/meshDraws.ts';
import { type RuntimeScene } from './runtime.ts';

export const findBoneNodeIndex = (
  nodes: RuntimeScene['nodes'],
  boneName: string,
): number => {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i]!.name === boneName) return i;
  }

  throw new Error(`Missing bone '${boneName}' on character rig`);
};

export const buildMeshDrawsFromRuntimeScene = (
  device: GpuDevice,
  bodyScene: RuntimeScene,
  mats: Material[],
): MeshDraws => {
  const parts: MeshDrawPart[] = [];
  const nameToBody = new Map<string, number>();
  const skinByIndex = new Map<number, ReturnType<typeof createSkinInstance>>();

  for (let i = 0; i < bodyScene.nodes.length; i++) nameToBody.set(bodyScene.nodes[i]!.name, i);

  for (const pair of bodyScene.meshNodePairs) {
    const model = bodyScene.models[pair.meshIndex];
    if (!model) continue;

    let skinInst = null as ReturnType<typeof createSkinInstance> | null;

    if (pair.skinIndex >= 0) {
      const existing = skinByIndex.get(pair.skinIndex);
      if (existing) {
        skinInst = existing;
      } else {
        const srcSkin = bodyScene.skins[pair.skinIndex];
        if (!srcSkin) continue;

        const remappedJoints: number[] = [];

        for (const jNode of srcSkin.joints) {
          const jName = bodyScene.nodes[jNode]?.name;
          remappedJoints.push(jName ? (nameToBody.get(jName) ?? 0) : 0);
        }

        const fakeScene = {
          ...bodyScene,
          nodes: bodyScene.nodes,
          skins: [{ ...srcSkin, joints: remappedJoints }],
        } as RuntimeScene;
        skinInst = createSkinInstance(fakeScene, 0, pair.nodeIndex);
        skinByIndex.set(pair.skinIndex, skinInst);
      }
    }

    for (const prim of model.primitives) {
      const material =
        prim.materialIndex >= 0 && prim.materialIndex < mats.length
          ? mats[prim.materialIndex]!
          : mats[0]!;

      if (prim.kind === 'skinned' && skinInst) {
        const mesh = createSkinnedMesh(
          device,
          prim.vertices,
          prim.joints,
          prim.weights,
          prim.indices,
          skinInst.jointCount,
        );
        parts.push({ mesh, material, gltfNodeIndex: pair.nodeIndex, skin: skinInst });
        continue;
      }

      const mesh = createInterleavedMesh(device, prim.vertices, prim.indices);
      parts.push({ mesh, material, gltfNodeIndex: pair.nodeIndex });
    }
  }

  return createMeshDraws(parts);
};
