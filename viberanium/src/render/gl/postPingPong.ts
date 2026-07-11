import { type GpuDevice } from './device.ts';

export type PostColorTarget = {
  texture: GPUTexture;
  view: GPUTextureView;
};

export type PostPingPong = {
  resize: (w: number, h: number) => void;
  get: (index: 0 | 1) => PostColorTarget;
  destroy: () => void;
};

export const createPostPingPong = (device: GpuDevice): PostPingPong => {
  let width = 0;
  let height = 0;
  let targets: [PostColorTarget | null, PostColorTarget | null] = [null, null];

  const allocOne = (): PostColorTarget => {
    const texture = device.gpu.createTexture({
      size: { width, height },
      format: device.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    return { texture, view: texture.createView() };
  };

  const resize = (w: number, h: number) => {
    const nextW = Math.max(1, w);
    const nextH = Math.max(1, h);
    if (nextW === width && nextH === height && targets[0] && targets[1]) return;

    width = nextW;
    height = nextH;
    targets[0]?.texture.destroy();
    targets[1]?.texture.destroy();
    targets = [allocOne(), allocOne()];
  };

  return {
    resize,
    get: (index) => {
      const target = targets[index];
      if (!target) throw new Error('PostPingPong not resized');
      return target;
    },
    destroy: () => {
      targets[0]?.texture.destroy();
      targets[1]?.texture.destroy();
      targets = [null, null];
    },
  };
};
