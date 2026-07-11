import { ASCII_DENSITY, createGlyphAtlasHandle } from '../ascii/glyphAtlas.ts';
import { loadingBokehWGSL } from '../shaders/loadingBokehWgsl.ts';

const MAX_DPR = 2;
const FADE_MS = 420;
const UNIFORM_FLOATS = 32;
const UNIFORM_BYTES = UNIFORM_FLOATS * 4;

export type LoadingScreenColors = {
  bgDeep: readonly [number, number, number];
  textMuted: readonly [number, number, number];
  accentCyan: readonly [number, number, number];
  accentBlue: readonly [number, number, number];
  accentPrimary: readonly [number, number, number];
  accentPurple: readonly [number, number, number];
  accentOrange: readonly [number, number, number];
};

export type LoadingScreenOptions = {
  colors: LoadingScreenColors;
};

export type LoadingScreen = {
  destroy: () => void;
};

export const createLoadingScreen = async (
  canvas: HTMLCanvasElement,
  options: LoadingScreenOptions,
): Promise<LoadingScreen> => {
  const { colors } = options;
  if (!navigator.gpu) throw new Error('WebGPU not supported for loading screen');

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter for loading screen');

  const gpu = await adapter.requestDevice();
  const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
  if (!context) throw new Error('Failed to get WebGPU canvas context for loading screen');

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: gpu,
    format,
    alphaMode: 'opaque',
  });

  const glyphAtlas = createGlyphAtlasHandle({ gpu });

  const shader = gpu.createShaderModule({ code: loadingBokehWGSL });
  const bindGroupLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
    ],
  });

  const pipeline = gpu.createRenderPipeline({
    layout: gpu.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: { module: shader, entryPoint: 'vsMain' },
    fragment: {
      module: shader,
      entryPoint: 'fsMain',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const uniformBuffer = gpu.createBuffer({
    size: UNIFORM_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const uniformBytes = new Float32Array(UNIFORM_FLOATS);
  const bindGroup = gpu.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: glyphAtlas.view },
      { binding: 2, resource: glyphAtlas.sampler },
    ],
  });

  let running = true;
  let animating = false;
  let start = performance.now();
  let frameId = 0;
  let cssWidth = 0;
  let cssHeight = 0;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;

  const writeColor = (offset: number, rgb: readonly [number, number, number]) => {
    uniformBytes[offset] = rgb[0];
    uniformBytes[offset + 1] = rgb[1];
    uniformBytes[offset + 2] = rgb[2];
  };

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    cssWidth = width;
    cssHeight = height;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pixelW = Math.max(1, Math.floor(width * dpr));
    const pixelH = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
      context.configure({
        device: gpu,
        format,
        alphaMode: 'opaque',
      });
    }
  };

  const draw = (time: number) => {
    if (!running || cssWidth === 0 || cssHeight === 0) return;

    uniformBytes[0] = reducedMotion ? 0 : time;
    uniformBytes[1] = ASCII_DENSITY.length;
    uniformBytes[2] = cssWidth;
    uniformBytes[3] = cssHeight;
    writeColor(4, colors.bgDeep);
    writeColor(8, colors.textMuted);
    writeColor(12, colors.accentCyan);
    writeColor(16, colors.accentBlue);
    writeColor(20, colors.accentPrimary);
    writeColor(24, colors.accentPurple);
    writeColor(28, colors.accentOrange);

    gpu.queue.writeBuffer(
      uniformBuffer,
      0,
      uniformBytes.buffer as ArrayBuffer,
      uniformBytes.byteOffset,
      UNIFORM_BYTES,
    );

    const encoder = gpu.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: {
            r: colors.bgDeep[0] * 0.92,
            g: colors.bgDeep[1] * 0.92,
            b: colors.bgDeep[2] * 0.92,
            a: 1,
          },
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    gpu.queue.submit([encoder.finish()]);
  };

  const loop = (now: number) => {
    if (!running) return;
    draw((now - start) / 1000);
    if (!reducedMotion) frameId = requestAnimationFrame(loop);
    else animating = false;
  };

  const startLoop = () => {
    if (!running || animating) return;
    if (reducedMotion) {
      draw(0);
      return;
    }
    animating = true;
    start = performance.now();
    frameId = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    animating = false;
    cancelAnimationFrame(frameId);
  };

  const onVisibility = () => {
    if (document.hidden) stopLoop();
    else startLoop();
  };

  const onMotionPreference = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches;
    stopLoop();
    startLoop();
  };

  resize();
  startLoop();

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener('visibilitychange', onVisibility);
  motionQuery.addEventListener('change', onMotionPreference);

  return {
    destroy() {
      running = false;
      stopLoop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener('change', onMotionPreference);
      glyphAtlas.texture.destroy();
      uniformBuffer.destroy();
      gpu.destroy();
    },
  };
};

export const fadeOutLoadingScreen = (overlay: HTMLElement): Promise<void> => {
  overlay.classList.add('loading-screen--fade-out');
  return new Promise((resolve) => {
    const done = () => {
      overlay.removeEventListener('transitionend', done);
      overlay.remove();
      resolve();
    };
    overlay.addEventListener('transitionend', done);
    window.setTimeout(done, FADE_MS + 80);
  });
};
