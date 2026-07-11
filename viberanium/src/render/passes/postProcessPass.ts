import { type GpuDevice } from '../gl/device.ts';
import { toneColorWGSL, asciiPostWGSL } from '../shaders/postWgsl.ts';
import { type TextureHandle } from '../gl/texture.ts';

export type PostProcessDraw = {
  encode: (
    encoder: GPUCommandEncoder,
    inputView: GPUTextureView,
    w: number,
    h: number,
    outputView: GPUTextureView,
  ) => void;
  destroy: () => void;
};

const createBasePostPass = (
  device: GpuDevice,
  shaderCode: string,
  extraLayoutEntries: GPUBindGroupLayoutEntry[],
  extraEntries: GPUBindGroupEntry[],
  writeUniforms: (bytes: Float32Array, w: number, h: number) => void,
): PostProcessDraw => {
  const gpu = device.gpu;
  const shader = gpu.createShaderModule({ code: shaderCode });

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
      ...extraLayoutEntries,
    ],
  });

  const pipeline = gpu.createRenderPipeline({
    layout: gpu.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: { module: shader, entryPoint: 'vsMain' },
    fragment: {
      module: shader,
      entryPoint: 'fsMain',
      targets: [{ format: device.format }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const uniformBuffer = gpu.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const sceneSampler = gpu.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });
  const uniformBytes = new Float32Array(4);
  const bindGroupByInput = new WeakMap<GPUTextureView, GPUBindGroup>();

  const encode = (
    encoder: GPUCommandEncoder,
    inputView: GPUTextureView,
    w: number,
    h: number,
    outputView: GPUTextureView,
  ) => {
    writeUniforms(uniformBytes, w, h);
    gpu.queue.writeBuffer(
      uniformBuffer,
      0,
      uniformBytes.buffer as ArrayBuffer,
      uniformBytes.byteOffset,
      16,
    );

    let bindGroup = bindGroupByInput.get(inputView);
    if (!bindGroup) {
      bindGroup = gpu.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: inputView },
          { binding: 2, resource: sceneSampler },
          ...extraEntries,
        ],
      });
      bindGroupByInput.set(inputView, bindGroup);
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: outputView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
  };

  return {
    encode,
    destroy: () => {
      uniformBuffer.destroy();
    },
  };
};

export const createTonePostPass = (device: GpuDevice): PostProcessDraw =>
  createBasePostPass(device, toneColorWGSL, [], [], (bytes, w, h) => {
    bytes[0] = w;
    bytes[1] = h;
    bytes[2] = 0;
    bytes[3] = 0;
  });

export const createAsciiPostPass = (
  device: GpuDevice,
  glyphAtlas: TextureHandle,
  glyphCount: number,
): PostProcessDraw =>
  createBasePostPass(
    device,
    asciiPostWGSL,
    [
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
    ],
    [
      { binding: 3, resource: glyphAtlas.view },
      { binding: 4, resource: glyphAtlas.sampler },
    ],
    (bytes, w, h) => {
      bytes[0] = w;
      bytes[1] = h;
      bytes[2] = glyphCount;
      bytes[3] = 0;
    },
  );
