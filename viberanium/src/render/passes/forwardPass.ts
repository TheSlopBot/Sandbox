import { type GpuDevice } from '../gl/device.ts';
import { createSolidTexture, type TextureHandle } from '../gl/texture.ts';
import { createShadowMap } from '../gl/shadowMap.ts';
import { createSceneTargets } from '../gl/sceneTargets.ts';
import { type Mesh, type SkinnedMesh } from '../gl/mesh.ts';
import { type Mat4 } from '../../math/mat4.ts';
import { DIRECTIONAL_LIGHT, type Camera, type DrawItem, type GroundDraw } from '../types.ts';
import { litWGSL } from '../shaders/litWgsl.ts';
import { groundWGSL } from '../shaders/groundWgsl.ts';
import { instancedLitWGSL } from '../shaders/instancedLitWgsl.ts';
import { createShadowPass } from './shadowPass.ts';
import { type PreparedStaticBatch } from '../gl/staticPropBatcher.ts';

const FRAME_UNIFORM_FLOATS = 44;
const FRAME_UNIFORM_SIZE = FRAME_UNIFORM_FLOATS * 4;
const OBJECT_UNIFORM_SIZE = 96;
const OBJECT_UNIFORM_ALIGN = 256;
const MSAA_SAMPLES = 4;
const IDENTITY_MODEL = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

const STATIC_VERTEX_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 32,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32x2' },
  ],
};

const SKINNED_VERTEX_LAYOUTS: GPUVertexBufferLayout[] = [
  STATIC_VERTEX_LAYOUT,
  {
    arrayStride: 8,
    attributes: [{ shaderLocation: 3, offset: 0, format: 'uint16x4' }],
  },
  {
    arrayStride: 16,
    attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x4' }],
  },
];

