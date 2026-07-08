import { type RuntimeScene } from '../assets/gltf/runtime.ts';

export type GltfProp = {
  scene: RuntimeScene;
  renderEntityIds: number[];
};

export const createGltfProp = (scene: RuntimeScene, renderEntityIds: number[]): GltfProp => ({
  scene,
  renderEntityIds,
});
