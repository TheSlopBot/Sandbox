export type GpuFrameTargets = {
  width: number;
  height: number;
  colorView: GPUTextureView;
  depthView: GPUTextureView;
};

export type DeviceOptions = {
  maxDpr?: number;
};

export type GpuDevice = {
  readonly gpu: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;
  readonly canvas: HTMLCanvasElement;
  readonly adapter: GPUAdapter;
  resize: () => void;
  setMaxDpr: (maxDpr: number) => void;
  getSize: () => { width: number; height: number };
  ensureFrame: () => GpuFrameTargets;
  clear: (r?: number, g?: number, b?: number, a?: number) => void;
  destroy: () => void;
};

export const createDevice = async (
  canvas: HTMLCanvasElement,
  options: DeviceOptions = {},
): Promise<GpuDevice> => {
  if (!navigator.gpu) throw new Error('WebGPU not supported');

  const adapter = await navigator.gpu.requestAdapter(
    /Windows/i.test(navigator.userAgent) ? undefined : { powerPreference: 'high-performance' },
  );
  if (!adapter) throw new Error('No WebGPU adapter');

  const gpu = await adapter.requestDevice();
  const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
  if (!context) throw new Error('Failed to get WebGPU canvas context');

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: gpu,
    format,
    alphaMode: 'opaque',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  let maxDpr = Math.max(0.5, options.maxDpr ?? 2);
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let sizeDirty = true;
  let width = 0;
  let height = 0;
  let depthTexture: GPUTexture | null = null;
  let destroyed = false;

  const measure = () => {
    dpr = Math.max(1, Math.min(maxDpr, window.devicePixelRatio || 1));
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    sizeDirty = true;
  };

  measure();

  const onWindowResize = () => {
    measure();
  };

  window.addEventListener('resize', onWindowResize);

  const observer =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          measure();
        })
      : null;
  observer?.observe(canvas);

  const ensureDepth = (w: number, h: number) => {
    if (depthTexture && depthTexture.width === w && depthTexture.height === h) return;

    depthTexture?.destroy();
    depthTexture = gpu.createTexture({
      size: { width: w, height: h },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  };

  const resize = () => {
    if (!sizeDirty) return;

    sizeDirty = false;
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    const sizeChanged = canvas.width !== w || canvas.height !== h || width !== w || height !== h;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    width = w;
    height = h;
    ensureDepth(w, h);

    if (sizeChanged) {
      context.configure({
        device: gpu,
        format,
        alphaMode: 'opaque',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
  };

  const setMaxDpr = (next: number) => {
    const clamped = Math.max(0.5, next);
    if (clamped === maxDpr) return;
    maxDpr = clamped;
    measure();
  };

  const getSize = () => ({ width, height });

  const ensureFrame = (): GpuFrameTargets => {
    resize();
    if (!depthTexture) ensureDepth(width, height);

    return {
      width,
      height,
      colorView: context.getCurrentTexture().createView(),
      depthView: depthTexture!.createView(),
    };
  };

  const clear = (r = 0.56, g = 0.66, b = 0.82, a = 1) => {
    const frame = ensureFrame();
    const encoder = gpu.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: frame.colorView,
          clearValue: { r, g, b, a },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: frame.depthView,
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });
    pass.end();
    gpu.queue.submit([encoder.finish()]);
  };

  gpu.lost.then((info) => {
    if (destroyed) return;
    console.error('WebGPU device lost:', info.message);
  });

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener('resize', onWindowResize);
    observer?.disconnect();
    depthTexture?.destroy();
    depthTexture = null;
    gpu.destroy();
  };

  resize();

  return {
    gpu,
    context,
    format,
    canvas,
    adapter,
    resize,
    setMaxDpr,
    getSize,
    ensureFrame,
    clear,
    destroy,
  };
};
