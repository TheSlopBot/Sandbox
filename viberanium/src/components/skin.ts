import { type RuntimeScene, type RuntimeSkin } from '../assets/gltf/runtime.ts';
import { type JointPaletteGpu } from '../render/gl/jointPalette.ts';

export type SkinInstance = {
  scene: RuntimeScene;
  skin: RuntimeSkin;
  palette: Float32Array;
  paletteGpu: JointPaletteGpu | null;
  jointCount: number;
  rootNodeIndex: number;
};

export const createSkinInstance = (
  scene: RuntimeScene,
  skinIndex: number,
  rootNodeIndex: number,
): SkinInstance => {
  const skin = scene.skins[skinIndex];
  if (!skin) throw new Error(`Missing skin ${skinIndex}`);
  const jointCount = skin.joints.length;
  return {
    scene,
    skin,
    jointCount,
    palette: new Float32Array(Math.max(1, jointCount) * 16),
    paletteGpu: null,
    rootNodeIndex,
  };
};
