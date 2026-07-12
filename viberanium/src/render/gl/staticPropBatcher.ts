import { type GpuDevice } from './device.ts';
import { type Mesh } from './mesh.ts';
import { type Material } from '../types.ts';
import { type TextureHandle } from './texture.ts';
import {
  INSTANCE_FLOATS,
  INSTANCE_STRIDE,
  writeStaticInstance,
  type StaticInstanceCpu,
} from './staticInstance.ts';
import { instanceCullWGSL } from '../shaders/instanceCullWgsl.ts';
import { type FrustumPlanes } from '../frustum.ts';
import { type Mat4 } from '../../math/mat4.ts';

export type StaticPropBatchHandle = number;

export type PreparedStaticBatch = {
  mesh: Mesh;
  material: Material;
  doubleSided: boolean;
  instanceBuffer: GPUBuffer;
  forwardIndexBuffer: GPUBuffer;
  shadowIndexBuffer: GPUBuffer;
  forwardIndirectBuffer: GPUBuffer;
  shadowIndirectBuffer: GPUBuffer;
  instanceCount: number;
};

export type StaticPropBatcher = {
  add: (
    mesh: Mesh,
    material: Material,
    model: Mat4,
    center: readonly [number, number, number],
    radius: number,
    castShadow?: boolean,
  ) => StaticPropBatchHandle;
  clear: () => void;
  cullAndPrepare: (
    cameraPlanes: FrustumPlanes,
    lightPlanes: FrustumPlanes,
    cameraPos: Float32Array,
    forwardDist: number,
    shadowDist: number,
    encoder?: GPUCommandEncoder,
  ) => readonly PreparedStaticBatch[];
  destroy: () => void;
};

type BatchInternal = {
  key: string;
  mesh: Mesh;
  material: Material;
  doubleSided: boolean;
  instances: StaticInstanceCpu[];
  cpuData: Float32Array;
  instanceBuffer: GPUBuffer | null;
  forwardIndexBuffer: GPUBuffer | null;
  shadowIndexBuffer: GPUBuffer | null;
  forwardCountBuffer: GPUBuffer | null;
  shadowCountBuffer: GPUBuffer | null;
  forwardIndirectBuffer: GPUBuffer | null;
  shadowIndirectBuffer: GPUBuffer | null;
  paramBuffer: GPUBuffer | null;
  capacity: number;
  dirty: boolean;
  cullBindGroup: GPUBindGroup | null;
  forwardDrawBindGroup: GPUBindGroup | null;
  shadowDrawBindGroup: GPUBindGroup | null;
};

const CULL_PARAMS_FLOATS = 60;
const CULL_PARAMS_SIZE = CULL_PARAMS_FLOATS * 4;
const INDIRECT_SIZE = 20;

