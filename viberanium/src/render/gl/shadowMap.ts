import { type GpuDevice } from './device.ts';

export type ShadowMap = {
  readonly size: number;
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
  readonly sampler: GPUSampler;
  destroy: () => void;
};

export const createShadowMap = (device: GpuDevice, size = 2048): ShadowMap => {
  const texture = device.gpu.createTexture({
    size: { width: size, height: size },
    format: 'depth32float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });

  const sampler = device.gpu.createSampler({
    compare: 'less-equal',
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  return {
    size,
    texture,
    view: texture.createView(),
    sampler,
    destroy: () => {
      texture.destroy();
    },
  };
};
