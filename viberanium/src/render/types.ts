import { type Mat4 } from '../math/mat4.ts';

export type Material = {
  name: string;
  baseColorTex: WebGLTexture | null;
  baseColorFactor: [number, number, number, number];
  alphaMode: 'OPAQUE' | 'BLEND';
};

export type DrawItem = {
  mesh: { vao: WebGLVertexArrayObject; indexCount: number };
  material: Material;
  model: Mat4;
  sortZ: number;
  skin?: { palette: Float32Array; jointCount: number };
  castShadow: boolean;
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
  map: WebGLTexture;
  mapSize: number;
};