export const createStaticPropBatcher = (device: GpuDevice): StaticPropBatcher => {
  const gpu = device.gpu;
  const batches = new Map<string, BatchInternal>();
  const handleToKey = new Map<StaticPropBatchHandle, string>();
  const objectIds = new WeakMap<object, number>();
  let nextObjectId = 1;
  let nextHandle = 1;

  const idOf = (obj: object): number => {
    const existing = objectIds.get(obj);
    if (existing !== undefined) return existing;
    const id = nextObjectId++;
    objectIds.set(obj, id);
    return id;
  };

  const materialKey = (material: Material): string => {
    const tex = material.baseColorTex as TextureHandle | null;
    const texId = tex ? idOf(tex.texture) : 'none';
    const c = material.baseColorFactor;
    return `${texId}|${c[0]},${c[1]},${c[2]},${c[3]}|${material.alphaMode}|${material.doubleSided === true}`;
  };

  const batchKey = (mesh: Mesh, material: Material): string =>
    `${idOf(mesh.vertexBuffer)}|${idOf(mesh.indexBuffer)}|${materialKey(material)}`;

  const shader = gpu.createShaderModule({ code: instanceCullWGSL });
  const cullLayout = gpu.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
    ],
  });
  const pipelineLayout = gpu.createPipelineLayout({ bindGroupLayouts: [cullLayout] });
  const initPipeline = gpu.createComputePipeline({
    layout: pipelineLayout,
    compute: { module: shader, entryPoint: 'initIndirect' },
  });
  const cullPipeline = gpu.createComputePipeline({
    layout: pipelineLayout,
    compute: { module: shader, entryPoint: 'cull' },
  });
  const finalizePipeline = gpu.createComputePipeline({
    layout: pipelineLayout,
    compute: { module: shader, entryPoint: 'finalizeIndirect' },
  });

  const paramBytes = new Float32Array(CULL_PARAMS_FLOATS);
  const paramU32 = new Uint32Array(paramBytes.buffer);

  const destroyBatchBuffers = (batch: BatchInternal) => {
    batch.instanceBuffer?.destroy();
    batch.forwardIndexBuffer?.destroy();
    batch.shadowIndexBuffer?.destroy();
    batch.forwardCountBuffer?.destroy();
    batch.shadowCountBuffer?.destroy();
    batch.forwardIndirectBuffer?.destroy();
    batch.shadowIndirectBuffer?.destroy();
    batch.paramBuffer?.destroy();
    batch.instanceBuffer = null;
    batch.forwardIndexBuffer = null;
    batch.shadowIndexBuffer = null;
    batch.forwardCountBuffer = null;
    batch.shadowCountBuffer = null;
    batch.forwardIndirectBuffer = null;
    batch.shadowIndirectBuffer = null;
    batch.paramBuffer = null;
    batch.cullBindGroup = null;
    batch.forwardDrawBindGroup = null;
    batch.shadowDrawBindGroup = null;
    batch.capacity = 0;
  };

  const ensureCapacity = (batch: BatchInternal, count: number) => {
    if (batch.capacity >= count && batch.instanceBuffer) return;

    const capacity = Math.max(64, count * 2);
    destroyBatchBuffers(batch);

    batch.capacity = capacity;
    batch.cpuData = new Float32Array(capacity * INSTANCE_FLOATS);
    batch.instanceBuffer = gpu.createBuffer({
      size: capacity * INSTANCE_STRIDE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    batch.forwardIndexBuffer = gpu.createBuffer({
      size: capacity * 4,
      usage: GPUBufferUsage.STORAGE,
    });
    batch.shadowIndexBuffer = gpu.createBuffer({
      size: capacity * 4,
      usage: GPUBufferUsage.STORAGE,
    });
    batch.forwardCountBuffer = gpu.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    batch.shadowCountBuffer = gpu.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    batch.forwardIndirectBuffer = gpu.createBuffer({
      size: INDIRECT_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
    });
    batch.shadowIndirectBuffer = gpu.createBuffer({
      size: INDIRECT_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
    });
    batch.paramBuffer = gpu.createBuffer({
      size: CULL_PARAMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    batch.dirty = true;
  };

  const add: StaticPropBatcher['add'] = (mesh, material, model, center, radius, castShadow = true) => {
    if (material.alphaMode === 'BLEND' || material.alphaMode === 'MASK') {
      throw new Error('Static prop batcher does not support BLEND or MASK materials');
    }

    const key = batchKey(mesh, material);
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        key,
        mesh,
        material,
        doubleSided: material.doubleSided === true,
        instances: [],
        cpuData: new Float32Array(0),
        instanceBuffer: null,
        forwardIndexBuffer: null,
        shadowIndexBuffer: null,
        forwardCountBuffer: null,
        shadowCountBuffer: null,
        forwardIndirectBuffer: null,
        shadowIndirectBuffer: null,
        paramBuffer: null,
        capacity: 0,
        dirty: true,
        cullBindGroup: null,
        forwardDrawBindGroup: null,
        shadowDrawBindGroup: null,
      };
      batches.set(key, batch);
    }

    const instance: StaticInstanceCpu = {
      model: new Float32Array(model),
      color: [
        material.baseColorFactor[0],
        material.baseColorFactor[1],
        material.baseColorFactor[2],
        material.baseColorFactor[3],
      ],
      center: [center[0], center[1], center[2]],
      radius,
      castShadow,
    };
    batch.instances.push(instance);
    batch.dirty = true;

    const handle = nextHandle++;
    handleToKey.set(handle, key);
    return handle;
  };

  const clear = () => {
    for (const batch of batches.values()) destroyBatchBuffers(batch);
    batches.clear();
    handleToKey.clear();
  };

  const cullAndPrepare: StaticPropBatcher['cullAndPrepare'] = (
    cameraPlanes,
    lightPlanes,
    cameraPos,
    forwardDist,
    shadowDist,
    externalEncoder,
  ) => {
    const prepared: PreparedStaticBatch[] = [];
    if (batches.size === 0) return prepared;

    const encoder = externalEncoder ?? gpu.createCommandEncoder();
    const ownsEncoder = !externalEncoder;
    const pass = encoder.beginComputePass();

    for (const batch of batches.values()) {
      if (batch.instances.length === 0) continue;

      ensureCapacity(batch, batch.instances.length);

      if (batch.dirty) {
        for (let i = 0; i < batch.instances.length; i++) {
          writeStaticInstance(batch.cpuData, i * INSTANCE_FLOATS, batch.instances[i]!);
        }
        gpu.queue.writeBuffer(
          batch.instanceBuffer!,
          0,
          batch.cpuData.buffer as ArrayBuffer,
          batch.cpuData.byteOffset,
          batch.instances.length * INSTANCE_STRIDE,
        );
        batch.dirty = false;
      }

      paramBytes.set(cameraPlanes.subarray(0, 24), 0);
      paramBytes.set(lightPlanes.subarray(0, 24), 24);
      paramBytes[48] = cameraPos[0]!;
      paramBytes[49] = cameraPos[1]!;
      paramBytes[50] = cameraPos[2]!;
      paramBytes[51] = forwardDist;
      paramBytes[52] = shadowDist;
      paramU32[53] = batch.instances.length;
      paramU32[54] = batch.mesh.indexCount;
      paramU32[55] = 0;
      paramU32[56] = 0;
      gpu.queue.writeBuffer(
        batch.paramBuffer!,
        0,
        paramBytes.buffer as ArrayBuffer,
        0,
        CULL_PARAMS_SIZE,
      );

      const bindGroup =
        batch.cullBindGroup ??
        gpu.createBindGroup({
          layout: cullLayout,
          entries: [
            { binding: 0, resource: { buffer: batch.paramBuffer! } },
            { binding: 1, resource: { buffer: batch.instanceBuffer! } },
            { binding: 2, resource: { buffer: batch.forwardIndexBuffer! } },
            { binding: 3, resource: { buffer: batch.shadowIndexBuffer! } },
            { binding: 4, resource: { buffer: batch.forwardCountBuffer! } },
            { binding: 5, resource: { buffer: batch.shadowCountBuffer! } },
            { binding: 6, resource: { buffer: batch.forwardIndirectBuffer! } },
            { binding: 7, resource: { buffer: batch.shadowIndirectBuffer! } },
          ],
        });
      batch.cullBindGroup = bindGroup;

      pass.setBindGroup(0, bindGroup);
      pass.setPipeline(initPipeline);
      pass.dispatchWorkgroups(1);
      pass.setPipeline(cullPipeline);
      pass.dispatchWorkgroups(Math.ceil(batch.instances.length / 64));
      pass.setPipeline(finalizePipeline);
      pass.dispatchWorkgroups(1);

      prepared.push({
        mesh: batch.mesh,
        material: batch.material,
        doubleSided: batch.doubleSided,
        instanceBuffer: batch.instanceBuffer!,
        forwardIndexBuffer: batch.forwardIndexBuffer!,
        shadowIndexBuffer: batch.shadowIndexBuffer!,
        forwardIndirectBuffer: batch.forwardIndirectBuffer!,
        shadowIndirectBuffer: batch.shadowIndirectBuffer!,
        instanceCount: batch.instances.length,
      });
    }

    pass.end();
    if (ownsEncoder && prepared.length > 0) gpu.queue.submit([encoder.finish()]);
    return prepared;
  };

  return {
    add,
    clear,
    cullAndPrepare,
    destroy: () => {
      clear();
    },
  };
};
