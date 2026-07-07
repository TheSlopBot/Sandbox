import { type RuntimeScene, type RuntimeSkin } from '../../assets/gltf/runtime.ts';

export type SkinInstance = {
  scene: RuntimeScene;
  skin: RuntimeSkin;
  palette: Float32Array; // jointCount * 16
  jointCount: number;
  rootNodeIndex: number; // node that owns the mesh
};

export function createSkinInstance(scene: RuntimeScene, skinIndex: number, rootNodeIndex: number): SkinInstance {
  const skin = scene.skins[skinIndex];
  if (!skin) throw new Error(`Missing skin ${skinIndex}`);
  const jointCount = skin.joints.length;
  return { scene, skin, jointCount, palette: new Float32Array(Math.max(1, jointCount) * 16), rootNodeIndex };
}

