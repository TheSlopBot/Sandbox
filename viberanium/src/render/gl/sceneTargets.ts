import { type GpuDevice } from './device.ts';

export type SceneTargets = {
  readonly samples: number;
  resize: (w: number, h: number) => void;
  getColorView: () => GPUTextureView;
  getDepthView: () => GPUTextureView;
  getResolveView: () => GPUTextureView;
  getResolveTexture: () => GPUTexture;
  getOverlayDepthView: () => GPUTextureView;
  destroy: () => void;
};

export const createSceneTargets = (device: GpuDevice, requestedSamples = 4): SceneTargets => {
  const samples = Math.max(1, Math.min(requestedSamples, 4));
  let width = 0;
  let height = 0;
  let colorTexture: GPUTexture | null = null;
  let depthTexture: GPUTexture | null = null;
  let resolveTexture: GPUTexture | null = null;
  let overlayDepthTexture: GPUTexture | null = null;
  let colorView: GPUTextureView | null = null;
  let depthView: GPUTextureView | null = null;
  let resolveView: GPUTextureView | null = null;
  let overlayDepthView: GPUTextureView | null = null;

  const resize = (w: number, h: number) => {
    const nextW = Math.max(1, w);
    const nextH = Math.max(1, h);
    if (
      nextW === width &&
      nextH === height &&
      colorTexture &&
      depthTexture &&
      resolveTexture &&
      overlayDepthTexture
    ) {
      return;
    }

    width = nextW;
    height = nextH;
    colorTexture?.destroy();
    depthTexture?.destroy();
    resolveTexture?.destroy();
    overlayDepthTexture?.destroy();

    colorTexture = device.gpu.createTexture({
      size: { width, height },
      sampleCount: samples,
      format: device.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    depthTexture = device.gpu.createTexture({
      size: { width, height },
      sampleCount: samples,
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    resolveTexture = device.gpu.createTexture({
      size: { width, height },
      format: device.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    overlayDepthTexture = device.gpu.createTexture({
      size: { width, height },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    colorView = colorTexture.createView();
    depthView = depthTexture.createView();
    resolveView = resolveTexture.createView();
    overlayDepthView = overlayDepthTexture.createView();
  };

  return {
    samples,
    resize,
    getColorView: () => {
      if (!colorView) throw new Error('SceneTargets not resized');
      return colorView;
    },
    getDepthView: () => {
      if (!depthView) throw new Error('SceneTargets not resized');
      return depthView;
    },
    getResolveView: () => {
      if (!resolveView) throw new Error('SceneTargets not resized');
      return resolveView;
    },
    getResolveTexture: () => {
      if (!resolveTexture) throw new Error('SceneTargets not resized');
      return resolveTexture;
    },
    getOverlayDepthView: () => {
      if (!overlayDepthView) throw new Error('SceneTargets not resized');
      return overlayDepthView;
    },
    destroy: () => {
      colorTexture?.destroy();
      depthTexture?.destroy();
      resolveTexture?.destroy();
      overlayDepthTexture?.destroy();
      colorTexture = null;
      depthTexture = null;
      resolveTexture = null;
      overlayDepthTexture = null;
      colorView = null;
      depthView = null;
      resolveView = null;
      overlayDepthView = null;
    },
  };
};
