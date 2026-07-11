import { type GpuDevice } from '../gl/device.ts';
import { type Collider } from '../../components/collider.ts';
import { collisionResolveWGSL } from '../shaders/collisionResolveWgsl.ts';
import {
  CHARACTER_STATE_FLOATS,
  CHARACTER_STATE_STRIDE,
  COLLIDER_KIND_BOX,
  COLLIDER_KIND_CAPSULE,
  COLLIDER_KIND_CYLINDER,
  COLLIDER_KIND_ELLIPSOID,
  COLLIDER_KIND_SPHERE,
  GRID_CELL_COUNT,
  GRID_CELL_SIZE,
  GRID_ORIGIN,
  GRID_RES,
  STATIC_COLLIDER_FLOATS,
  STATIC_COLLIDER_STRIDE,
  packStaticCollider,
  writeCharacterState,
} from '../gl/collisionPack.ts';

const PHYSICS_STEP_SEC = 1 / 144;
const IDENTITY_ROT = [0, 0, 0, 1] as const;

export type CollisionCharacterInput = {
  pos: Float32Array | readonly [number, number, number];
  vel: Float32Array | readonly [number, number, number];
  radius: number;
  halfHeight: number;
  gravity: number;
  onGround: boolean;
  active: boolean;
};

export type CollisionPass = {
  markStaticDirty: () => void;
  rebuildStatic: (colliders: readonly Collider[]) => void;
  ensureCharacterCapacity: (count: number) => void;
  writeCharacters: (chars: readonly CollisionCharacterInput[]) => void;
  dispatch: (dt: number, characterCount: number) => number;
  isReadbackReady: () => boolean;
  canDispatch: () => boolean;
  readCharacters: (out: Float32Array, characterCount: number) => number;
  destroy: () => void;
};

type ReadbackSlot = {
  buffer: GPUBuffer | null;
  mapping: boolean;
  ready: boolean;
  count: number;
};

const kindOf = (collider: Collider): number => {
  switch (collider.shape.kind) {
    case 'box':
      return COLLIDER_KIND_BOX;
    case 'cylinder':
      return COLLIDER_KIND_CYLINDER;
    case 'capsule':
      return COLLIDER_KIND_CAPSULE;
    case 'sphere':
      return COLLIDER_KIND_SPHERE;
    case 'ellipsoid':
      return COLLIDER_KIND_ELLIPSOID;
  }
};

const packCollider = (out: Float32Array, offset: number, collider: Collider) => {
  const shape = collider.shape;
  const amin = collider.aabb.min;
  const amax = collider.aabb.max;

  if (shape.kind === 'box') {
    packStaticCollider(
      out,
      offset,
      amin,
      amax,
      COLLIDER_KIND_BOX,
      shape.center,
      shape.halfExtents[0],
      shape.halfExtents[1],
      shape.halfExtents[2],
      shape.rotation,
    );
    return;
  }

  if (shape.kind === 'cylinder' || shape.kind === 'capsule') {
    packStaticCollider(
      out,
      offset,
      amin,
      amax,
      kindOf(collider),
      shape.center,
      shape.radius,
      shape.halfHeight,
      0,
      shape.rotation,
    );
    return;
  }

  if (shape.kind === 'sphere') {
    packStaticCollider(
      out,
      offset,
      amin,
      amax,
      COLLIDER_KIND_SPHERE,
      shape.center,
      shape.radius,
      0,
      0,
      IDENTITY_ROT,
    );
    return;
  }

  packStaticCollider(
    out,
    offset,
    amin,
    amax,
    COLLIDER_KIND_ELLIPSOID,
    shape.center,
    shape.radii[0],
    shape.radii[1],
    shape.radii[2],
    shape.rotation,
  );
};

