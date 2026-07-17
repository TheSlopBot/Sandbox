import { type Mat4 } from '../math/mat4.ts';
import { type Mesh } from './gl/mesh.ts';
import { type TextureHandle } from './gl/texture.ts';
import { type LevelGroundVariant } from '../definitions/levels/levelDefinition.ts';

export type Material = {
  name: string;
  baseColorTex: TextureHandle | null;
  baseColorFactor: [number, number, number, number];
  alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
  alphaCutoff?: number;
  doubleSided?: boolean;
};

export type DrawItemGpuModel = {
  buffer: GPUBuffer;
  byteOffset: number;
};

export type DrawItemSkin = {
  jointCount: number;
  paletteGpu: { buffer: GPUBuffer; bindGroup: GPUBindGroup };
};

export type DrawItem = {
  mesh: Mesh;
  material: Material;
  model: Mat4;
  sortZ: number;
  skin?: DrawItemSkin;
  gpuModel?: DrawItemGpuModel;
  castShadow: boolean;
  overlay?: boolean;
  colorFactor?: [number, number, number, number];
};

export type Camera = {
  viewProj: Mat4;
  position: Float32Array;
};

export const DIRECTIONAL_LIGHT = {
  dir: [0.45, -0.85, 0.30] as const,
  ambient: [0.26, 0.25, 0.24] as const,
  color: [1.0, 0.96, 0.92] as const,
};

export type ShadowState = {
  lightViewProj: Mat4;
  mapSize: number;
};

export type GroundDraw = {
  mesh: Mesh;
  model: Mat4;
  alpha: number;
  variant: LevelGroundVariant;
};
