import { type GpuDevice } from '../gl/device.ts';
import { type ShadowMap } from '../gl/shadowMap.ts';
import { type Mesh, type SkinnedMesh } from '../gl/mesh.ts';
import { type Mat4 } from '../../math/mat4.ts';
import { type DrawItem, type GroundDraw } from '../types.ts';
import { shadowWGSL } from '../shaders/shadowWgsl.ts';
import { instancedShadowWGSL } from '../shaders/instancedShadowWgsl.ts';
import { type PreparedStaticBatch } from '../gl/staticPropBatcher.ts';

const OBJECT_UNIFORM_SIZE = 64;
const OBJECT_UNIFORM_ALIGN = 256;
const MAX_JOINTS = 128;
const JOINT_BUFFER_SIZE = MAX_JOINTS * 16 * 4;
const IDENTITY_MODEL = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

const STATIC_POS_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 32,
  attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
};

const SKINNED_LAYOUTS: GPUVertexBufferLayout[] = [
  STATIC_POS_LAYOUT,
  {
    arrayStride: 8,
    attributes: [{ shaderLocation: 3, offset: 0, format: 'uint16x4' }],
  },
  {
    arrayStride: 16,
    attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x4' }],
  },
];

type PaletteGpu = {
  buffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

const isSkinnedMesh = (mesh: Mesh): mesh is SkinnedMesh => 'jointBuffer' in mesh;

export type ShadowPass = {
  encode: (
    encoder: GPUCommandEncoder,
    lightViewProj: Mat4,
    ground: GroundDraw | null,
    casters: readonly DrawItem[],
    staticBatches?: readonly PreparedStaticBatch[],
  ) => void;
  destroy: () => void;
};

export const createShadowPass = (device: GpuDevice, shadowMap: ShadowMap): ShadowPass => {
  const gpu = device.gpu;
  const shader = gpu.createShaderModule({ code: shadowWGSL });

  const frameLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const objectLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform', hasDynamicOffset: true },
      },
    ],
  });

  const jointLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  const staticLayout = gpu.createPipelineLayout({
    bindGroupLayouts: [frameLayout, objectLayout],
  });
  const skinnedLayout = gpu.createPipelineLayout({
    bindGroupLayouts: [frameLayout, objectLayout, jointLayout],
  });

  const instanceLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });
  const instancedPipelineLayout = gpu.createPipelineLayout({
    bindGroupLayouts: [frameLayout, instanceLayout],
  });
  const instancedShader = gpu.createShaderModule({ code: instancedShadowWGSL });

  const depthStencil: GPUDepthStencilState = {
    format: 'depth32float',
    depthWriteEnabled: true,
    depthCompare: 'less-equal',
    depthBias: 1,
    depthBiasSlopeScale: 1.5,
    depthBiasClamp: 0.0,
  };

  const staticPipeline = gpu.createRenderPipeline({
    layout: staticLayout,
    vertex: {
      module: shader,
      entryPoint: 'vsMain',
      buffers: [STATIC_POS_LAYOUT],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
      frontFace: 'ccw',
    },
    depthStencil,
  });

  const skinnedPipeline = gpu.createRenderPipeline({
    layout: skinnedLayout,
    vertex: {
      module: shader,
      entryPoint: 'vsSkinned',
      buffers: SKINNED_LAYOUTS,
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
      frontFace: 'ccw',
    },
    depthStencil,
  });

  const makeInstancedShadowPipeline = (cullMode: GPUCullMode): GPURenderPipeline =>
    gpu.createRenderPipeline({
      layout: instancedPipelineLayout,
      vertex: {
        module: instancedShader,
        entryPoint: 'vsMain',
        buffers: [STATIC_POS_LAYOUT],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode,
        frontFace: 'ccw',
      },
      depthStencil,
    });

  const instancedCullPipeline = makeInstancedShadowPipeline('back');
  const instancedNonePipeline = makeInstancedShadowPipeline('none');

  const frameBuffer = gpu.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const frameBindGroup = gpu.createBindGroup({
    layout: frameLayout,
    entries: [{ binding: 0, resource: { buffer: frameBuffer } }],
  });

  let objectCapacity = 64;
  let objectBuffer = gpu.createBuffer({
    size: objectCapacity * OBJECT_UNIFORM_ALIGN,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  let objectBindGroup = gpu.createBindGroup({
    layout: objectLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: objectBuffer, size: OBJECT_UNIFORM_SIZE },
      },
    ],
  });

  const paletteCache = new Map<Float32Array, PaletteGpu>();
  const instanceBindByIndex = new WeakMap<GPUBuffer, GPUBindGroup>();
  let objectStaging = new Float32Array(objectCapacity * (OBJECT_UNIFORM_ALIGN / 4));
  const frameBytes = new Float32Array(16);
  const meshOrder = new WeakMap<object, number>();
  let nextMeshOrder = 1;

  const meshSortKey = (mesh: Mesh): number => {
    const existing = meshOrder.get(mesh);
    if (existing) return existing;
    const id = nextMeshOrder++;
    meshOrder.set(mesh, id);
    return id;
  };

  const ensureObjectCapacity = (count: number) => {
    if (count <= objectCapacity) return;
    objectBuffer.destroy();
    objectCapacity = Math.max(objectCapacity * 2, count);
    objectBuffer = gpu.createBuffer({
      size: objectCapacity * OBJECT_UNIFORM_ALIGN,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    objectBindGroup = gpu.createBindGroup({
      layout: objectLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: objectBuffer, size: OBJECT_UNIFORM_SIZE },
        },
      ],
    });
    objectStaging = new Float32Array(objectCapacity * (OBJECT_UNIFORM_ALIGN / 4));
  };

  const getPalette = (palette: Float32Array): PaletteGpu => {
    const existing = paletteCache.get(palette);
    if (existing) return existing;
    const buffer = gpu.createBuffer({
      size: JOINT_BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = gpu.createBindGroup({
      layout: jointLayout,
      entries: [{ binding: 0, resource: { buffer } }],
    });
    const entry = { buffer, bindGroup };
    paletteCache.set(palette, entry);
    return entry;
  };

  const resolvePaletteBindGroup = (skin: NonNullable<DrawItem['skin']>): GPUBindGroup => {
    if (skin.paletteGpu) return skin.paletteGpu.bindGroup;
    return getPalette(skin.palette).bindGroup;
  };

  const encode = (
    encoder: GPUCommandEncoder,
    lightViewProj: Mat4,
    ground: GroundDraw | null,
    casters: readonly DrawItem[],
    staticBatches: readonly PreparedStaticBatch[] = [],
  ) => {
    const total = casters.length + (ground ? 1 : 0);
    ensureObjectCapacity(Math.max(1, total));

    frameBytes.set(lightViewProj);
    gpu.queue.writeBuffer(frameBuffer, 0, frameBytes.buffer as ArrayBuffer, frameBytes.byteOffset, 64);

    const seen = new Set<Float32Array>();
    for (const item of casters) {
      const skin = item.skin;
      if (!skin || skin.paletteGpu) continue;
      if (seen.has(skin.palette)) continue;
      seen.add(skin.palette);
      const jointCount = Math.min(MAX_JOINTS, Math.max(1, skin.jointCount));
      gpu.queue.writeBuffer(
        getPalette(skin.palette).buffer,
        0,
        skin.palette.buffer as ArrayBuffer,
        skin.palette.byteOffset,
        jointCount * 16 * 4,
      );
    }

    const ordered = casters.slice() as DrawItem[];
    ordered.sort((a, b) => {
      const meshDiff = meshSortKey(a.mesh) - meshSortKey(b.mesh);
      if (meshDiff !== 0) return meshDiff;
      const aSkin = a.skin ? 1 : 0;
      const bSkin = b.skin ? 1 : 0;
      return aSkin - bSkin;
    });

    let objectIndex = 0;
    const groundIndex = ground ? objectIndex++ : -1;
    const casterIndices: number[] = [];
    for (const _item of ordered) casterIndices.push(objectIndex++);

    const writeModel = (model: Mat4, index: number) => {
      objectStaging.set(model, index * (OBJECT_UNIFORM_ALIGN / 4));
    };

    if (ground && groundIndex >= 0) writeModel(ground.model, groundIndex);

    for (let i = 0; i < ordered.length; i++) {
      const item = ordered[i]!;
      const index = casterIndices[i]!;
      if (item.skin?.paletteGpu) writeModel(IDENTITY_MODEL, index);
      else if (item.gpuModel) writeModel(IDENTITY_MODEL, index);
      else writeModel(item.model, index);
    }

    gpu.queue.writeBuffer(
      objectBuffer,
      0,
      objectStaging.buffer as ArrayBuffer,
      objectStaging.byteOffset,
      objectIndex * OBJECT_UNIFORM_ALIGN,
    );

    for (let i = 0; i < ordered.length; i++) {
      const item = ordered[i]!;
      if (!item.gpuModel || item.skin?.paletteGpu) continue;
      encoder.copyBufferToBuffer(
        item.gpuModel.buffer,
        item.gpuModel.byteOffset,
        objectBuffer,
        casterIndices[i]! * OBJECT_UNIFORM_ALIGN,
        64,
      );
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: shadowMap.view,
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    pass.setBindGroup(0, frameBindGroup);
    let lastPaletteKey: GPUBindGroup | Float32Array | null = null;
    let lastVertex: GPUBuffer | null = null;
    let lastJoint: GPUBuffer | null = null;
    let lastWeight: GPUBuffer | null = null;
    let lastIndex: GPUBuffer | null = null;

    const bindMesh = (mesh: Mesh, skinned: boolean) => {
      if (mesh.vertexBuffer !== lastVertex) {
        pass.setVertexBuffer(0, mesh.vertexBuffer);
        lastVertex = mesh.vertexBuffer;
      }
      if (skinned && isSkinnedMesh(mesh)) {
        if (mesh.jointBuffer !== lastJoint) {
          pass.setVertexBuffer(1, mesh.jointBuffer);
          lastJoint = mesh.jointBuffer;
        }
        if (mesh.weightBuffer !== lastWeight) {
          pass.setVertexBuffer(2, mesh.weightBuffer);
          lastWeight = mesh.weightBuffer;
        }
      } else {
        lastJoint = null;
        lastWeight = null;
      }
      if (mesh.indexBuffer !== lastIndex) {
        pass.setIndexBuffer(mesh.indexBuffer, 'uint32');
        lastIndex = mesh.indexBuffer;
      }
    };

    if (ground && groundIndex >= 0) {
      pass.setPipeline(staticPipeline);
      pass.setBindGroup(1, objectBindGroup, [groundIndex * OBJECT_UNIFORM_ALIGN]);
      bindMesh(ground.mesh, false);
      pass.drawIndexed(ground.mesh.indexCount);
      lastPaletteKey = null;
    }

    for (let i = 0; i < ordered.length; i++) {
      const item = ordered[i]!;
      const index = casterIndices[i]!;
      const skin = item.skin;
      if (skin && isSkinnedMesh(item.mesh)) {
        const paletteKey = skin.paletteGpu?.bindGroup ?? skin.palette;
        if (paletteKey !== lastPaletteKey) {
          pass.setBindGroup(2, resolvePaletteBindGroup(skin));
          lastPaletteKey = paletteKey;
        }
        pass.setPipeline(skinnedPipeline);
        pass.setBindGroup(1, objectBindGroup, [index * OBJECT_UNIFORM_ALIGN]);
        bindMesh(item.mesh, true);
        pass.drawIndexed(item.mesh.indexCount);
        continue;
      }

      lastPaletteKey = null;
      pass.setPipeline(staticPipeline);
      pass.setBindGroup(1, objectBindGroup, [index * OBJECT_UNIFORM_ALIGN]);
      bindMesh(item.mesh, false);
      pass.drawIndexed(item.mesh.indexCount);
    }

    for (const batch of staticBatches) {
      let instanceBindGroup = instanceBindByIndex.get(batch.shadowIndexBuffer);
      if (!instanceBindGroup) {
        instanceBindGroup = gpu.createBindGroup({
          layout: instanceLayout,
          entries: [
            { binding: 0, resource: { buffer: batch.instanceBuffer } },
            { binding: 1, resource: { buffer: batch.shadowIndexBuffer } },
          ],
        });
        instanceBindByIndex.set(batch.shadowIndexBuffer, instanceBindGroup);
      }
      pass.setPipeline(batch.doubleSided ? instancedNonePipeline : instancedCullPipeline);
      pass.setBindGroup(1, instanceBindGroup);
      bindMesh(batch.mesh, false);
      pass.drawIndexedIndirect(batch.shadowIndirectBuffer, 0);
    }

    pass.end();
  };

  const destroy = () => {
    frameBuffer.destroy();
    objectBuffer.destroy();
    for (const entry of paletteCache.values()) entry.buffer.destroy();
    paletteCache.clear();
  };

  return { encode, destroy };
};
