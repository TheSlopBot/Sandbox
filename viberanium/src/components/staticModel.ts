import { type RuntimeScene } from '../assets/gltf/runtime.ts';

export type StaticModel = {
  scene: RuntimeScene;
};

export const createStaticModel = (scene: RuntimeScene): StaticModel => ({
  scene,
});