export const createCollisionPass = (device: GpuDevice): CollisionPass => {
  const gpu = device.gpu;
  const shader = gpu.createShaderModule({ code: collisionResolveWGSL });
  void shader.getCompilationInfo().then((info) => {
    for (const message of info.messages) {
      if (message.type === 'error') {
        console.error('collisionResolve WGSL:', message.message);
      }
    }
  });

  const bindGroupLayout = gpu.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
    ],
  });

  const pipeline = gpu.createComputePipeline({
    layout: gpu.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    compute: { module: shader, entryPoint: 'resolveCharacters' },
  });

  const frameBuffer = gpu.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const frameF32 = new Float32Array(4);

  let staticDirty = true;
  let colliderCount = 0;
  let colliderCapacity = 0;
  let colliderBuffer: GPUBuffer | null = null;
  let colliderCpu = new Float32Array(0);

  let cellStartBuffer: GPUBuffer | null = null;
  let cellCountBuffer: GPUBuffer | null = null;
  let cellIndexBuffer: GPUBuffer | null = null;
  const cellStarts = new Uint32Array(GRID_CELL_COUNT);
  const cellCounts = new Uint32Array(GRID_CELL_COUNT);
  let cellIndices = new Uint32Array(0);

  let characterCapacity = 0;
  let characterBuffer: GPUBuffer | null = null;
  let characterCpu = new Float32Array(0);
  const slots: [ReadbackSlot, ReadbackSlot] = [
    { buffer: null, mapping: false, ready: false, count: 0 },
    { buffer: null, mapping: false, ready: false, count: 0 },
  ];
  let writeSlot = 0;

  const destroyColliderBuffers = () => {
    colliderBuffer?.destroy();
    cellStartBuffer?.destroy();
    cellCountBuffer?.destroy();
    cellIndexBuffer?.destroy();
    colliderBuffer = null;
    cellStartBuffer = null;
    cellCountBuffer = null;
    cellIndexBuffer = null;
    colliderCapacity = 0;
  };

  const destroyCharacterBuffers = () => {
    characterBuffer?.destroy();
    for (const slot of slots) {
      slot.buffer?.destroy();
      slot.buffer = null;
      slot.mapping = false;
      slot.ready = false;
      slot.count = 0;
    }
    characterBuffer = null;
    characterCapacity = 0;
    writeSlot = 0;
  };

  const buildGrid = (count: number) => {
    cellStarts.fill(0);
    cellCounts.fill(0);

    const lists: number[][] = Array.from({ length: GRID_CELL_COUNT }, () => []);

    for (let i = 0; i < count; i++) {
      const base = i * STATIC_COLLIDER_FLOATS;
      const minX = colliderCpu[base]!;
      const maxX = colliderCpu[base + 4]!;
      const minZ = colliderCpu[base + 2]!;
      const maxZ = colliderCpu[base + 6]!;

      const cx0 = Math.max(0, Math.floor((minX - GRID_ORIGIN) / GRID_CELL_SIZE));
      const cx1 = Math.min(GRID_RES - 1, Math.floor((maxX - GRID_ORIGIN) / GRID_CELL_SIZE));
      const cz0 = Math.max(0, Math.floor((minZ - GRID_ORIGIN) / GRID_CELL_SIZE));
      const cz1 = Math.min(GRID_RES - 1, Math.floor((maxZ - GRID_ORIGIN) / GRID_CELL_SIZE));

      for (let cz = cz0; cz <= cz1; cz++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          lists[cz * GRID_RES + cx]!.push(i);
        }
      }
    }

    let total = 0;
    for (let c = 0; c < GRID_CELL_COUNT; c++) {
      cellStarts[c] = total;
      cellCounts[c] = lists[c]!.length;
      total += lists[c]!.length;
    }

    if (cellIndices.length < total) {
      cellIndices = new Uint32Array(Math.max(total, 64));
    }

    for (let c = 0; c < GRID_CELL_COUNT; c++) {
      const start = cellStarts[c]!;
      const list = lists[c]!;
      for (let k = 0; k < list.length; k++) {
        cellIndices[start + k] = list[k]!;
      }
    }

    cellStartBuffer?.destroy();
    cellCountBuffer?.destroy();
    cellIndexBuffer?.destroy();

    cellStartBuffer = gpu.createBuffer({
      size: GRID_CELL_COUNT * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    cellCountBuffer = gpu.createBuffer({
      size: GRID_CELL_COUNT * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    cellIndexBuffer = gpu.createBuffer({
      size: Math.max(4, total * 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    gpu.queue.writeBuffer(cellStartBuffer, 0, cellStarts);
    gpu.queue.writeBuffer(cellCountBuffer, 0, cellCounts);
    if (total > 0) {
      gpu.queue.writeBuffer(cellIndexBuffer, 0, cellIndices.subarray(0, total));
    }
  };

  const rebuildStatic: CollisionPass['rebuildStatic'] = (colliders) => {
    const statics = colliders.filter((c) => c.isStatic);
    colliderCount = statics.length;

    if (colliderCount > colliderCapacity || !colliderBuffer) {
      destroyColliderBuffers();
      colliderCapacity = Math.max(64, colliderCount * 2);
      colliderCpu = new Float32Array(colliderCapacity * STATIC_COLLIDER_FLOATS);
      colliderBuffer = gpu.createBuffer({
        size: colliderCapacity * STATIC_COLLIDER_STRIDE,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }

    for (let i = 0; i < colliderCount; i++) {
      packCollider(colliderCpu, i * STATIC_COLLIDER_FLOATS, statics[i]!);
    }

    if (colliderCount > 0) {
      gpu.queue.writeBuffer(
        colliderBuffer,
        0,
        colliderCpu.subarray(0, colliderCount * STATIC_COLLIDER_FLOATS),
      );
    }

    buildGrid(colliderCount);
    staticDirty = false;
  };

  const ensureCharacterCapacity: CollisionPass['ensureCharacterCapacity'] = (count) => {
    if (count <= characterCapacity && characterBuffer && slots[0].buffer && slots[1].buffer) return;

    destroyCharacterBuffers();
    characterCapacity = Math.max(64, count * 2);
    characterCpu = new Float32Array(characterCapacity * CHARACTER_STATE_FLOATS);
    characterBuffer = gpu.createBuffer({
      size: characterCapacity * CHARACTER_STATE_STRIDE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    const readbackSize = characterCapacity * CHARACTER_STATE_STRIDE;
    for (const slot of slots) {
      slot.buffer = gpu.createBuffer({
        size: readbackSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
    }
  };

  const writeCharacters: CollisionPass['writeCharacters'] = (chars) => {
    ensureCharacterCapacity(chars.length);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i]!;
      writeCharacterState(
        characterCpu,
        i * CHARACTER_STATE_FLOATS,
        ch.pos,
        ch.vel,
        ch.radius,
        ch.halfHeight,
        ch.gravity,
        ch.onGround,
        ch.active,
      );
    }
    if (chars.length > 0) {
      gpu.queue.writeBuffer(
        characterBuffer!,
        0,
        characterCpu.subarray(0, chars.length * CHARACTER_STATE_FLOATS),
      );
    }
  };

  const dispatch: CollisionPass['dispatch'] = (dt, characterCount) => {
    const slotIndex = writeSlot;
    const slot = slots[slotIndex]!;
    if (characterCount === 0 || !characterBuffer || !colliderBuffer || !slot.buffer) return -1;
    if (!cellStartBuffer || !cellCountBuffer || !cellIndexBuffer) return -1;
    if (slot.mapping) return -1;

    frameF32[0] = dt;
    frameF32[1] = characterCount;
    frameF32[2] = colliderCount;
    frameF32[3] = PHYSICS_STEP_SEC;
    gpu.queue.writeBuffer(frameBuffer, 0, frameF32);

    const bindGroup = gpu.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: frameBuffer } },
        { binding: 1, resource: { buffer: colliderBuffer } },
        { binding: 2, resource: { buffer: characterBuffer } },
        { binding: 3, resource: { buffer: cellStartBuffer } },
        { binding: 4, resource: { buffer: cellCountBuffer } },
        { binding: 5, resource: { buffer: cellIndexBuffer } },
      ],
    });

    const encoder = gpu.createCommandEncoder();
    {
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(characterCount / 64));
      pass.end();
    }
    encoder.copyBufferToBuffer(
      characterBuffer,
      0,
      slot.buffer,
      0,
      characterCount * CHARACTER_STATE_STRIDE,
    );
    gpu.queue.submit([encoder.finish()]);

    slot.mapping = true;
    slot.ready = false;
    slot.count = characterCount;
    writeSlot = 1 - writeSlot;
    void slot.buffer.mapAsync(GPUMapMode.READ).then(() => {
      if (slots[slotIndex] === slot && slot.mapping) slot.ready = true;
    });
    return slotIndex;
  };

  const readySlotIndex = (): number => {
    if (slots[0]!.ready) return 0;
    if (slots[1]!.ready) return 1;
    return -1;
  };

  const isReadbackReady: CollisionPass['isReadbackReady'] = () => readySlotIndex() >= 0;

  const canDispatch: CollisionPass['canDispatch'] = () => !slots[writeSlot]!.mapping;

  const readCharacters: CollisionPass['readCharacters'] = (out, characterCount) => {
    const index = readySlotIndex();
    if (index < 0 || characterCount === 0) return -1;
    const slot = slots[index]!;
    if (!slot.buffer || !slot.ready) return -1;
    const count = Math.min(characterCount, slot.count);
    const size = count * CHARACTER_STATE_STRIDE;
    const mapped = new Float32Array(slot.buffer.getMappedRange(0, size));
    out.set(mapped.subarray(0, count * CHARACTER_STATE_FLOATS));
    slot.buffer.unmap();
    slot.mapping = false;
    slot.ready = false;
    slot.count = 0;
    return index;
  };

  return {
    markStaticDirty: () => {
      staticDirty = true;
    },
    rebuildStatic: (colliders) => {
      const staticCount = colliders.reduce((n, c) => n + (c.isStatic ? 1 : 0), 0);
      if (!staticDirty && staticCount === colliderCount) return;
      rebuildStatic(colliders);
    },
    ensureCharacterCapacity,
    writeCharacters,
    dispatch,
    isReadbackReady,
    canDispatch,
    readCharacters,
    destroy: () => {
      destroyColliderBuffers();
      destroyCharacterBuffers();
      frameBuffer.destroy();
    },
  };
};
