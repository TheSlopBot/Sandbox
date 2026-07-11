import { type GpuDevice } from '../gl/device.ts';
import { type Camera, type DrawItem } from '../types.ts';
import { unlitWGSL } from '../shaders/unlit.ts';

const FRAME_UNIFORM_SIZE = 64;
const OBJECT_UNIFORM_SIZE = 80;
const OBJECT_UNIFORM_ALIGN = 256;

export type UnlitPass = {
  draw: (camera: Camera, items: readonly DrawItem[]) => void;
  destroy: () => void;
};

export const createUnlitPass = (device: GpuDevice): UnlitPass => {
  const gpu = device.gpu;
  const shader = gpu.createShaderModule({ code: unlitWGSL });

  const frameBindGroupLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const objectBindGroupLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform', hasDynamicOffset: true },
      },
    ],
  });

  const pipelineLayout = gpu.createPipelineLayout({
    bindGroupLayouts: [frameBindGroupLayout, objectBindGroupLayout],
  });

  const pipeline = gpu.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shader,
      entryPoint: 'vsMain',
      buffers: [
        {
          arrayStride: 32,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x3' },
            { shaderLocation: 2, offset: 24, format: 'float32x2' },
          ],
        },
      ],
    },
    fragment: {
      module: shader,
      entryPoint: 'fsMain',
      targets: [{ format: device.format }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'none',
      frontFace: 'ccw',
    },
    depthStencil: {
      format: 'depth24plus',
      depthWriteEnabled: true,
      depthCompare: 'less-equal',
    },
  });

  const frameUniformBuffer = gpu.createBuffer({
    size: FRAME_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const frameBindGroup = gpu.createBindGroup({
    layout: frameBindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: frameUniformBuffer } }],
  });

  let objectCapacity = 64;
  let objectUniformBuffer = gpu.createBuffer({
    size: objectCapacity * OBJECT_UNIFORM_ALIGN,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  let objectBindGroup = gpu.createBindGroup({
    layout: objectBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: objectUniformBuffer,
          size: OBJECT_UNIFORM_SIZE,
        },
      },
    ],
  });

  const frameBytes = new Float32Array(16);
  const objectBytes = new Float32Array(OBJECT_UNIFORM_ALIGN / 4);

  const ensureObjectCapacity = (count: number) => {
    if (count <= objectCapacity) return;

    objectUniformBuffer.destroy();
    objectCapacity = Math.max(objectCapacity * 2, count);
    objectUniformBuffer = gpu.createBuffer({
      size: objectCapacity * OBJECT_UNIFORM_ALIGN,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    objectBindGroup = gpu.createBindGroup({
      layout: objectBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: objectUniformBuffer,
            size: OBJECT_UNIFORM_SIZE,
          },
        },
      ],
    });
  };

  const draw = (camera: Camera, items: readonly DrawItem[]) => {
    const frame = device.ensureFrame();
    ensureObjectCapacity(items.length);

    frameBytes.set(camera.viewProj);
    gpu.queue.writeBuffer(
      frameUniformBuffer,
      0,
      frameBytes.buffer as ArrayBuffer,
      frameBytes.byteOffset,
      FRAME_UNIFORM_SIZE,
    );

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      objectBytes.set(item.model, 0);
      const color = item.material.baseColorFactor;
      objectBytes[16] = color[0];
      objectBytes[17] = color[1];
      objectBytes[18] = color[2];
      objectBytes[19] = color[3];
      gpu.queue.writeBuffer(
        objectUniformBuffer,
        i * OBJECT_UNIFORM_ALIGN,
        objectBytes.buffer as ArrayBuffer,
        objectBytes.byteOffset,
        OBJECT_UNIFORM_SIZE,
      );
    }

    const encoder = gpu.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: frame.colorView,
          clearValue: { r: 0.05, g: 0.06, b: 0.08, a: 1 },
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

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, frameBindGroup);

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      pass.setBindGroup(1, objectBindGroup, [i * OBJECT_UNIFORM_ALIGN]);
      pass.setVertexBuffer(0, item.mesh.vertexBuffer);
      pass.setIndexBuffer(item.mesh.indexBuffer, 'uint32');
      pass.drawIndexed(item.mesh.indexCount);
    }

    pass.end();
    gpu.queue.submit([encoder.finish()]);
  };

  const destroy = () => {
    frameUniformBuffer.destroy();
    objectUniformBuffer.destroy();
  };

  return { draw, destroy };
};