const BLEND_ALPHA: GPUBlendState = {
  color: {
    srcFactor: 'src-alpha',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
  alpha: {
    srcFactor: 'one',
    dstFactor: 'one-minus-src-alpha',
    operation: 'add',
  },
};

export type ForwardPass = {
  encode: (
    encoder: GPUCommandEncoder,
    camera: Camera,
    lightViewProj: Mat4,
    ground: GroundDraw | null,
    opaque: readonly DrawItem[],
    transparent: readonly DrawItem[],
    overlay: readonly DrawItem[],
    shadowCasters: readonly DrawItem[],
    staticBatches?: readonly PreparedStaticBatch[],
  ) => { width: number; height: number };
  getSceneView: () => GPUTextureView;
  destroy: () => void;
};

type LitPipelineKey = 'opaqueCull' | 'opaqueNone' | 'blendCull' | 'blendNone';

const isSkinnedMesh = (mesh: Mesh): mesh is SkinnedMesh => 'jointBuffer' in mesh;

export const createForwardPass = (device: GpuDevice): ForwardPass => {
  const gpu = device.gpu;
  const litShader = gpu.createShaderModule({ code: litWGSL });
  const groundShader = gpu.createShaderModule({ code: groundWGSL });
  const instancedLitShader = gpu.createShaderModule({ code: instancedLitWGSL });
  const whiteTex = createSolidTexture(device);
  const shadowMap = createShadowMap(device, 2048);
  const sceneTargets = createSceneTargets(device, MSAA_SAMPLES);
  const shadowPass = createShadowPass(device, shadowMap);
  const sampleCount = sceneTargets.samples;

  const frameBindGroupLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'depth' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'comparison' },
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

  const textureBindGroupLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
    ],
  });

  const jointBindGroupLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  const litPipelineLayout = gpu.createPipelineLayout({
    bindGroupLayouts: [frameBindGroupLayout, objectBindGroupLayout, textureBindGroupLayout],
  });

  const skinnedPipelineLayout = gpu.createPipelineLayout({
    bindGroupLayouts: [
      frameBindGroupLayout,
      objectBindGroupLayout,
      textureBindGroupLayout,
      jointBindGroupLayout,
    ],
  });

  const groundPipelineLayout = gpu.createPipelineLayout({
    bindGroupLayouts: [frameBindGroupLayout, objectBindGroupLayout],
  });

  const instanceBindGroupLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
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
    bindGroupLayouts: [frameBindGroupLayout, instanceBindGroupLayout, textureBindGroupLayout],
  });

  const makeLitPipeline = (
    layout: GPUPipelineLayout,
    entryPoint: 'vsMain' | 'vsSkinned',
    buffers: GPUVertexBufferLayout[],
    cullMode: GPUCullMode,
    blend: boolean,
    samples: number,
    depthBias = 0,
    depthBiasSlopeScale = 0,
  ): GPURenderPipeline =>
    gpu.createRenderPipeline({
      layout,
      vertex: {
        module: litShader,
        entryPoint,
        buffers,
      },
      fragment: {
        module: litShader,
        entryPoint: 'fsMain',
        targets: [
          {
            format: device.format,
            blend: blend ? BLEND_ALPHA : undefined,
            writeMask: GPUColorWrite.ALL,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode,
        frontFace: 'ccw',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: !blend,
        depthCompare: 'less-equal',
        depthBias,
        depthBiasSlopeScale,
        depthBiasClamp: 0,
      },
      multisample: { count: samples },
    });

  const litPipelines: Record<LitPipelineKey, GPURenderPipeline> = {
    opaqueCull: makeLitPipeline(litPipelineLayout, 'vsMain', [STATIC_VERTEX_LAYOUT], 'back', false, sampleCount),
    opaqueNone: makeLitPipeline(litPipelineLayout, 'vsMain', [STATIC_VERTEX_LAYOUT], 'none', false, sampleCount),
    blendCull: makeLitPipeline(litPipelineLayout, 'vsMain', [STATIC_VERTEX_LAYOUT], 'back', true, sampleCount),
    blendNone: makeLitPipeline(litPipelineLayout, 'vsMain', [STATIC_VERTEX_LAYOUT], 'none', true, sampleCount),
  };

  const skinnedPipelines: Record<LitPipelineKey, GPURenderPipeline> = {
    opaqueCull: makeLitPipeline(skinnedPipelineLayout, 'vsSkinned', SKINNED_VERTEX_LAYOUTS, 'back', false, sampleCount),
    opaqueNone: makeLitPipeline(skinnedPipelineLayout, 'vsSkinned', SKINNED_VERTEX_LAYOUTS, 'none', false, sampleCount),
    blendCull: makeLitPipeline(skinnedPipelineLayout, 'vsSkinned', SKINNED_VERTEX_LAYOUTS, 'back', true, sampleCount),
    blendNone: makeLitPipeline(skinnedPipelineLayout, 'vsSkinned', SKINNED_VERTEX_LAYOUTS, 'none', true, sampleCount),
  };

  const overlayLitPipelines: Record<LitPipelineKey, GPURenderPipeline> = {
    opaqueCull: makeLitPipeline(litPipelineLayout, 'vsMain', [STATIC_VERTEX_LAYOUT], 'back', false, 1, 1, 1),
    opaqueNone: makeLitPipeline(litPipelineLayout, 'vsMain', [STATIC_VERTEX_LAYOUT], 'none', false, 1, 1, 1),
    blendCull: makeLitPipeline(litPipelineLayout, 'vsMain', [STATIC_VERTEX_LAYOUT], 'back', true, 1, 1, 1),
    blendNone: makeLitPipeline(litPipelineLayout, 'vsMain', [STATIC_VERTEX_LAYOUT], 'none', true, 1, 1, 1),
  };

  const overlaySkinnedPipelines: Record<LitPipelineKey, GPURenderPipeline> = {
    opaqueCull: makeLitPipeline(skinnedPipelineLayout, 'vsSkinned', SKINNED_VERTEX_LAYOUTS, 'back', false, 1, 1, 1),
    opaqueNone: makeLitPipeline(skinnedPipelineLayout, 'vsSkinned', SKINNED_VERTEX_LAYOUTS, 'none', false, 1, 1, 1),
    blendCull: makeLitPipeline(skinnedPipelineLayout, 'vsSkinned', SKINNED_VERTEX_LAYOUTS, 'back', true, 1, 1, 1),
    blendNone: makeLitPipeline(skinnedPipelineLayout, 'vsSkinned', SKINNED_VERTEX_LAYOUTS, 'none', true, 1, 1, 1),
  };

  const makeGroundPipeline = (blend: boolean): GPURenderPipeline =>
    gpu.createRenderPipeline({
      layout: groundPipelineLayout,
      vertex: {
        module: groundShader,
        entryPoint: 'vsMain',
        buffers: [STATIC_VERTEX_LAYOUT],
      },
      fragment: {
        module: groundShader,
        entryPoint: 'fsMain',
        targets: [
          {
            format: device.format,
            blend: blend ? BLEND_ALPHA : undefined,
            writeMask: GPUColorWrite.ALL,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
        frontFace: 'ccw',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: !blend,
        depthCompare: 'less-equal',
      },
      multisample: { count: sampleCount },
    });

  const groundOpaquePipeline = makeGroundPipeline(false);
  const groundBlendPipeline = makeGroundPipeline(true);

  const makeInstancedLitPipeline = (cullMode: GPUCullMode): GPURenderPipeline =>
    gpu.createRenderPipeline({
      layout: instancedPipelineLayout,
      vertex: {
        module: instancedLitShader,
        entryPoint: 'vsMain',
        buffers: [STATIC_VERTEX_LAYOUT],
      },
      fragment: {
        module: instancedLitShader,
        entryPoint: 'fsMain',
        targets: [{ format: device.format, writeMask: GPUColorWrite.ALL }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode,
        frontFace: 'ccw',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less-equal',
      },
      multisample: { count: sampleCount },
    });

  const instancedCullPipeline = makeInstancedLitPipeline('back');
  const instancedNonePipeline = makeInstancedLitPipeline('none');

  const frameUniformBuffer = gpu.createBuffer({
    size: Math.max(256, FRAME_UNIFORM_SIZE),
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const frameBindGroup = gpu.createBindGroup({
    layout: frameBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: shadowMap.view },
      { binding: 2, resource: shadowMap.sampler },
    ],
  });

  let objectCapacity = 64;
  let objectUniformBuffer = gpu.createBuffer({
    size: objectCapacity * OBJECT_UNIFORM_ALIGN,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
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

  const textureBindGroups = new WeakMap<GPUTexture, GPUBindGroup>();
  const frameBytes = new Float32Array(FRAME_UNIFORM_FLOATS);
  let objectStaging = new Float32Array(objectCapacity * (OBJECT_UNIFORM_ALIGN / 4));
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

    objectUniformBuffer.destroy();
    objectCapacity = Math.max(objectCapacity * 2, count);
    objectUniformBuffer = gpu.createBuffer({
      size: objectCapacity * OBJECT_UNIFORM_ALIGN,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
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
    objectStaging = new Float32Array(objectCapacity * (OBJECT_UNIFORM_ALIGN / 4));
  };

  const getTextureBindGroup = (tex: TextureHandle): GPUBindGroup => {
    const existing = textureBindGroups.get(tex.texture);
    if (existing) return existing;

    const bindGroup = gpu.createBindGroup({
      layout: textureBindGroupLayout,
      entries: [
        { binding: 0, resource: tex.view },
        { binding: 1, resource: tex.sampler },
      ],
    });
    textureBindGroups.set(tex.texture, bindGroup);
    return bindGroup;
  };

  const instanceBindByIndex = new WeakMap<GPUBuffer, GPUBindGroup>();

  const writeObject = (
    index: number,
    model: Mat4,
    color: readonly [number, number, number, number],
    alphaCutoff = -1,
  ) => {
    const base = index * (OBJECT_UNIFORM_ALIGN / 4);
    objectStaging.set(model, base);
    objectStaging[base + 16] = color[0];
    objectStaging[base + 17] = color[1];
    objectStaging[base + 18] = color[2];
    objectStaging[base + 19] = color[3];
    objectStaging[base + 20] = alphaCutoff;
  };

  const flushObjectStaging = (count: number) => {
    if (count <= 0) return;
    gpu.queue.writeBuffer(
      objectUniformBuffer,
      0,
      objectStaging.buffer as ArrayBuffer,
      objectStaging.byteOffset,
      count * OBJECT_UNIFORM_ALIGN,
    );
  };

  const litKeyFor = (item: DrawItem, blend: boolean): LitPipelineKey => {
    const none = item.material.doubleSided === true;
    if (blend) return none ? 'blendNone' : 'blendCull';
    return none ? 'opaqueNone' : 'opaqueCull';
  };

  const sortForSkinBatch = (items: DrawItem[], backToFront: boolean) => {
    items.sort((a, b) => {
      const aSkin = a.skin ? 1 : 0;
      const bSkin = b.skin ? 1 : 0;
      if (aSkin !== bSkin) return aSkin - bSkin;

      const meshDiff = meshSortKey(a.mesh) - meshSortKey(b.mesh);
      if (meshDiff !== 0) return meshDiff;

      if (a.skin && b.skin) {
        if (a.skin.paletteGpu.bindGroup !== b.skin.paletteGpu.bindGroup) {
          return a.skin.jointCount - b.skin.jointCount;
        }
      }
      return backToFront ? b.sortZ - a.sortZ : a.sortZ - b.sortZ;
    });
  };

  const encode = (
    encoder: GPUCommandEncoder,
    camera: Camera,
    lightViewProj: Mat4,
    ground: GroundDraw | null,
    opaque: readonly DrawItem[],
    transparent: readonly DrawItem[],
    overlay: readonly DrawItem[],
    shadowCasters: readonly DrawItem[],
    staticBatches: readonly PreparedStaticBatch[] = [],
  ) => {
    shadowPass.encode(encoder, lightViewProj, ground, shadowCasters, staticBatches);

    device.resize();
    const size = device.getSize();
    sceneTargets.resize(size.width, size.height);

    const opaqueList = opaque.slice() as DrawItem[];
    const transparentList = transparent.slice() as DrawItem[];
    const overlayOpaque: DrawItem[] = [];
    const overlayBlend: DrawItem[] = [];
    for (const item of overlay) {
      if (item.material.alphaMode === 'BLEND') overlayBlend.push(item);
      else overlayOpaque.push(item);
    }
    sortForSkinBatch(opaqueList, false);
    sortForSkinBatch(transparentList, true);
    sortForSkinBatch(overlayOpaque, false);
    sortForSkinBatch(overlayBlend, true);
    const overlayList = overlayOpaque.concat(overlayBlend);

    const totalObjects =
      opaqueList.length + transparentList.length + overlayList.length + (ground ? 1 : 0);
    ensureObjectCapacity(Math.max(1, totalObjects));

    const light = DIRECTIONAL_LIGHT;
    frameBytes.set(camera.viewProj, 0);
    frameBytes.set(lightViewProj, 16);
    frameBytes[32] = light.dir[0];
    frameBytes[33] = light.dir[1];
    frameBytes[34] = light.dir[2];
    frameBytes[35] = ground?.alpha ?? 1;
    frameBytes[36] = light.ambient[0];
    frameBytes[37] = light.ambient[1];
    frameBytes[38] = light.ambient[2];
    frameBytes[39] = shadowMap.size;
    frameBytes[40] = light.color[0];
    frameBytes[41] = light.color[1];
    frameBytes[42] = light.color[2];
    frameBytes[43] = 0;
    gpu.queue.writeBuffer(
      frameUniformBuffer,
      0,
      frameBytes.buffer as ArrayBuffer,
      frameBytes.byteOffset,
      FRAME_UNIFORM_SIZE,
    );

    let objectIndex = 0;
    const groundObjectIndex = ground ? objectIndex++ : -1;

    const opaqueIndices: number[] = [];
    for (const _item of opaqueList) opaqueIndices.push(objectIndex++);

    const transparentIndices: number[] = [];
    for (const _item of transparentList) transparentIndices.push(objectIndex++);

    const overlayIndices: number[] = [];
    for (const _item of overlayList) overlayIndices.push(objectIndex++);

    const writeItemObject = (item: DrawItem, index: number) => {
      const cutoff =
        item.material.alphaMode === 'MASK' ? (item.material.alphaCutoff ?? 0.5) : -1;
      if (item.skin || item.gpuModel) {
        writeObject(index, IDENTITY_MODEL, item.material.baseColorFactor, cutoff);
        return;
      }
      writeObject(index, item.model, item.material.baseColorFactor, cutoff);
    };

    if (ground && groundObjectIndex >= 0) {
      writeObject(groundObjectIndex, ground.model, [1, 1, 1, 1]);
    }
    for (let i = 0; i < opaqueList.length; i++) writeItemObject(opaqueList[i]!, opaqueIndices[i]!);
    for (let i = 0; i < transparentList.length; i++) {
      writeItemObject(transparentList[i]!, transparentIndices[i]!);
    }
    for (let i = 0; i < overlayList.length; i++) writeItemObject(overlayList[i]!, overlayIndices[i]!);

    flushObjectStaging(objectIndex);

    for (let i = 0; i < opaqueList.length; i++) {
      const item = opaqueList[i]!;
      if (!item.gpuModel || item.skin) continue;
      encoder.copyBufferToBuffer(
        item.gpuModel.buffer,
        item.gpuModel.byteOffset,
        objectUniformBuffer,
        opaqueIndices[i]! * OBJECT_UNIFORM_ALIGN,
        64,
      );
    }
    for (let i = 0; i < transparentList.length; i++) {
      const item = transparentList[i]!;
      if (!item.gpuModel || item.skin) continue;
      encoder.copyBufferToBuffer(
        item.gpuModel.buffer,
        item.gpuModel.byteOffset,
        objectUniformBuffer,
        transparentIndices[i]! * OBJECT_UNIFORM_ALIGN,
        64,
      );
    }
    for (let i = 0; i < overlayList.length; i++) {
      const item = overlayList[i]!;
      if (!item.gpuModel || item.skin) continue;
      encoder.copyBufferToBuffer(
        item.gpuModel.buffer,
        item.gpuModel.byteOffset,
        objectUniformBuffer,
        overlayIndices[i]! * OBJECT_UNIFORM_ALIGN,
        64,
      );
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: sceneTargets.getColorView(),
          resolveTarget: sceneTargets.getResolveView(),
          clearValue: { r: 0.56, g: 0.66, b: 0.82, a: 1 },
          loadOp: 'clear',
          storeOp: 'discard',
        },
      ],
      depthStencilAttachment: {
        view: sceneTargets.getDepthView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });

    pass.setBindGroup(0, frameBindGroup);

    let lastPaletteKey: GPUBindGroup | null = null;
    let lastVertex: GPUBuffer | null = null;
    let lastJoint: GPUBuffer | null = null;
    let lastWeight: GPUBuffer | null = null;
    let lastIndex: GPUBuffer | null = null;
    let lastTexKey: GPUTexture | null = null;

    const bindMesh = (
      encoderPass: GPURenderPassEncoder,
      mesh: Mesh,
      skinned: boolean,
    ) => {
      if (mesh.vertexBuffer !== lastVertex) {
        encoderPass.setVertexBuffer(0, mesh.vertexBuffer);
        lastVertex = mesh.vertexBuffer;
      }
      if (skinned && isSkinnedMesh(mesh)) {
        if (mesh.jointBuffer !== lastJoint) {
          encoderPass.setVertexBuffer(1, mesh.jointBuffer);
          lastJoint = mesh.jointBuffer;
        }
        if (mesh.weightBuffer !== lastWeight) {
          encoderPass.setVertexBuffer(2, mesh.weightBuffer);
          lastWeight = mesh.weightBuffer;
        }
      } else {
        lastJoint = null;
        lastWeight = null;
      }
      if (mesh.indexBuffer !== lastIndex) {
        encoderPass.setIndexBuffer(mesh.indexBuffer, 'uint32');
        lastIndex = mesh.indexBuffer;
      }
    };

    const drawLitItem = (
      item: DrawItem,
      index: number,
      blend: boolean,
      pipelines: Record<LitPipelineKey, GPURenderPipeline>,
      skinned: Record<LitPipelineKey, GPURenderPipeline>,
      encoderPass: GPURenderPassEncoder,
    ) => {
      const key = litKeyFor(item, blend);
      const skin = item.skin;
      const tex = item.material.baseColorTex ?? whiteTex;
      if (skin && isSkinnedMesh(item.mesh)) {
        const paletteKey = skin.paletteGpu.bindGroup;
        if (paletteKey !== lastPaletteKey) {
          encoderPass.setBindGroup(3, paletteKey);
          lastPaletteKey = paletteKey;
        }
        encoderPass.setPipeline(skinned[key]);
        encoderPass.setBindGroup(1, objectBindGroup, [index * OBJECT_UNIFORM_ALIGN]);
        if (tex.texture !== lastTexKey) {
          encoderPass.setBindGroup(2, getTextureBindGroup(tex));
          lastTexKey = tex.texture;
        }
        bindMesh(encoderPass, item.mesh, true);
        encoderPass.drawIndexed(item.mesh.indexCount);
        return;
      }

      lastPaletteKey = null;
      encoderPass.setPipeline(pipelines[key]);
      encoderPass.setBindGroup(1, objectBindGroup, [index * OBJECT_UNIFORM_ALIGN]);
      if (tex.texture !== lastTexKey) {
        encoderPass.setBindGroup(2, getTextureBindGroup(tex));
        lastTexKey = tex.texture;
      }
      bindMesh(encoderPass, item.mesh, false);
      encoderPass.drawIndexed(item.mesh.indexCount);
    };

    const drawGround = (blend: boolean) => {
      if (!ground || groundObjectIndex < 0) return;
      lastPaletteKey = null;
      lastTexKey = null;
      pass.setPipeline(blend ? groundBlendPipeline : groundOpaquePipeline);
      pass.setBindGroup(1, objectBindGroup, [groundObjectIndex * OBJECT_UNIFORM_ALIGN]);
      bindMesh(pass, ground.mesh, false);
      pass.drawIndexed(ground.mesh.indexCount);
    };

    if (ground && ground.alpha >= 0.999) drawGround(false);

    for (let i = 0; i < opaqueList.length; i++) {
      drawLitItem(opaqueList[i]!, opaqueIndices[i]!, false, litPipelines, skinnedPipelines, pass);
    }

    for (const batch of staticBatches) {
      lastPaletteKey = null;
      lastTexKey = null;
      let instanceBindGroup = instanceBindByIndex.get(batch.forwardIndexBuffer);
      if (!instanceBindGroup) {
        instanceBindGroup = gpu.createBindGroup({
          layout: instanceBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: batch.instanceBuffer } },
            { binding: 1, resource: { buffer: batch.forwardIndexBuffer } },
          ],
        });
        instanceBindByIndex.set(batch.forwardIndexBuffer, instanceBindGroup);
      }
      pass.setPipeline(batch.doubleSided ? instancedNonePipeline : instancedCullPipeline);
      pass.setBindGroup(1, instanceBindGroup);
      pass.setBindGroup(2, getTextureBindGroup(batch.material.baseColorTex ?? whiteTex));
      bindMesh(pass, batch.mesh, false);
      pass.drawIndexedIndirect(batch.forwardIndirectBuffer, 0);
    }

    if (ground && ground.alpha < 0.999) drawGround(true);

    for (let i = 0; i < transparentList.length; i++) {
      drawLitItem(transparentList[i]!, transparentIndices[i]!, true, litPipelines, skinnedPipelines, pass);
    }

    pass.end();

    if (overlayList.length > 0) {
      const overlayPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: sceneTargets.getResolveView(),
            loadOp: 'load',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
          view: sceneTargets.getOverlayDepthView(),
          depthClearValue: 1,
          depthLoadOp: 'clear',
          depthStoreOp: 'discard',
        },
      });

      overlayPass.setBindGroup(0, frameBindGroup);
      lastPaletteKey = null;
      lastTexKey = null;
      lastVertex = null;
      lastJoint = null;
      lastWeight = null;
      lastIndex = null;

      for (let i = 0; i < overlayList.length; i++) {
        const item = overlayList[i]!;
        const blend = item.material.alphaMode === 'BLEND';
        drawLitItem(
          item,
          overlayIndices[i]!,
          blend,
          overlayLitPipelines,
          overlaySkinnedPipelines,
          overlayPass,
        );
      }

      overlayPass.end();
    }

    return { width: size.width, height: size.height };
  };

  const destroy = () => {
    shadowPass.destroy();
    shadowMap.destroy();
    sceneTargets.destroy();
    frameUniformBuffer.destroy();
    objectUniformBuffer.destroy();
    whiteTex.texture.destroy();
  };

  return {
    encode,
    getSceneView: () => sceneTargets.getResolveView(),
    destroy,
  };
};
