export type Gltf = {
  asset: { version: string };
  buffers?: Array<{ uri?: string; byteLength: number }>;
  bufferViews?: Array<{
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  }>;
  accessors?: Array<{
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    normalized?: boolean;
    type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT4';
  }>;
  images?: Array<{ uri?: string; bufferView?: number; mimeType?: string }>;
  textures?: Array<{ source: number }>;
  samplers?: Array<Record<string, unknown>>;
  materials?: Array<{
    name?: string;
    pbrMetallicRoughness?: {
      baseColorFactor?: [number, number, number, number];
      baseColorTexture?: { index: number };
    };
    alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND';
    alphaCutoff?: number;
    doubleSided?: boolean;
  }>;
  meshes?: Array<{
    primitives: Array<{
      attributes: Record<string, number>;
      indices?: number;
      material?: number;
      mode?: number;
    }>;
  }>;
  nodes?: Array<{
    name?: string;
    mesh?: number;
    skin?: number;
    children?: number[];
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    matrix?: number[];
  }>;
  scenes?: Array<{ nodes: number[] }>;
  scene?: number;

  skins?: Array<{
    inverseBindMatrices?: number;
    joints: number[];
    skeleton?: number;
    name?: string;
  }>;

  animations?: Array<{
    name?: string;
    samplers: Array<{
      input: number;
      output: number;
      interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE';
    }>;
    channels: Array<{
      sampler: number;
      target: { node: number; path: 'translation' | 'rotation' | 'scale' | 'weights' };
    }>;
  }>;
};

